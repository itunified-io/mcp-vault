/**
 * Secrets engine management tools (4 tools).
 */

import { z } from "zod";
import type { IVaultClient } from "../client/types.js";
import { MountPathSchema, EngineTypeSchema, ConfirmSchema } from "../utils/validation.js";
import type { MountInfo } from "../client/types.js";

const EngineGetSchema = z.object({
  path: MountPathSchema,
});

const EngineEnableSchema = z.object({
  path: MountPathSchema,
  type: EngineTypeSchema,
  description: z.string().optional(),
  options: z.record(z.string()).optional(),
  confirm: ConfirmSchema,
});

const EngineDisableSchema = z.object({
  path: MountPathSchema,
  confirm: ConfirmSchema,
});

export const engineToolDefinitions = [
  {
    name: "vault_engine_list",
    description: "List all mounted secrets engines in Vault.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_engine_get",
    description: "Get configuration details for a specific secrets engine mount.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Mount path (e.g., 'kv', 'pki')" },
      },
      required: ["path"],
    },
  },
  {
    name: "vault_engine_enable",
    description: "Enable (mount) a new secrets engine at a given path. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Mount path" },
        type: { type: "string", description: "Engine type (kv, kv-v2, pki, transit, database, etc.)" },
        description: { type: "string", description: "Human-readable description" },
        options: { type: "object", description: "Engine-specific options (e.g., {'version': '2'} for kv-v2)" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["path", "type", "confirm"],
    },
  },
  {
    name: "vault_engine_disable",
    description:
      "Disable (unmount) a secrets engine. All secrets in this mount will be lost. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Mount path to disable" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["path", "confirm"],
    },
  },
];

export async function handleEngineTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_engine_list": {
        const result = await client.get<Record<string, MountInfo>>("/sys/mounts");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_engine_get": {
        const parsed = EngineGetSchema.parse(args);
        const result = await client.get<MountInfo>(`/sys/mounts/${parsed.path}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_engine_enable": {
        const parsed = EngineEnableSchema.parse(args);
        const body: Record<string, unknown> = { type: parsed.type };
        if (parsed.description) body.description = parsed.description;
        if (parsed.options) body.options = parsed.options;
        await client.post(`/sys/mounts/${parsed.path}`, body);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                enabled: true,
                path: parsed.path,
                type: parsed.type,
              }, null, 2),
            },
          ],
        };
      }

      case "vault_engine_disable": {
        const parsed = EngineDisableSchema.parse(args);
        await client.deleteVoid(`/sys/mounts/${parsed.path}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ disabled: true, path: parsed.path }, null, 2),
            },
          ],
        };
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
