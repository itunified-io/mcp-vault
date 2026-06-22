# Changelog

All notable changes to this project will be documented in this file.

## v2026.03.16.1

Initial release — 28 tools across 7 domains.

### Added
- **Secrets / KV v2** (7 tools): read, write (CAS-safe), delete, undelete, destroy, list, metadata
- **Engine Management** (4 tools): list, get, enable, disable
- **Auth Methods** (5 tools): list, enable, disable, read config, K8s role read
- **Policy Management** (4 tools): list, read, write, delete
- **Token Management** (3 tools): lookup self, create, revoke
- **System / Health** (3 tools): health, seal status, leader
- **Diagnostics** (2 tools): API verify, audit list
- Multi-auth client layer (static token; K8s JWT + AppRole planned)
- Dual transport: stdio + SSE with Bearer token auth
- ToolMiddleware hook for enterprise extensions
- 52 unit tests
- CLAUDE.md, README.md with full tool reference
- Pre-publish security scan (ADR-0026)
- Skills: vault-health, vault-secrets, vault-test, vault-setup
