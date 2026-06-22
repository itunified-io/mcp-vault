/**
 * MCP Server factory for mcp-vault.
 * 28 tools across 7 domains.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { IVaultClient } from "./client/types.js";
import type { ToolHandler, ToolMiddleware } from "./types.js";
import { createClientFromEnv } from "./client/client-factory.js";

import { secretToolDefinitions, handleSecretTool } from "./tools/secrets.js";
import { engineToolDefinitions, handleEngineTool } from "./tools/engines.js";
import { authToolDefinitions, handleAuthTool } from "./tools/auth.js";
import { policyToolDefinitions, handlePolicyTool } from "./tools/policies.js";
import { tokenToolDefinitions, handleTokenTool } from "./tools/tokens.js";
import { systemToolDefinitions, handleSystemTool } from "./tools/system.js";
import { diagnosticsToolDefinitions, handleDiagnosticsTool } from "./tools/diagnostics.js";

export interface CreateServerOptions {
  middleware?: ToolMiddleware;
  name?: string;
  version?: string;
}

export interface CreateServerResult {
  server: Server;
  client: IVaultClient;
  allToolDefinitions: Tool[];
  toolHandlers: Map<string, ToolHandler>;
}

export function createServer(options?: CreateServerOptions): CreateServerResult {
  const {
    middleware,
    name = "mcp-vault",
    version = "2026.3.16",
  } = options ?? {};

  // Assemble all tool definitions
  const allToolDefinitions: Tool[] = [
    ...secretToolDefinitions,
    ...engineToolDefinitions,
    ...authToolDefinitions,
    ...policyToolDefinitions,
    ...tokenToolDefinitions,
    ...systemToolDefinitions,
    ...diagnosticsToolDefinitions,
  ] as unknown as Tool[];

  // Build tool handler map
  const toolHandlers = new Map<string, ToolHandler>();

  for (const def of secretToolDefinitions) toolHandlers.set(def.name, handleSecretTool);
  for (const def of engineToolDefinitions) toolHandlers.set(def.name, handleEngineTool);
  for (const def of authToolDefinitions) toolHandlers.set(def.name, handleAuthTool);
  for (const def of policyToolDefinitions) toolHandlers.set(def.name, handlePolicyTool);
  for (const def of tokenToolDefinitions) toolHandlers.set(def.name, handleTokenTool);
  for (const def of systemToolDefinitions) toolHandlers.set(def.name, handleSystemTool);
  for (const def of diagnosticsToolDefinitions) toolHandlers.set(def.name, handleDiagnosticsTool);

  // Create API client
  const client = createClientFromEnv();

  // Create MCP server
  const server = new Server(
    { name, version },
    { capabilities: { tools: {} } },
  );

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allToolDefinitions,
  }));

  // Register CallTools handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;
    const handler = toolHandlers.get(toolName);

    if (!handler) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    const typedArgs = (args ?? {}) as Record<string, unknown>;

    if (middleware) {
      return middleware(toolName, typedArgs, client, handler);
    }

    return handler(toolName, typedArgs, client);
  });

  return { server, client, allToolDefinitions, toolHandlers };
}
