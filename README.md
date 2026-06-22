# mcp-vault

Secure MCP access for HashiCorp Vault — 28 tools for secrets, policies, auth methods, tokens, and system health via Vault HTTP API.

**No SSH. No shell execution. API-only. 4 runtime dependencies.**

## Features

- **28 tools** across 7 domains: Secrets, Engines, Auth, Policies, Tokens, System, Diagnostics
- **KV v2 full lifecycle**: read, write (CAS-safe), delete, undelete, destroy, list, metadata
- **Multi-auth support**: Static token (K8s JWT and AppRole planned)
- **Zod-validated inputs**: Every parameter validated before reaching Vault
- **Enterprise-ready**: ToolMiddleware hook for RBAC, audit logging, policy engine
- **Dual transport**: stdio (default) + SSE with Bearer token auth
- **Zero shell execution**: Pure Vault HTTP API

## Quick Start

### stdio (recommended for Claude Code)

```bash
# Install globally
npm install -g vault-mcp

# Or run directly
npx vault-mcp
```

Configure in your MCP client:

```json
{
  "mcpServers": {
    "vault": {
      "command": "npx",
      "args": ["-y", "vault-mcp"],
      "env": {
        "VAULT_ADDR": "https://vault.example.com:8200",
        "VAULT_TOKEN": "your-vault-token"
      }
    }
  }
}
```

### SSE (for remote/shared access)

```bash
MCP_TRANSPORT=sse MCP_PORT=3000 MCP_AUTH_TOKEN=your-bearer-token npx vault-mcp
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAULT_ADDR` | Yes | — | Vault server URL |
| `VAULT_TOKEN` | Yes* | — | Static token auth |
| `VAULT_NAMESPACE` | No | — | Vault namespace (Enterprise) |
| `VAULT_KV_MOUNT` | No | `kv` | Default KV v2 mount path |
| `VAULT_TIMEOUT` | No | `30000` | Request timeout (ms) |
| `MCP_TRANSPORT` | No | `stdio` | Transport: `stdio` or `sse` |
| `MCP_PORT` | No | `3000` | SSE server port |
| `MCP_HOST` | No | `127.0.0.1` | SSE server host |
| `MCP_AUTH_TOKEN` | SSE only | — | Bearer token for SSE auth |

*K8s JWT and AppRole auth planned for future release.

## Tools (28)

### Secrets / KV v2 (7 tools)

| Tool | Description |
|------|-------------|
| `vault_secret_read` | Read secret (latest or specific version) |
| `vault_secret_write` | Create/update secret (CAS-safe) |
| `vault_secret_delete` | Soft-delete latest version(s) |
| `vault_secret_undelete` | Recover soft-deleted versions |
| `vault_secret_destroy` | Permanently destroy version(s) |
| `vault_secret_list` | List secret keys at a path |
| `vault_secret_metadata` | Read metadata (versions, cas_required, etc.) |

### Engine Management (4 tools)

| Tool | Description |
|------|-------------|
| `vault_engine_list` | List all mounted secrets engines |
| `vault_engine_get` | Get config of a specific engine |
| `vault_engine_enable` | Enable a new secrets engine |
| `vault_engine_disable` | Disable/unmount an engine |

### Auth Methods (5 tools)

| Tool | Description |
|------|-------------|
| `vault_auth_list` | List enabled auth methods |
| `vault_auth_enable` | Enable a new auth method |
| `vault_auth_disable` | Disable an auth method |
| `vault_auth_read_config` | Read auth method configuration |
| `vault_auth_k8s_role_read` | Read a Kubernetes auth role |

### Policy Management (4 tools)

| Tool | Description |
|------|-------------|
| `vault_policy_list` | List all ACL policies |
| `vault_policy_read` | Read a policy's HCL rules |
| `vault_policy_write` | Create/update a policy |
| `vault_policy_delete` | Delete a policy |

### Token Management (3 tools)

| Tool | Description |
|------|-------------|
| `vault_token_lookup_self` | Inspect the current token |
| `vault_token_create` | Create a new child token |
| `vault_token_revoke` | Revoke a token |

### System / Health (3 tools)

| Tool | Description |
|------|-------------|
| `vault_health` | Health status (seal state, init, version) |
| `vault_seal_status` | Detailed seal/unseal progress |
| `vault_leader` | HA leader status |

### Diagnostics (2 tools)

| Tool | Description |
|------|-------------|
| `vault_api_verify` | Verify API connectivity + auth |
| `vault_audit_list` | List enabled audit devices |

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| vault-health | `/vault-health` | Health dashboard: seal status, auth methods, engines, leader |
| vault-secret-management | `/vault-secrets` | Interactive secret CRUD with path navigation |
| vault-live-test | `/vault-test` | Live test all 28 tools |
| vault-onboarding | `/vault-setup` | First-time setup: auth config, KV mount, first secret |

## Safety

Destructive operations require explicit `confirm: true`:
- `vault_secret_destroy` — permanently destroys secret versions
- `vault_engine_enable` / `vault_engine_disable`
- `vault_auth_enable` / `vault_auth_disable`
- `vault_policy_write` / `vault_policy_delete`
- `vault_token_create` / `vault_token_revoke`

## Architecture

```
src/
  index.ts          # CLI entry point (stdio + SSE)
  server.ts         # createServer() factory with ToolMiddleware
  transport.ts      # Transport config + auth middleware
  client/           # Vault HTTP client (multi-auth)
  tools/            # 7 tool modules (28 tools total)
  utils/            # Error handling + Zod schemas
```

The `createServer()` factory accepts optional `ToolMiddleware` for enterprise extensions (RBAC, audit, policy engine).

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run 52 unit tests
npm run typecheck    # Type-check without emit
```

## License

AGPL-3.0 — see [LICENSE](LICENSE) for details.

Commercial licenses available at [itunified.io/pricing](https://itunified.io/pricing).
