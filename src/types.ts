/**
 * Shared types for mcp-vault.
 */

import type { IVaultClient } from "./client/types.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
) => Promise<ToolResult>;

export type ToolMiddleware = (
  name: string,
  args: Record<string, unknown>,
  client: IVaultClient,
  next: ToolHandler,
) => Promise<ToolResult>;
