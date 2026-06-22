---
name: vault-secret-management
description: Interactive Vault secret CRUD — read, write, list, delete, undelete, destroy with path navigation
command: /vault-secrets
auto_invoke: false
---

# Vault Secret Management

Interactive workflow for managing secrets in Vault KV v2.

## Available Operations

1. **List** — `vault_secret_list` — Browse secret keys at a path
2. **Read** — `vault_secret_read` — Read a secret (latest or specific version)
3. **Write** — `vault_secret_write` — Create or update a secret (supports CAS)
4. **Delete** — `vault_secret_delete` — Soft-delete secret versions
5. **Undelete** — `vault_secret_undelete` — Recover soft-deleted versions
6. **Destroy** — `vault_secret_destroy` — Permanently destroy versions (irreversible)
7. **Metadata** — `vault_secret_metadata` — View version history and settings

## Workflow

1. Ask the user which operation they want to perform
2. If listing, start at root path and navigate into subpaths
3. For write operations, confirm the data before writing
4. For destroy operations, emphasize irreversibility and require explicit confirmation
5. Support custom mount paths (default: `kv`)

## Safety

- Always show the user what will be modified before writing
- For `vault_secret_destroy`: warn that this is permanent and cannot be undone
- For `vault_secret_write` with CAS: explain optimistic locking behavior
- Never log or display secret values in conversation summaries
