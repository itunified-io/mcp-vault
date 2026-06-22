/**
 * Auth method management tools (5 tools).
 */

import { z } from "zod";
import type { IVaultClient } from "../client/types.js";
import { MountPathSchema, AuthMethodTypeSchema, ConfirmSchema } from "../utils/validation.js";
import type { AuthMethod } from "../client/types.js";

const AuthEnableSchema = z.object({
  path: MountPathSchema,
  type: AuthMethodTypeSchema,
  description: z.string().optional(),
  confirm: ConfirmSchema,
});

const AuthDisableSchema = z.object({
  path: MountPathSchema,
  confirm: ConfirmSchema,
});

const AuthReadConfigSchema = z.object({
  method: MountPathSchema,
});

const AuthK8sRoleReadSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  mount: MountPathSchema.optional(),
});

export const authToolDefinitions = [
  {
    name: "vault_auth_list",
    description: "List all enabled auth methods in Vault.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_auth_enable",
    description: "Enable a new auth method at a given path. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Mount path for the auth method" },
        type: { type: "string", description: "Auth type (kubernetes, approle, oidc, ldap, etc.)" },
        description: { type: "string", description: "Human-readable description" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["path", "type", "confirm"],
    },
  },
  {
    name: "vault_auth_disable",
    description: "Disable an auth method. All associated tokens will be revoked. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Auth method mount path to disable" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["path", "confirm"],
    },
  },
  {
    name: "vault_auth_read_config",
    description: "Read the configuration of an auth method.",
    inputSchema: {
      type: "object" as const,
      properties: {
        method: { type: "string", description: "Auth method mount path (e.g., 'kubernetes')" },
      },
      required: ["method"],
    },
  },
  {
    name: "vault_auth_k8s_role_read",
    description: "Read a Kubernetes auth role configuration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Role name" },
        mount: { type: "string", description: "K8s auth mount path (optional, defaults to 'kubernetes')" },
      },
      required: ["name"],
    },
  },
];

export async function handleAuthTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_auth_list": {
        const result = await client.get<Record<string, AuthMethod>>("/sys/auth");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_auth_enable": {
        const parsed = AuthEnableSchema.parse(args);
        const body: Record<string, unknown> = { type: parsed.type };
        if (parsed.description) body.description = parsed.description;
        await client.post(`/sys/auth/${parsed.path}`, body);
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

      case "vault_auth_disable": {
        const parsed = AuthDisableSchema.parse(args);
        await client.deleteVoid(`/sys/auth/${parsed.path}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ disabled: true, path: parsed.path }, null, 2),
            },
          ],
        };
      }

      case "vault_auth_read_config": {
        const parsed = AuthReadConfigSchema.parse(args);
        const result = await client.get(`/auth/${parsed.method}/config`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_auth_k8s_role_read": {
        const parsed = AuthK8sRoleReadSchema.parse(args);
        const mount = parsed.mount ?? "kubernetes";
        const result = await client.get(`/auth/${mount}/role/${parsed.name}`);
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
