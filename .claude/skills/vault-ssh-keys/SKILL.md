---
name: vault-ssh-keys
description: Manage per-host SSH keypair lifecycle in Vault under kv/network/hosts/<host>/users/<user>/ssh/<consumer> — generate, store, read, rotate, retire
command: /vault-ssh-keys
auto_invoke: false
---

# Vault SSH Keys

Interactive workflow for generating, storing, and rotating SSH keypairs used by agents or services ("consumers") to reach managed hosts. Each keypair belongs to a specific `(host, user, consumer)` triple, so the same host user can have multiple distinct keys for multiple consumers.

## Path convention

SSH keypairs live under the host-users subtree (see the `vault-host-users` skill for the full layout):

```
kv/data/network/hosts/<host>/users/<user>/ssh/<consumer>
```

### Placeholders
- `<host>` — short, stable hostname (`host01`, `fw-primary`) — not FQDN, not IP
- `<user>` — local login name on that host (`admin`, `opsuser`, `root`)
- `<consumer>` — the agent or service that owns the key (`example-agent`, `ansible`, `human:<handle>`)

### Why nest under `users/<user>/ssh/`?
- The same host user can legitimately have several authorized SSH keys (one per agent, one per human operator, etc.)
- Each consumer can rotate its key independently without touching siblings
- Per-path KV v2 versioning gives a clean per-key audit trail
- The sibling `_meta` record holds an `authorized_keys[]` inventory array for drift detection

## Secret schema

Every entry at `kv/data/network/hosts/<host>/users/<user>/ssh/<consumer>` has these fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `consumer` | string | ✅ | Matches the path segment — redundant but convenient |
| `private_key` | string | ✅ | OpenSSH private key (PEM), complete with header/footer |
| `public_key` | string | ✅ | OpenSSH public key (`ssh-<type> <base64> <comment>`) |
| `fingerprint` | string | ✅ | `SHA256:<base64>` (from `ssh-keygen -lf`) |
| `key_type` | enum | ✅ | `ed25519` (preferred) \| `rsa` \| `ecdsa` |
| `local_cache_path` | string | optional | e.g. `~/.secrets/ssh/<host>_<consumer>` (bootstrap cache) |
| `rotated_at` | ISO-8601 UTC | ✅ | Timestamp of current version |
| `rotated_by` | string | ✅ | Who/what rotated it (`<actor>@<workstation>`, human handle, agent name) |
| `rotation_reason` | enum | ✅ | `initial-bootstrap` \| `scheduled-rotation` \| `compromise` \| `key-loss` \| `policy-upgrade` |

**Never** store passphrases in this record. Keys in Vault are considered encrypted-at-rest by Vault itself; if an additional passphrase layer is required, that is a separate threat model and should be covered by its own design document.

## Operations

### 1. Read a consumer's public key (safe to log)
```
vault_secret_read path=network/hosts/<host>/users/<user>/ssh/<consumer>
```
Extract only `public_key` / `fingerprint` / `key_type` / `rotated_at` / `rotated_by` / `rotation_reason` for display. **Never** print `private_key`.

### 2. Write a new keypair (initial bootstrap)
1. Generate locally:
   ```
   ssh-keygen -t ed25519 -N '' -C "<consumer>@<host>:<iso-ts>" -f <local-path>
   ```
2. `chmod 600 <local-path>`
3. Compute fingerprint: `ssh-keygen -lf <local-path>.pub`
4. `vault_secret_write path=network/hosts/<host>/users/<user>/ssh/<consumer>` with the full payload and `rotation_reason: initial-bootstrap`
5. Install `public_key` on the target host as an entry in the corresponding user's `~/.ssh/authorized_keys` (for appliances: via Web UI)
6. Append the matching entry to the user's `_meta.authorized_keys[]` inventory (see `vault-host-users`)
7. Record the install step in the associated tracking issue

