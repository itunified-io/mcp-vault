#!/usr/bin/env node
/**
 * mcp-vault — MCP Server for HashiCorp Vault.
 * 28 tools for secrets, policies, auth methods, tokens, and system health.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { validateTransportConfig, createAuthMiddleware } from "./transport.js";
import { createServer } from "./server.js";

const { server } = createServer();

async function main() {
  const config = validateTransportConfig(
    process.env as Record<string, string | undefined>,
  );

  if (config.mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    const app = express();
    app.use(createAuthMiddleware(config.authToken));

    const sseTransports = new Map<string, SSEServerTransport>();

    app.get("/sse", async (req: express.Request, res: express.Response) => {
      const transport = new SSEServerTransport("/messages", res);
      sseTransports.set(transport.sessionId, transport);

      res.on("close", () => {
        sseTransports.delete(transport.sessionId);
      });

      await server.connect(transport);
    });

    app.post(
      "/messages",
      async (req: express.Request, res: express.Response) => {
        const sessionId = req.query.sessionId as string;
        const transport = sseTransports.get(sessionId);
        if (!transport) {
          res.status(400).send("No transport found for sessionId");
          return;
        }
        await transport.handlePostMessage(req, res);
      },
    );

    app.listen(config.port, config.host, () => {
      console.error(
        `MCP SSE server listening on ${config.host}:${config.port}`,
      );
    });
  }
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
