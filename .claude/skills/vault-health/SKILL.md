---
name: vault-health
description: Vault health dashboard — seal status, auth methods, engines, policies, leader, audit devices
command: /vault-health
auto_invoke: false
---

# Vault Health Dashboard

Run a comprehensive health check against the connected Vault instance.

## Steps

1. **API Connectivity** — `vault_api_verify`
   - Confirm connection to Vault, measure latency
   - Report version, seal state, cluster name

2. **Seal Status** — `vault_seal_status`
   - Report sealed/unsealed, threshold, shares, progress

3. **Leader Status** — `vault_leader`
   - HA enabled, is_self, leader address

4. **Health** — `vault_health`
   - Initialized, sealed, standby, version

5. **Auth Methods** — `vault_auth_list`
   - List all enabled auth methods with types

6. **Secrets Engines** — `vault_engine_list`
   - List all mounted engines with types and paths

7. **Policies** — `vault_policy_list`
   - List all ACL policies

8. **Audit Devices** — `vault_audit_list`
   - List enabled audit devices

## Output

Present results as a structured dashboard:

```
Vault Health Dashboard
━━━━━━━━━━━━━━━━━━━━━
Connection:  ✅ Connected (latency: XXms)
Version:     1.15.x
Seal State:  🔓 Unsealed (threshold: 3/5)
HA Leader:   ✅ This node
Auth:        3 methods (token, kubernetes, approle)
Engines:     4 mounts (kv, transit, pki, sys)
Policies:    5 ACL policies
Audit:       1 device (file)
```
