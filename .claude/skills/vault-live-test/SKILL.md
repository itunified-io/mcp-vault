---
name: vault-live-test
description: Live test all 28 Vault MCP tools against a real Vault instance, report results
command: /vault-test
auto_invoke: false
---

# Vault Live Test

Test all 28 tools against the connected Vault instance. Optionally filter by domain.

## Usage

- `/vault-test` — Test all 28 tools
- `/vault-test secrets` — Test only secret tools
- `/vault-test system` — Test only system/health tools

## Domains

| Domain | Tools | Test Prefix |
|--------|-------|-------------|
| secrets | 7 | `MCP-TEST/vault/` secret path |
| engines | 4 | Read-only (list, get) |
| auth | 5 | Read-only (list, read config) |
| policies | 4 | `mcp-test-vault-policy` |
| tokens | 3 | Creates + revokes test token |
| system | 3 | Read-only (health, seal, leader) |
| diagnostics | 2 | Read-only (verify, audit list) |

## Test Flow

### 1. Connectivity
- `vault_api_verify` — Confirm connection

### 2. System (read-only)
- `vault_health` — Check health
- `vault_seal_status` — Check seal
- `vault_leader` — Check leader

### 3. Diagnostics (read-only)
- `vault_audit_list` — List audit devices

### 4. Engines (read-only)
- `vault_engine_list` — List engines
- `vault_engine_get` — Get KV engine config

### 5. Auth (read-only)
- `vault_auth_list` — List auth methods
- `vault_auth_read_config` — Read token auth config

### 6. Policies (CRUD cycle)
- `vault_policy_write` — Create `mcp-test-vault-policy`
- `vault_policy_list` — Verify it appears
- `vault_policy_read` — Read it back
- `vault_policy_delete` — Clean up

### 7. Secrets (full lifecycle)
- `vault_secret_write` — Write to `MCP-TEST/vault/live-test`
- `vault_secret_read` — Read it back
- `vault_secret_list` — List keys
- `vault_secret_metadata` — Check metadata
- `vault_secret_delete` — Soft-delete
- `vault_secret_undelete` — Recover
- `vault_secret_destroy` — Permanently destroy

### 8. Tokens
- `vault_token_lookup_self` — Inspect current token
- `vault_token_create` — Create child token
- `vault_token_revoke` — Revoke child token

## Cleanup

All test artifacts are cleaned up:
- Secret `MCP-TEST/vault/live-test` — destroyed
- Policy `mcp-test-vault-policy` — deleted
- Child token — revoked

## Reporting

Post results summary to Slack channel C0ALHK18VC5.

Format:
```
Vault MCP Live Test — YYYY-MM-DD HH:MM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 28/28 tools passed
Duration: Xs

Domain breakdown:
  secrets:     7/7 ✅
  engines:     4/4 ✅
  auth:        5/5 ✅
  policies:    4/4 ✅
  tokens:      3/3 ✅
  system:      3/3 ✅
  diagnostics: 2/2 ✅
```
