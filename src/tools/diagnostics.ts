/**
 * Diagnostics tools (2 tools).
 */

import type { IVaultClient } from "../client/types.js";
import type { HealthResponse, AuditDevice } from "../client/types.js";

export const diagnosticsToolDefinitions = [
  {
    name: "vault_api_verify",
    description:
      "Verify Vault API connectivity and authentication. Returns connection status, server version, and seal state.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_audit_list",
    description: "List all enabled audit devices in Vault.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

export async function handleDiagnosticsTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_api_verify": {
        const start = Date.now();
        const health = await client.get<HealthResponse>("/sys/health");
        const latencyMs = Date.now() - start;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  connected: true,
                  addr: client.addr,
                  version: health.version,
                  initialized: health.initialized,
                  sealed: health.sealed,
                  standby: health.standby,
                  cluster_name: health.cluster_name,
                  latency_ms: latencyMs,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "vault_audit_list": {
        const result = await client.get<Record<string, AuditDevice>>("/sys/audit");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
