---
name: vault-host-users
description: Manage per-host user account credentials in Vault under kv/network/hosts/<host>/users/<user>/{_meta,password,ssh/<consumer>} — user-centric, multi-credential, multi-consumer layout
command: /vault-host-users
auto_invoke: false
---

# Vault Host Users

Interactive workflow for storing and rotating local user account credentials (password, SSH keys per consumer, metadata) on managed hosts — **one user = one subtree**, with cleanly separated secrets.

## Layout — user-centric, multi-credential

```
kv/data/network/hosts/<host>/_index                       ← host-level marker
kv/data/network/hosts/<host>/users/_index                 ← users index (schema version)
kv/data/network/hosts/<host>/users/<user>/_meta           ← user facts, groups, sudo state, authorized_keys[]
kv/data/network/hosts/<host>/users/<user>/password        ← plaintext password (encrypted at rest)
kv/data/network/hosts/<host>/users/<user>/ssh/_index      ← ssh consumers index
kv/data/network/hosts/<host>/users/<user>/ssh/<consumer>  ← SSH keypair for a specific consumer
```

### Why split?
- **Separate blast radius**: reading `_meta` for audit/display doesn't pull the password
- **Per-consumer SSH keys**: rotate one consumer's key without touching another's
- **Per-path versioning**: rotating the password doesn't bump SSH key version history
- **ACL granularity**: future policies can grant `read` on `_meta` broadly but restrict `password` + `ssh/*` to specific consumers

### Placeholders
- `<host>` — short, stable hostname (`host01`, `fw-primary`) — not FQDN, not IP
- `<user>` — local login name on that host (`admin`, `root`, `opsuser`)
- `<consumer>` — the agent or service that owns the SSH key (`example-agent`, `ansible`, `human:<handle>`)

## `_meta` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | ✅ | Login name (redundant with path; stored for convenience) |
| `uid` | int | optional | Local UID |
| `gid` | int | optional | Primary GID |
| `shell` | string | optional | Login shell (`/bin/sh`, `/bin/bash`, `/sbin/nologin`) |
| `home` | string | optional | Home directory |
| `groups` | string[] | optional | Supplementary groups |
| `sudoer` | bool | optional | In sudoers? |
| `sudoer_nopasswd` | bool | optional | NOPASSWD rule? |
| `sudoer_scope` | enum | optional | `blanket` \| `whitelist` \| `none` |
| `sudoer_whitelist_file` | string | optional | Path to sudoers.d drop-in (if any) |
| `authorized_keys` | object[] | ✅ | Inventory of SSH pubkeys installed on the host for this user (drift detection) |
| `notes` | string | optional | Free-form context |
| `created_at` | ISO-8601 UTC | ✅ | First-write timestamp |
| `updated_at` | ISO-8601 UTC | ✅ | Last-update timestamp |
| `updated_by` | string | ✅ | Actor (`<actor>@<workstation>`, human handle, agent name) |

### `authorized_keys[]` entry schema

Each entry tracks one line in the user's `~/.ssh/authorized_keys` file. This is an **inventory record** (what SHOULD be on the host), not a source of truth for the private keys themselves (those live under `ssh/<consumer>`).

| Field | Type | Required | Description |
|---|---|---|---|
| `consumer` | string | ✅ | Matches `ssh/<consumer>` path segment, or `human:<handle>` |
| `key_type` | enum | ✅ | `ed25519` \| `rsa` \| `ecdsa` |
| `fingerprint` | string | ✅ | `SHA256:<base64>` — cross-reference with `ssh/<consumer>.fingerprint` |
| `comment` | string | optional | SSH key comment field |
| `installed_at` | ISO-8601 UTC | ✅ | When pasted into authorized_keys |
| `installed_by` | string | ✅ | Who pasted it |
| `options` | string | optional | Leading ssh options (`no-port-forwarding,from="..."`) |

### Drift detection pattern
```
1. Read _meta.authorized_keys[] — expected fingerprints
2. SSH to host, run ssh-keygen -lf on each line of ~/.ssh/authorized_keys
3. Diff fingerprints: missing, extra, rotated
4. Report drift; human approves corrective action
```

## `password` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `password` | string | ✅ | Plaintext — Vault-encrypted at rest |
| `rotated_at` | ISO-8601 UTC | ✅ | Timestamp of current version |
| `rotated_by` | string | ✅ | Actor |
| `rotation_reason` | enum | ✅ | `initial-bootstrap` \| `scheduled-rotation` \| `compromise` \| `policy-upgrade` |
| `length` | int | optional | Advisory length hint (for sanity checks) |
| `notes` | string | optional | Free-form context |

