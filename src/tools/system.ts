/**
 * System health and status tools (3 tools).
 */

import type { IVaultClient } from "../client/types.js";
import type { HealthResponse, SealStatusResponse, LeaderResponse } from "../client/types.js";

export const systemToolDefinitions = [
  {
    name: "vault_health",
    description:
      "Get Vault health status including seal state, initialization, version, cluster name, and replication mode.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_seal_status",
    description: "Get detailed seal/unseal status including key shares, threshold, and progress.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_leader",
    description: "Get HA leader status including leader address, active time, and standby state.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

export async function handleSystemTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_health": {
        const result = await client.get<HealthResponse>("/sys/health");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_seal_status": {
        const result = await client.get<SealStatusResponse>("/sys/seal-status");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_leader": {
        const result = await client.get<LeaderResponse>("/sys/leader");
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