### 3. Rotate a keypair
1. Generate a new keypair locally (never overwrite the old file path — append a timestamp)
2. Install the new pubkey on the target host **alongside** the old one (belt-and-braces)
3. Add the new entry to `_meta.authorized_keys[]`
4. Update consumers (env vars, wrapper script) to use the new key
5. Verify consumers are healthy with the new key
6. Remove the old pubkey from the target host
7. Remove the old entry from `_meta.authorized_keys[]`
8. `vault_secret_write` with new data + `rotation_reason: scheduled-rotation` (or `compromise` if forced)
9. Previous version remains accessible via `vault_secret_metadata` for audit
10. After soak period (default 7 days), `vault_secret_destroy` the old version

### 4. Retire a consumer's key
1. Remove the pubkey from the host's `authorized_keys` (leave other consumers' keys intact)
2. Remove the matching entry from `_meta.authorized_keys[]`
3. `vault_secret_delete path=network/hosts/<host>/users/<user>/ssh/<consumer>` (soft — recoverable)
4. After retention policy, `vault_secret_destroy` (permanent)

### 5. List consumers for a user on a host
```
vault_secret_list path=network/hosts/<host>/users/<user>/ssh/
```

### 6. List all hosts known to Vault
```
vault_secret_list path=network/hosts/
```

## Required MCP tools

- `vault_secret_read`
- `vault_secret_write`
- `vault_secret_list`
- `vault_secret_metadata`
- `vault_secret_delete`
- `vault_secret_destroy` (rotation cleanup, requires explicit confirmation)

## Safety rules

- **Never** print `private_key` in conversation, logs, commit messages, or tool-call arguments. When reading, filter output to `public_key` / `fingerprint` only unless the user explicitly asks to re-extract the private key to a local file.
- When writing, pipe private key content via file path or stdin — never via a command argument.
- Every write MUST set `rotated_by` + `rotation_reason` — they are the audit trail.
- The `compromise` rotation reason implies an incident; flag it to the user and recommend opening a tracking issue before proceeding.
- Keypairs generated during `initial-bootstrap` MUST also be stored locally at a mode-600 cache path outside any git repository (e.g. `~/.secrets/ssh/<host>_<consumer>`) so the bootstrap process can run before mcp-vault is available. After bootstrap, the Vault copy is the source of truth — the local file is a cache that can be re-derived via `vault_secret_read`.
- Never check any part of key material into git. The local cache directory MUST be outside every git repository.
- **`authorized_keys[]` cross-check**: after any write or rotation, verify that `_meta.authorized_keys[]` (from `vault-host-users`) contains a matching entry with the same fingerprint. If they diverge, stop and alert the user.

## Example — bootstrap a new consumer key

```
User: bootstrap an SSH key for <host>/<user> for <consumer>
Agent:
  1. ssh-keygen -t ed25519 -N '' -C "<consumer>@<host>:<iso-ts>" -f ~/.secrets/ssh/<host>_<consumer>
  2. chmod 600 ~/.secrets/ssh/<host>_<consumer>
  3. ssh-keygen -lf ~/.secrets/ssh/<host>_<consumer>.pub
     → 256 SHA256:<base64>  <consumer>@<host>:<iso-ts>  (ED25519)
  4. vault_secret_write path=network/hosts/<host>/users/<user>/ssh/<consumer> data={
       consumer: "<consumer>",
       private_key: <file contents, piped via stdin>,
       public_key: <file contents>,
       fingerprint: "SHA256:<base64>",
       key_type: "ed25519",
       local_cache_path: "~/.secrets/ssh/<host>_<consumer>",
       rotated_at: "<iso-ts>",
       rotated_by: "<actor>@<workstation> (<consumer>-ssh bootstrap)",
       rotation_reason: "initial-bootstrap"
     }
  5. Print pubkey to user for manual installation in <user>'s ~/.ssh/authorized_keys on <host>
  6. After install, append to _meta.authorized_keys[] (via vault-host-users skill)
  7. Verify with: vault_secret_read path=network/hosts/<host>/users/<user>/ssh/<consumer>
     (show only metadata + pubkey, never private_key)
```

## Related

- `vault-host-users` — the parent layout, including `_meta.authorized_keys[]` inventory
- `vault-secret-management` — generic KV v2 CRUD
