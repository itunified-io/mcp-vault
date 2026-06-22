import { describe, it, expect, vi } from "vitest";
import { tokenToolDefinitions, handleTokenTool } from "../../src/tools/tokens.js";
import type { IVaultClient } from "../../src/client/types.js";

function mockClient(overrides: Partial<IVaultClient> = {}): IVaultClient {
  return {
    addr: "http://vault.example.com:8200",
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteVoid: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ data: { keys: [] } }),
    ...overrides,
  } as unknown as IVaultClient;
}

describe("Token Tool Definitions", () => {
  it("exports 3 tool definitions", () => {
    expect(tokenToolDefinitions).toHaveLength(3);
  });
});

describe("handleTokenTool", () => {
  it("looks up self token", async () => {
    const tokenData = { data: { display_name: "test", policies: ["default"] } };
    const client = mockClient({ get: vi.fn().mockResolvedValue(tokenData) });
    const result = await handleTokenTool("vault_token_lookup_self", {}, client);
    expect(result.content[0].text).toContain("display_name");
    expect(client.get).toHaveBeenCalledWith("/auth/token/lookup-self");
  });

  it("creates a token with confirm", async () => {
    const client = mockClient({ post: vi.fn().mockResolvedValue({ auth: { client_token: "hvs.test" } }) });
    const result = await handleTokenTool(
      "vault_token_create",
      { policies: ["my-policy"], ttl: "1h", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("client_token");
  });

  it("revokes a token with confirm", async () => {
    const client = mockClient();
    const result = await handleTokenTool(
      "vault_token_revoke",
      { token: "hvs.test-token", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("revoked");
  });

  it("rejects create without confirm", async () => {
    const client = mockClient();
    const result = await handleTokenTool("vault_token_create", { confirm: false }, client);
    expect(result.content[0].text).toContain("Error");
  });
});
