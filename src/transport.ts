/**
 * Transport configuration + SSE auth middleware.
 */

import crypto from "crypto";

export type TransportConfig =
  | { mode: "stdio" }
  | { mode: "sse"; authToken: string; port: number; host: string };

export function validateTransportConfig(
  env: Record<string, string | undefined>,
): TransportConfig {
  const mode = env.VAULT_MCP_TRANSPORT || "stdio";

  if (mode === "stdio") {
    return { mode: "stdio" };
  }

  if (mode === "sse") {
    const authToken = env.VAULT_MCP_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        "VAULT_MCP_AUTH_TOKEN is required for SSE transport",
      );
    }
    const port = parseInt(env.VAULT_MCP_PORT || "3000", 10);
    const host = env.VAULT_MCP_HOST || "localhost";
    return { mode: "sse", authToken, port, host };
  }

  throw new Error(`Unknown transport: ${mode}. Use 'stdio' or 'sse'.`);
}

export function createAuthMiddleware(
  expectedToken: string,
): (req: unknown, res: unknown, next: () => void) => void {
  return (req: unknown, res: unknown, next: () => void) => {
    const request = req as { headers: { authorization?: string } };
    const response = res as {
      status: (code: number) => { json: (body: unknown) => void };
    };

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const provided = auth.slice("Bearer ".length);
    const expectedBuf = Buffer.from(expectedToken, "utf-8");
    const providedBuf = Buffer.from(provided, "utf-8");

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
