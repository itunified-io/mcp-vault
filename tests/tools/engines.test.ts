import { describe, it, expect, vi } from "vitest";
import { engineToolDefinitions, handleEngineTool } from "../../src/tools/engines.js";
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

describe("Engine Tool Definitions", () => {
  it("exports 4 tool definitions", () => {
    expect(engineToolDefinitions).toHaveLength(4);
  });
});

describe("handleEngineTool", () => {
  it("lists engines", async () => {
    const mounts = { "kv/": { type: "kv", description: "KV engine" } };
    const client = mockClient({ get: vi.fn().mockResolvedValue(mounts) });
    const result = await handleEngineTool("vault_engine_list", {}, client);
    expect(result.content[0].text).toContain("kv");
  });

  it("gets engine details", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue({ type: "kv" }) });
    await handleEngineTool("vault_engine_get", { path: "kv" }, client);
    expect(client.get).toHaveBeenCalledWith("/sys/mounts/kv");
  });

  it("enables engine with confirm", async () => {
    const client = mockClient();
    const result = await handleEngineTool(
      "vault_engine_enable",
      { path: "pki", type: "pki", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("enabled");
    expect(client.post).toHaveBeenCalledWith("/sys/mounts/pki", { type: "pki" });
  });

  it("rejects enable without confirm", async () => {
    const client = mockClient();
    const result = await handleEngineTool(
      "vault_engine_enable",
      { path: "pki", type: "pki", confirm: false },
      client,
    );
    expect(result.content[0].text).toContain("Error");
  });

  it("disables engine with confirm", async () => {
    const client = mockClient();
    const result = await handleEngineTool(
      "vault_engine_disable",
      { path: "pki", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("disabled");
  });
});
