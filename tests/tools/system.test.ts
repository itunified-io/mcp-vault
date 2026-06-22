import { describe, it, expect, vi } from "vitest";
import { systemToolDefinitions, handleSystemTool } from "../../src/tools/system.js";
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

describe("System Tool Definitions", () => {
  it("exports 3 tool definitions", () => {
    expect(systemToolDefinitions).toHaveLength(3);
  });
});

describe("handleSystemTool", () => {
  it("returns health status", async () => {
    const health = { initialized: true, sealed: false, standby: false, version: "1.15.0" };
    const client = mockClient({ get: vi.fn().mockResolvedValue(health) });
    const result = await handleSystemTool("vault_health", {}, client);
    expect(result.content[0].text).toContain("initialized");
    expect(client.get).toHaveBeenCalledWith("/sys/health");
  });

  it("returns seal status", async () => {
    const seal = { sealed: false, t: 3, n: 5, progress: 0 };
    const client = mockClient({ get: vi.fn().mockResolvedValue(seal) });
    const result = await handleSystemTool("vault_seal_status", {}, client);
    expect(result.content[0].text).toContain("sealed");
    expect(client.get).toHaveBeenCalledWith("/sys/seal-status");
  });

  it("returns leader status", async () => {
    const leader = { ha_enabled: true, is_self: true, leader_address: "http://vault:8200" };
    const client = mockClient({ get: vi.fn().mockResolvedValue(leader) });
    const result = await handleSystemTool("vault_leader", {}, client);
    expect(result.content[0].text).toContain("leader_address");
    expect(client.get).toHaveBeenCalledWith("/sys/leader");
  });
});
