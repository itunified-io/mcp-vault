/**
 * Token management tools (3 tools).
 */

import { z } from "zod";
import type { IVaultClient } from "../client/types.js";
import { ConfirmSchema } from "../utils/validation.js";
import type { TokenLookupResponse } from "../client/types.js";

const TokenCreateSchema = z.object({
  policies: z.array(z.string()).optional(),
  ttl: z.string().optional(),
  display_name: z.string().optional(),
  renewable: z.boolean().optional(),
  no_parent: z.boolean().optional(),
  confirm: ConfirmSchema,
});

const TokenRevokeSchema = z.object({
  token: z.string().min(1, "Token is required"),
  confirm: ConfirmSchema,
});

export const tokenToolDefinitions = [
  {
    name: "vault_token_lookup_self",
    description: "Look up information about the current authentication token.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_token_create",
    description: "Create a new child token with specified policies and TTL. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        policies: { type: "array", items: { type: "string" }, description: "Policies to attach" },
        ttl: { type: "string", description: "Time-to-live (e.g., '1h', '24h', '768h')" },
        display_name: { type: "string", description: "Display name for the token" },
        renewable: { type: "boolean", description: "Whether the token is renewable" },
        no_parent: { type: "boolean", description: "Create an orphan token (not child of current)" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["confirm"],
    },
  },
  {
    name: "vault_token_revoke",
    description: "Revoke a token and all its child tokens. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "Token to revoke" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["token", "confirm"],
    },
  },
];

export async function handleTokenTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_token_lookup_self": {
        const result = await client.get<TokenLookupResponse>("/auth/token/lookup-self");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_token_create": {
        const parsed = TokenCreateSchema.parse(args);
        const body: Record<string, unknown> = {};
        if (parsed.policies) body.policies = parsed.policies;
        if (parsed.ttl) body.ttl = parsed.ttl;
        if (parsed.display_name) body.display_name = parsed.display_name;
        if (parsed.renewable !== undefined) body.renewable = parsed.renewable;
        if (parsed.no_parent) body.no_parent = parsed.no_parent;
        const result = await client.post("/auth/token/create", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_token_revoke": {
        const parsed = TokenRevokeSchema.parse(args);
        await client.post("/auth/token/revoke", { token: parsed.token });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ revoked: true }, null, 2),
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
