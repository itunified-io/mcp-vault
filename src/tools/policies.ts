/**
 * ACL policy management tools (4 tools).
 */

import { z } from "zod";
import type { IVaultClient } from "../client/types.js";
import { PolicyNameSchema, ConfirmSchema } from "../utils/validation.js";

const PolicyReadSchema = z.object({
  name: PolicyNameSchema,
});

const PolicyWriteSchema = z.object({
  name: PolicyNameSchema,
  policy: z.string().min(1, "Policy HCL rules are required"),
  confirm: ConfirmSchema,
});

const PolicyDeleteSchema = z.object({
  name: PolicyNameSchema,
  confirm: ConfirmSchema,
});

export const policyToolDefinitions = [
  {
    name: "vault_policy_list",
    description: "List all ACL policies in Vault.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "vault_policy_read",
    description: "Read an ACL policy's HCL rules.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Policy name" },
      },
      required: ["name"],
    },
  },
  {
    name: "vault_policy_write",
    description: "Create or update an ACL policy with HCL rules. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Policy name" },
        policy: { type: "string", description: "Policy rules in HCL format" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["name", "policy", "confirm"],
    },
  },
  {
    name: "vault_policy_delete",
    description: "Delete an ACL policy. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Policy name to delete" },
        confirm: { type: "boolean", description: "Must be true" },
      },
      required: ["name", "confirm"],
    },
  },
];

export async function handlePolicyTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_policy_list": {
        const result = await client.list<{ data: { keys: string[] } }>("/sys/policies/acl");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_policy_read": {
        const parsed = PolicyReadSchema.parse(args);
        const result = await client.get(`/sys/policies/acl/${parsed.name}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_policy_write": {
        const parsed = PolicyWriteSchema.parse(args);
        await client.put(`/sys/policies/acl/${parsed.name}`, {
          policy: parsed.policy,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ written: true, name: parsed.name }, null, 2),
            },
          ],
        };
      }

      case "vault_policy_delete": {
        const parsed = PolicyDeleteSchema.parse(args);
        await client.deleteVoid(`/sys/policies/acl/${parsed.name}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ deleted: true, name: parsed.name }, null, 2),
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