**Never** store password hashes — that breaks consumer login. Vault encryption at rest is the protection layer.

## `ssh/<consumer>` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `consumer` | string | ✅ | Matches path segment |
| `private_key` | string | ✅ | OpenSSH PEM — full header/footer |
| `public_key` | string | ✅ | OpenSSH pubkey line |
| `fingerprint` | string | ✅ | `SHA256:<base64>` (from `ssh-keygen -lf`) |
| `key_type` | enum | ✅ | `ed25519` (preferred) \| `rsa` \| `ecdsa` |
| `local_cache_path` | string | optional | e.g. `~/.secrets/ssh/<host>_<consumer>` |
| `rotated_at` | ISO-8601 UTC | ✅ | Timestamp of current version |
| `rotated_by` | string | ✅ | Actor |
| `rotation_reason` | enum | ✅ | `initial-bootstrap` \| `scheduled-rotation` \| `compromise` \| `key-loss` \| `policy-upgrade` |

**Never** store passphrases here. Vault encryption at rest is the protection layer.

## Operations

### 1. Read metadata (safe — no secrets)
```
vault_secret_read path=network/hosts/<host>/users/<user>/_meta
```
Displays user facts, sudo state, and the `authorized_keys[]` inventory. Safe to print in full.

### 2. Read password (sensitive — explicit confirmation)
```
vault_secret_read path=network/hosts/<host>/users/<user>/password
```
Display ONLY `rotated_at`, `rotated_by`, `rotation_reason` by default. The `password` field requires an explicit "show password" confirmation from the user and MUST NOT be logged, printed to tool-call arguments, or included in conversation summaries.

### 3. Read SSH key (private key sensitive)
```
vault_secret_read path=network/hosts/<host>/users/<user>/ssh/<consumer>
```
Display ONLY `public_key`, `fingerprint`, `key_type`, `rotated_at`, `rotated_by`, `rotation_reason`. The `private_key` field requires explicit confirmation AND is only extracted to a local mode-600 file, never shown in chat.

### 4. Initial bootstrap (new user)
1. Write `_meta` with uid/gid/shell/groups/sudo state and an empty `authorized_keys: []`
2. Obtain password from clipboard (`pbpaste`) or a local file — NEVER via chat, NEVER via tool-call argv
3. **Sanity-check the password** (no embedded newlines, no shell metacharacters from prior copy-paste mistakes, length within expected range)
4. Write `password` with `rotation_reason: initial-bootstrap`
5. For each consumer that needs SSH access:
   a. Generate keypair locally: `ssh-keygen -t ed25519 -N '' -C "<consumer>@<host>:<ts>" -f ~/.secrets/ssh/<host>_<consumer>`
   b. Write `ssh/<consumer>` via file-stdin (never argv)
   c. Install pubkey on target host (`~/.ssh/authorized_keys` or Web UI)
   d. Append to `_meta.authorized_keys[]` with `{consumer, key_type, fingerprint, installed_at, installed_by}`
6. Re-read `_meta` + `password` metadata (not value) to confirm

### 5. Rotate password
1. Generate new password locally (24+ chars, random) or accept user-supplied via clipboard
2. Sanity-check (no newlines, no junk)
3. Update the password on the target host out-of-band (`passwd`, Web UI) — NEVER pipe through tool args
4. `vault_secret_write` new payload with `rotation_reason: scheduled-rotation` (or `compromise`)
5. Old version remains in KV v2 version history; `vault_secret_metadata` for audit
6. After soak period (default 7 days), `vault_secret_destroy` old version(s)
7. Update `_meta.updated_at` + `updated_by`

### 6. Rotate SSH key (per consumer)
1. Generate new keypair locally — timestamped new file path
2. Install new pubkey on target host **alongside** old one
3. Append new entry to `_meta.authorized_keys[]`
4. Update consumers (env vars, wrapper scripts) to point at new key
5. Verify consumers are healthy
6. Remove old pubkey from host
7. Remove old entry from `_meta.authorized_keys[]`
8. `vault_secret_write ssh/<consumer>` with new key + `rotation_reason: scheduled-rotation`
9. After soak, `vault_secret_destroy` old version

### 7. Retire a user
1. Remove user from host out of band (`pw userdel` FreeBSD, `userdel` Linux)
2. For each `ssh/<consumer>`: `vault_secret_delete` then `vault_secret_destroy` after retention
3. `vault_secret_delete password`, then `destroy` after retention
4. `vault_secret_delete _meta`, then `destroy` after retention

