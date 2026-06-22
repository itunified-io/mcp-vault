/**
 * KV v2 secret management tools (7 tools).
 */

import { z } from "zod";
import type { IVaultClient } from "../client/types.js";
import { SecretPathSchema, MountPathSchema, ConfirmSchema } from "../utils/validation.js";
import { getKvMount } from "../client/client-factory.js";
import type { KvReadResponse, KvWriteResponse, KvMetadataResponse, KvListResponse } from "../client/types.js";

const SecretReadSchema = z.object({
  path: SecretPathSchema,
  version: z.number().int().positive().optional(),
  mount: MountPathSchema.optional(),
});

const SecretWriteSchema = z.object({
  path: SecretPathSchema,
  data: z.record(z.unknown()),
  cas: z.number().int().nonnegative().optional(),
  mount: MountPathSchema.optional(),
});

const SecretDeleteSchema = z.object({
  path: SecretPathSchema,
  versions: z.array(z.number().int().positive()).optional(),
  mount: MountPathSchema.optional(),
});

const SecretUndeleteSchema = z.object({
  path: SecretPathSchema,
  versions: z.array(z.number().int().positive()),
  mount: MountPathSchema.optional(),
});

const SecretDestroySchema = z.object({
  path: SecretPathSchema,
  versions: z.array(z.number().int().positive()),
  confirm: ConfirmSchema,
  mount: MountPathSchema.optional(),
});

const SecretListSchema = z.object({
  path: SecretPathSchema.optional(),
  mount: MountPathSchema.optional(),
});

const SecretMetadataSchema = z.object({
  path: SecretPathSchema,
  mount: MountPathSchema.optional(),
});

export const secretToolDefinitions = [
  {
    name: "vault_secret_read",
    description:
      "Read a secret from Vault KV v2 engine. Returns the secret data and metadata. Optionally specify a version number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path (e.g., 'myapp/config')" },
        version: { type: "number", description: "Specific version to read (optional, defaults to latest)" },
        mount: { type: "string", description: "KV mount path (optional, defaults to VAULT_KV_MOUNT or 'kv')" },
      },
      required: ["path"],
    },
  },
  {
    name: "vault_secret_write",
    description:
      "Write or update a secret in Vault KV v2 engine. Creates a new version. Supports CAS (Check-and-Set) for safe concurrent writes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path (e.g., 'myapp/config')" },
        data: { type: "object", description: "Secret key-value data to write" },
        cas: { type: "number", description: "Check-and-Set version (0 = create only, N = update only if current version is N)" },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
      required: ["path", "data"],
    },
  },
  {
    name: "vault_secret_delete",
    description:
      "Soft-delete a secret version from Vault KV v2. The data can be recovered with vault_secret_undelete.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path" },
        versions: {
          type: "array",
          items: { type: "number" },
          description: "Specific versions to delete (optional, defaults to latest)",
        },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
      required: ["path"],
    },
  },
  {
    name: "vault_secret_undelete",
    description: "Recover soft-deleted secret versions in Vault KV v2.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path" },
        versions: {
          type: "array",
          items: { type: "number" },
          description: "Versions to undelete",
        },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
      required: ["path", "versions"],
    },
  },
  {
    name: "vault_secret_destroy",
    description:
      "Permanently destroy secret versions in Vault KV v2. This is irreversible. Requires confirm: true.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path" },
        versions: {
          type: "array",
          items: { type: "number" },
          description: "Versions to permanently destroy",
        },
        confirm: { type: "boolean", description: "Must be true to confirm destruction" },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
      required: ["path", "versions", "confirm"],
    },
  },
  {
    name: "vault_secret_list",
    description: "List secret keys at a given path in Vault KV v2 engine.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to list (optional, defaults to root)" },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
    },
  },
  {
    name: "vault_secret_metadata",
    description:
      "Read metadata for a secret in Vault KV v2, including version history, creation time, and custom metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Secret path" },
        mount: { type: "string", description: "KV mount path (optional)" },
      },
      required: ["path"],
    },
  },
];

export async function handleSecretTool(
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "vault_secret_read": {
        const parsed = SecretReadSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        const versionParam = parsed.version ? `?version=${parsed.version}` : "";
        const result = await client.get<KvReadResponse>(
          `/${mount}/data/${parsed.path}${versionParam}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_secret_write": {
        const parsed = SecretWriteSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        const body: Record<string, unknown> = { data: parsed.data };
        if (parsed.cas !== undefined) {
          body.options = { cas: parsed.cas };
        }
        const result = await client.post<KvWriteResponse>(
          `/${mount}/data/${parsed.path}`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_secret_delete": {
        const parsed = SecretDeleteSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        if (parsed.versions && parsed.versions.length > 0) {
          await client.post(`/${mount}/delete/${parsed.path}`, {
            versions: parsed.versions,
          });
        } else {
          await client.deleteVoid(`/${mount}/data/${parsed.path}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                deleted: true,
                path: parsed.path,
                versions: parsed.versions ?? ["latest"],
              }, null, 2),
            },
          ],
        };
      }

      case "vault_secret_undelete": {
        const parsed = SecretUndeleteSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        await client.post(`/${mount}/undelete/${parsed.path}`, {
          versions: parsed.versions,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                undeleted: true,
                path: parsed.path,
                versions: parsed.versions,
              }, null, 2),
            },
          ],
        };
      }

      case "vault_secret_destroy": {
        const parsed = SecretDestroySchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        await client.post(`/${mount}/destroy/${parsed.path}`, {
          versions: parsed.versions,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                destroyed: true,
                path: parsed.path,
                versions: parsed.versions,
              }, null, 2),
            },
          ],
        };
      }

      case "vault_secret_list": {
        const parsed = SecretListSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        const listPath = parsed.path ? `/${mount}/metadata/${parsed.path}` : `/${mount}/metadata/`;
        const result = await client.list<KvListResponse>(listPath);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_secret_metadata": {
        const parsed = SecretMetadataSchema.parse(args);
        const mount = parsed.mount ?? getKvMount();
        const result = await client.get<KvMetadataResponse>(
          `/${mount}/metadata/${parsed.path}`,
        );
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
