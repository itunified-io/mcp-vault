import { describe, it, expect, vi } from "vitest";
import { policyToolDefinitions, handlePolicyTool } from "../../src/tools/policies.js";
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

describe("Policy Tool Definitions", () => {
  it("exports 4 tool definitions", () => {
    expect(policyToolDefinitions).toHaveLength(4);
  });
});

describe("handlePolicyTool", () => {
  it("lists policies", async () => {
    const client = mockClient({ list: vi.fn().mockResolvedValue({ data: { keys: ["default", "root"] } }) });
    const result = await handlePolicyTool("vault_policy_list", {}, client);
    expect(result.content[0].text).toContain("default");
  });

  it("reads a policy", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue({ name: "my-policy", rules: 'path "secret/*" { capabilities = ["read"] }' }) });
    const result = await handlePolicyTool("vault_policy_read", { name: "my-policy" }, client);
    expect(result.content[0].text).toContain("capabilities");
  });

  it("writes a policy with confirm", async () => {
    const client = mockClient();
    const result = await handlePolicyTool(
      "vault_policy_write",
      { name: "my-policy", policy: 'path "secret/*" { capabilities = ["read"] }', confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("written");
    expect(client.put).toHaveBeenCalledWith("/sys/policies/acl/my-policy", {
      policy: 'path "secret/*" { capabilities = ["read"] }',
    });
  });

  it("rejects write without confirm", async () => {
    const client = mockClient();
    const result = await handlePolicyTool(
      "vault_policy_write",
      { name: "my-policy", policy: "rules", confirm: false },
      client,
    );
    expect(result.content[0].text).toContain("Error");
  });

  it("deletes a policy with confirm", async () => {
    const client = mockClient();
    const result = await handlePolicyTool(
      "vault_policy_delete",
      { name: "my-policy", confirm: true },
      client,
    );
    expect(result.content[0].text).toContain("deleted");
  });
});
