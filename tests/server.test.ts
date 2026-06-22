import { describe, it, expect, vi } from "vitest";

// Mock the client factory before importing server
vi.mock("../src/client/client-factory.js", () => ({
  createClientFromEnv: () => ({
    addr: "http://vault.example.com:8200",
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    deleteVoid: vi.fn(),
    list: vi.fn(),
  }),
  getKvMount: () => "kv",
}));

import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("creates a server with 28 tools", () => {
    const { server, allToolDefinitions } = createServer();
    expect(server).toBeDefined();
    expect(allToolDefinitions).toHaveLength(28);
  });

  it("has unique tool names", () => {
    const { allToolDefinitions } = createServer();
    const names = allToolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all tool names start with vault_", () => {
    const { allToolDefinitions } = createServer();
    for (const tool of allToolDefinitions) {
      expect(tool.name).toMatch(/^vault_/);
    }
  });
});