### 8. Retire a single SSH consumer (not the whole user)
1. Remove that consumer's pubkey from `authorized_keys` on host
2. Remove matching entry from `_meta.authorized_keys[]`
3. `vault_secret_delete ssh/<consumer>`, then `destroy` after retention
4. Keep `password` and other `ssh/*` entries intact

### 9. List users on a host
```
vault_secret_list path=network/hosts/<host>/users/
```

### 10. List SSH consumers for a user
```
vault_secret_list path=network/hosts/<host>/users/<user>/ssh/
```

## Required MCP tools

- `vault_secret_read`
- `vault_secret_write`
- `vault_secret_list`
- `vault_secret_metadata`
- `vault_secret_delete`
- `vault_secret_destroy` (explicit confirmation)

## Safety rules

- **Password handling**: plaintext password is high-sensitivity. It MUST be:
  - Sourced from clipboard (`pbpaste`) or file, never typed into chat
  - Passed via stdin / file path, never via command argument
  - Sanity-checked for contamination (no `pbcopy`/`printf`/`echo` substrings, no embedded newlines, no leading/trailing whitespace) — this catches the classic "clipboard held the shell instruction instead of the password" mistake
  - Filtered out of every read unless user explicitly requests it
  - Never in commit messages, logs, or summaries
  - When printing any output that might contain the password, apply a `.replace(pw, '<REDACTED>')` pass as defense-in-depth
- **SSH private key handling**: same rules as password, plus:
  - Private key always extracted to a mode-600 local file, never printed inline
  - Use `ssh-keygen -lf` for fingerprint comparison — never parse or display the key itself
- **Every write MUST set `rotated_by` + `rotation_reason`** (for password and `ssh/<consumer>`) or `updated_by` (for `_meta`) — audit trail is mandatory
- **Use `compromise`** when the secret was leaked (chat echo, argv log, screenshot, git history, Vault UI paste mistake, etc.) and open an issue noting the incident
- **`authorized_keys[]` drift**: if the host has a pubkey that isn't in `_meta.authorized_keys[]`, stop and alert the user — could be an unauthorized key
- **Confirm path with user** before every write (typos create orphan entries)

## Example — bootstrap a new host user

```
User: bootstrap user <user> on <host> with a password and an SSH key for <consumer>
Agent:
  1. Ask for user facts (uid, groups, shell, sudo state)
  2. vault_secret_write path=network/hosts/<host>/users/<user>/_meta data={
       username: "<user>",
       uid: <uid>,
       gid: <gid>,
       shell: "/bin/sh",
       home: "/home/<user>",
       groups: ["<group1>", "<group2>"],
       sudoer: true,
       sudoer_nopasswd: true,
       sudoer_scope: "whitelist",
       sudoer_whitelist_file: "/usr/local/etc/sudoers.d/<user>",
       authorized_keys: [],
       notes: "<free-form>",
       created_at: "<iso-ts>",
       updated_at: "<iso-ts>",
       updated_by: "<actor>@<workstation> (bootstrap)"
     }
  3. Ask user to place password on clipboard (pbcopy)
  4. Sanity-check via pbpaste | od -c (agent shows length only, not value)
  5. vault_secret_write path=network/hosts/<host>/users/<user>/password data={
       password: <from stdin, never argv>,
       rotated_at: "<iso-ts>",
       rotated_by: "<actor>@<workstation> (initial bootstrap)",
       rotation_reason: "initial-bootstrap",
       length: <n>
     }
  6. ssh-keygen -t ed25519 -N '' -C "<consumer>@<host>:<ts>" -f ~/.secrets/ssh/<host>_<consumer>
  7. vault_secret_write path=network/hosts/<host>/users/<user>/ssh/<consumer> data={
       consumer: "<consumer>",
       private_key: <from file, stdin>,
       public_key: <from file>,
       fingerprint: "SHA256:<base64>",
       key_type: "ed25519",
       local_cache_path: "~/.secrets/ssh/<host>_<consumer>",
       rotated_at: "<iso-ts>",
       rotated_by: "<actor>@<workstation> (ssh bootstrap)",
       rotation_reason: "initial-bootstrap"
     }
  8. Print pubkey to user for manual installation on <host>
  9. After user confirms install, update _meta.authorized_keys[] with the entry
 10. Verify with vault_secret_list + vault_secret_read (metadata only)
 11. Clear clipboard: pbcopy </dev/null
```

## Related skills

- `vault-ssh-keys` — SSH keypair operations (generate, fingerprint, store, rotate)
- `vault-secret-management` — generic KV v2 CRUD
