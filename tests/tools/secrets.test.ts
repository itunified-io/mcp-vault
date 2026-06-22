import { describe, it, expect, vi } from "vitest";
import { secretToolDefinitions, handleSecretTool } from "../../src/tools/secrets.js";
import type { IVaultClient } from "../../src/client/types.js";

const VAULT_ADDR = "http://vault.example.com:8200";

function mockClient(overrides: Partial<IVaultClient> = {}): IVaultClient {
  return {
    addr: VAULT_ADDR,
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteVoid: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ data: { keys: [] } }),
    ...overrides,
  } as unknown as IVaultClient;
}

describe("Secret Tool Definitions", () => {
  it("exports 7 tool definitions", () => {
    expect(secretToolDefinitions).toHaveLength(7);
  });

  it("all tools have vault_secret_ prefix", () => {
    for (const tool of secretToolDefinitions) {
      expect(tool.name).toMatch(/^vault_secret_/);
    }
  });
});

describe("handleSecretTool", () => {
  describe("vault_secret_read", () => {
    it("reads a secret at a path", async () => {
      const mockData = {
        data: { data: { username: "admin", password: "secret" }, metadata: { version: 1 } },
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockData) });
      const result = await handleSecretTool("vault_secret_read", { path: "myapp/config" }, client);

      expect(result.content[0].text).toContain("admin");
      expect(client.get).toHaveBeenCalledWith("/kv/data/myapp/config");
    });

    it("reads a specific version", async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      await handleSecretTool("vault_secret_read", { path: "myapp/config", version: 3 }, client);

      expect(client.get).toHaveBeenCalledWith("/kv/data/myapp/config?version=3");
    });

    it("uses custom mount path", async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      await handleSecretTool("vault_secret_read", { path: "myapp/config", mount: "secret" }, client);

      expect(client.get).toHaveBeenCalledWith("/secret/data/myapp/config");
    });

    it("returns error for missing path", async () => {
      const client = mockClient();
      const result = await handleSecretTool("vault_secret_read", {}, client);
      expect(result.content[0].text).toContain("Error");
    });
  });

  describe("vault_secret_write", () => {
    it("writes a secret", async () => {
      const mockResponse = { data: { version: 1 } };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockResponse) });
      const result = await handleSecretTool(
        "vault_secret_write",
        { path: "myapp/config", data: { key: "value" } },
        client,
      );

      expect(result.content[0].text).toContain("version");
      expect(client.post).toHaveBeenCalledWith("/kv/data/myapp/config", { data: { key: "value" } });
    });

    it("supports CAS parameter", async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({ data: { version: 2 } }) });
      await handleSecretTool(
        "vault_secret_write",
        { path: "myapp/config", data: { key: "value" }, cas: 1 },
        client,
      );

      expect(client.post).toHaveBeenCalledWith("/kv/data/myapp/config", {
        data: { key: "value" },
        options: { cas: 1 },
      });
    });
  });

  describe("vault_secret_delete", () => {
    it("soft-deletes latest version", async () => {
      const client = mockClient();
      const result = await handleSecretTool("vault_secret_delete", { path: "myapp/config" }, client);

      expect(result.content[0].text).toContain("deleted");
      expect(client.deleteVoid).toHaveBeenCalledWith("/kv/data/myapp/config");
    });

    it("deletes specific versions", async () => {
      const client = mockClient();
      await handleSecretTool("vault_secret_delete", { path: "myapp/config", versions: [1, 2] }, client);

      expect(client.post).toHaveBeenCalledWith("/kv/delete/myapp/config", { versions: [1, 2] });
    });
  });

  describe("vault_secret_undelete", () => {
    it("undeletes specified versions", async () => {
      const client = mockClient();
      const result = await handleSecretTool(
        "vault_secret_undelete",
        { path: "myapp/config", versions: [1] },
        client,
      );

      expect(result.content[0].text).toContain("undeleted");
      expect(client.post).toHaveBeenCalledWith("/kv/undelete/myapp/config", { versions: [1] });
    });
  });

  describe("vault_secret_destroy", () => {
    it("permanently destroys versions with confirm", async () => {
      const client = mockClient();
      const result = await handleSecretTool(
        "vault_secret_destroy",
        { path: "myapp/config", versions: [1, 2], confirm: true },
        client,
      );

      expect(result.content[0].text).toContain("destroyed");
      expect(client.post).toHaveBeenCalledWith("/kv/destroy/myapp/config", { versions: [1, 2] });
    });

    it("rejects without confirm: true", async () => {
      const client = mockClient();
      const result = await handleSecretTool(
        "vault_secret_destroy",
        { path: "myapp/config", versions: [1], confirm: false },
        client,
      );

      expect(result.content[0].text).toContain("Error");
    });
  });

  describe("vault_secret_list", () => {
    it("lists keys at a path", async () => {
      const mockKeys = { data: { keys: ["config", "creds/"] } };
      const client = mockClient({ list: vi.fn().mockResolvedValue(mockKeys) });
      const result = await handleSecretTool("vault_secret_list", { path: "myapp" }, client);

      expect(result.content[0].text).toContain("config");
      expect(client.list).toHaveBeenCalledWith("/kv/metadata/myapp");
    });

    it("lists root when no path given", async () => {
      const client = mockClient({ list: vi.fn().mockResolvedValue({ data: { keys: [] } }) });
      await handleSecretTool("vault_secret_list", {}, client);

      expect(client.list).toHaveBeenCalledWith("/kv/metadata/");
    });
  });

  describe("vault_secret_metadata", () => {
    it("reads metadata for a secret", async () => {
      const mockMeta = { data: { current_version: 3, max_versions: 10 } };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockMeta) });
      const result = await handleSecretTool("vault_secret_metadata", { path: "myapp/config" }, client);

      expect(result.content[0].text).toContain("current_version");
      expect(client.get).toHaveBeenCalledWith("/kv/metadata/myapp/config");
    });
  });

  it("returns unknown tool message for invalid name", async () => {
    const client = mockClient();
    const result = await handleSecretTool("vault_secret_invalid", {}, client);
    expect(result.content[0].text).toContain("Unknown tool");
  });
});
