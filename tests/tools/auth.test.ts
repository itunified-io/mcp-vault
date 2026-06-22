import { describe, it, expect, vi } from "vitest";
import { authToolDefinitions, handleAuthTool } from "../../src/tools/auth.js";
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

describe("Auth Tool Definitions", () => {
  it("exports 5 tool definitions", () => {
    expect(authToolDefinitions).toHaveLength(5);
  });
});

describe("handleAuthTool", () => {
  it("lists auth methods", async () => {
    const methods = { "kubernetes/": { type: "kubernetes" } };
    const client = mockClient({ get: vi.fn().mockResolvedValue(methods) });
    const result = await handleAuthTool("vault_auth_list", {}, client);
    expect(result.content[0].text).toContain("kubernetes");
  });

  it("enables auth with confirm", async () => {
    const client = mockClient();
    const result = await handleAuthTool(
      "vault_auth_enable",
      { path: "oidc", type: "oidc", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("enabled");
  });

  it("disables auth with confirm", async () => {
    const client = mockClient();
    const result = await handleAuthTool(
      "vault_auth_disable",
      { path: "oidc", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("disabled");
  });

  it("reads auth config", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue({ kubernetes_host: "https://k8s" }) });
    await handleAuthTool("vault_auth_read_config", { method: "kubernetes" }, client);
    expect(client.get).toHaveBeenCalledWith("/auth/kubernetes/config");
  });

  it("reads k8s role", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue({ data: { bound_service_account_names: ["sa"] } }) });
    await handleAuthTool("vault_auth_k8s_role_read", { name: "my-role" }, client);
    expect(client.get).toHaveBeenCalledWith("/auth/kubernetes/role/my-role");
  });

  it("reads k8s role with custom mount", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue({}) });
    await handleAuthTool("vault_auth_k8s_role_read", { name: "my-role", mount: "k8s-prod" }, client);
    expect(client.get).toHaveBeenCalledWith("/auth/k8s-prod/role/my-role");
  });
});
