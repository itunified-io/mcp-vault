/**
 * Client factory — selects auth method from environment variables.
 * Priority: Token (simplest for v1, K8s + AppRole added later).
 */

import type { IVaultClient } from "./types.js";
import { VaultTokenClient } from "./vault-token-client.js";

export function createClientFromEnv(): IVaultClient {
  const addr = process.env["VAULT_ADDR"];
  if (!addr) {
    throw new Error(
      "VAULT_ADDR is required. Set it to your Vault server URL (e.g., http://127.0.0.1:8200).",
    );
  }

  const namespace = process.env["VAULT_NAMESPACE"];
  const timeout = parseInt(process.env["VAULT_TIMEOUT"] ?? "30000", 10);
  const tlsSkipVerify = process.env["VAULT_TLS_SKIP_VERIFY"] === "true";

  // Priority: Token auth (K8s + AppRole auth added in Phase 2)
  const token = process.env["VAULT_TOKEN"];
  if (token) {
    return new VaultTokenClient({ addr, token, namespace, timeout, tlsSkipVerify });
  }

  throw new Error(
    "Vault authentication required. Set VAULT_TOKEN environment variable.",
  );
}

/**
 * Returns the configured KV v2 mount path (default: "kv").
 */
export function getKvMount(): string {
  return process.env["VAULT_KV_MOUNT"] ?? "kv";
}
