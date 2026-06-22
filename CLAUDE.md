# mcp-vault — CLAUDE.md

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Code Conventions](#code-conventions)
- [Security](#security)
- [Design/Plan Documents — MANDATORY](#designplan-documents--mandatory)
- [CHANGELOG.md — MANDATORY](#changelogmd--mandatory)
- [Versioning & Releases (CalVer)](#versioning--releases-calver)
- [Git Workflow](#git-workflow)
- [Language](#language)
- [Development Setup](#development-setup)
- [Testing](#testing)

## Project Overview

Slim HashiCorp Vault MCP Server for managing secrets, policies, auth methods, tokens, and system health via Vault HTTP API.

**No SSH. No shell execution. API-only. 4 runtime dependencies.**

## Architecture

```
src/
  index.ts                   # MCP Server entry point (stdio + SSE transport)
  server.ts                  # createServer() factory with ToolMiddleware
  transport.ts               # Transport config validation + auth middleware
  types.ts                   # Shared types (ToolResult, ToolHandler, ToolMiddleware)
  client/
    types.ts                 # IVaultClient interface + Vault API response types
    vault-token-client.ts    # Static token auth (VAULT_TOKEN)
    client-factory.ts        # Client selection from env vars + getKvMount()
  tools/
    secrets.ts               # KV v2 secret management (7 tools)
    engines.ts               # Secrets engine management (4 tools)
    auth.ts                  # Auth method management (5 tools)
    policies.ts              # ACL policy CRUD (4 tools)
    tokens.ts                # Token management (3 tools)
    system.ts                # Health, seal, leader (3 tools)
    diagnostics.ts           # API verify, audit list (2 tools)
  utils/
    errors.ts                # VaultApiError + extractError()
    validation.ts            # Shared Zod schemas (paths, mounts, policy names)
tests/                       # Vitest unit tests (mirror src/ structure)
docs/
  plans/                     # Design/plan documents
```

## Code Conventions

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig.json)
- All tool parameters validated with Zod schemas
- Generically typed API client (`get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()`, `deleteVoid()`, `list<T>()`)
- No `any` types — use `unknown` and narrow

### Tool Design
- **Granular tools**: one MCP tool per operation (e.g., `vault_secret_read`)
- Tool naming: `vault_<domain>_<action>`
- Each tool has its own Zod input schema and clear description
- Destructive operations require `confirm: true` parameter
- Response format: always `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`

### Vault API Specifics
- Auth: `X-Vault-Token` header (static token, K8s JWT, or AppRole)
- Base URL: configurable via `VAULT_ADDR` env var
- KV v2 path segments: mount + `/data/`, `/metadata/`, `/delete/`, `/undelete/`, `/destroy/` between mount and path
- LIST verb: Vault uses HTTP LIST method (or GET with `?list=true`)
- Namespace header: `X-Vault-Namespace` when `VAULT_NAMESPACE` configured

### Dependencies
- **4 runtime dependencies**: `@modelcontextprotocol/sdk`, `axios`, `express`, `zod`
- No SSH libraries, no Redis, no PostgreSQL
- Dev: `typescript`, `vitest`, `@types/node`, `@types/express`

## Security

- **Transport**: stdio (default) or SSE with mandatory Bearer token auth (`crypto.timingSafeEqual`)
- **Authentication**: Vault token exclusively via environment variables. Never hardcoded, logged, or committed.
- **No SSH**: Exclusively Vault HTTP API
- **Input validation**: Zod schemas for all tool parameters
- **Error handling**: No credential leaks in error messages (Vault token never appears in logs or errors)
- **Credentials**: Never hardcoded, never logged, never in git
- **Secret Redaction — MANDATORY**: When using `grep`, `cat`, `sed`, `awk`, shell scripts, or any tool that reads/displays file contents containing secrets (`.env`, credentials, API keys, tokens, passwords), **ALWAYS redact the secret values** in output. Never display raw secret values in terminal output, logs, conversation context, or commit messages.
- **MCP Registry Tokens**: `.mcpregistry_*` files are gitignored AND npmignored. Never commit or publish registry auth tokens.
- **Pre-Publish Security Scan — MANDATORY**: `prepublishOnly` hook runs `scripts/prepublish-check.js` before every `npm publish`. Blocks publish if forbidden files (`.mcpregistry_*`, `.env`, `.pem`, `.key`, `credentials`) are in the tarball. Never bypass with `--ignore-scripts`.
- **Public Repo Documentation Policy — MANDATORY**: This is a **public repository**. All documentation, code examples, test data, and commit messages MUST use only generic placeholders:
  - Vault addresses: `https://vault.example.com:8200`
  - Tokens: `hvs.your-vault-token`, `your-token-here`
  - Secrets: `my-secret-value`, `test-value`
  - Paths: `secret/data/my-app`, `kv/data/example`
  - **NEVER** include real Vault addresses, tokens, secret values, or internal topology
  - Infrastructure-specific documentation belongs in the private `itunified-io/infrastructure` repo

## Design/Plan Documents — MANDATORY

- **Every significant change MUST have a design/plan document** in `docs/plans/`
- Naming: `docs/plans/<NNN>-<short-description>.md`
- The design doc MUST be referenced in the corresponding GitHub issue (bidirectional link)
- Design docs contain: problem, solution, prerequisites, execution steps, rollback, verification
- Trivial changes (typos, minor doc updates) are exempt

## CHANGELOG.md — MANDATORY

- **`CHANGELOG.md` MUST exist and MUST be kept up to date**
- **Every PR merge MUST add a new entry** before tagging/releasing
- Format: CalVer date header (`## v2026.03.16.1`) followed by a list of changes with issue references
- Never skip CHANGELOG updates — they are the source of truth for what changed and when

## Versioning & Releases (CalVer)

- Schema: `YYYY.MM.DD.TS` (e.g., `2026.03.16.1`)
- `package.json`: npm-compatible without leading zeros (`2026.3.16`)
- Git tags: `v2026.03.16.1` (leading zeros for sorting)

### Release Workflow — MANDATORY after every PR merge
1. **Update CHANGELOG.md** with new version entry
2. Update `package.json` version if date changed
3. Create annotated git tag: `git tag -a v2026.03.16.1 -m "v2026.03.16.1: <summary>"`
4. Push tag: `git push origin --tags`
5. Create GitHub release: `gh release create v2026.03.16.1 --title "v2026.03.16.1 — <title>" --notes "<release notes>"`
6. Release notes must list what changed and reference closed issues
7. **Publish to npm**: `npm run build && npm publish --access public` (package: `vault-mcp`)

### npm Publishing — MANDATORY
- npm package name: `vault-mcp` (unscoped, published to npmjs.com)
- **Every release MUST be published to npm** after tagging
- Ensure `npm run build` succeeds before publishing
- Verify with `npm view vault-mcp version` after publishing
- Auth: granular access token set via `npm config set //registry.npmjs.org/:_authToken TOKEN`
- **`.npmignore` MUST exclude** `.mcpregistry_*` files — verify before every publish that tokens are not in tarball

## Git Workflow

- **NEVER work on main** — all changes via feature branches + PR
- **Branching**: `feature/<issue-nr>-<description>`, `fix/<issue-nr>-<description>`, `chore/<description>`
- **Worktree naming**: `.claude/worktrees/<branch-name>`
- **GitHub Issues mandatory**: every change must have an associated GH issue
- **Commit messages**: must reference GH issue — `feat: add secret management tools (#3)` or `fix: handle 404 on secret read (#5)`
- **No commit without issue reference** (exceptions: initial setup, typo fixes)
- **PR workflow**: feature branch -> `gh pr create` -> review -> merge into main
- **Acceptance Criteria Gate — MANDATORY**:
  - All acceptance criteria in the associated GH issue MUST be checked and verified as successful before merge to `main`
  - Verification is active: criteria must be actually tested, not assumed to pass
  - Includes: tests pass (`npm test`), build succeeds (`npm run build`), CHANGELOG updated, docs updated
  - If any criterion cannot be satisfied, the PR must NOT be merged
- **After PR merge: branch/worktree cleanup is mandatory** — `git branch -d <branch>`, `git remote prune origin`, remove worktree

### Bug Fixes — MANDATORY Workflow
- **Every bug fix MUST have a GitHub issue** with appropriate labels (`bug`, scope labels)
- Issue-first: create issue → branch (`fix/<issue-nr>-<description>`) → fix → PR → merge
- Bug fix commits must reference the issue: `fix: <description> (#<nr>)`
- CHANGELOG entry required for every bug fix

## Language

- All documentation, code comments, commit messages: **English only**

## Development Setup

```bash
# Prerequisites: Node.js >= 20, npm

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Vault address and token

# Build
npm run build

# Test
npm test

# Run (stdio transport)
node dist/index.js
```

## Testing

- Unit tests with vitest (mocked API responses)
- Zod schema validation for invalid inputs
- Error handling for API errors (401, 403, 404, 500)
- Run: `npm test`
