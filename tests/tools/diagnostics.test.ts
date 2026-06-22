import { describe, it, expect, vi } from "vitest";
import { diagnosticsToolDefinitions, handleDiagnosticsTool } from "../../src/tools/diagnostics.js";
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

describe("Diagnostics Tool Definitions", () => {
  it("exports 2 tool definitions", () => {
    expect(diagnosticsToolDefinitions).toHaveLength(2);
  });
});

describe("handleDiagnosticsTool", () => {
  it("verifies API connectivity", async () => {
    const health = { initialized: true, sealed: false, version: "1.15.0" };
    const client = mockClient({ get: vi.fn().mockResolvedValue(health) });
    const result = await handleDiagnosticsTool("vault_api_verify", {}, client);
    expect(result.content[0].text).toContain("vault.example.com");
    expect(result.content[0].text).toContain("initialized");
  });

  it("reports API verify failure", async () => {
    const client = mockClient({
      get: vi.fn().mockRejectedValue(new Error("Connection refused")),
    });
    const result = await handleDiagnosticsTool("vault_api_verify", {}, client);
    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain("Connection refused");
  });

  it("lists audit devices", async () => {
    const audits = { "file/": { type: "file", options: { file_path: "/var/log/vault.log" } } };
    const client = mockClient({ get: vi.fn().mockResolvedValue(audits) });
    const result = await handleDiagnosticsTool("vault_audit_list", {}, client);
    expect(result.content[0].text).toContain("file/");
    expect(client.get).toHaveBeenCalledWith("/sys/audit");
  });
});
