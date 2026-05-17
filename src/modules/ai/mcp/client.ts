// eslint-disable-next-line import/no-unresolved
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// eslint-disable-next-line import/no-unresolved
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { logger } from "../../../utils/logHandler";

import { IOwsTokenProvider, createAuthFetch } from "./auth";

/**
 * Subset of an MCP tool definition Gregg cares about. The MCP SDK's
 * Tool type carries optional metadata fields we ignore for v1.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Result of dispatching a tool call. Ok=false captures both
 * transport-level failures and tool-reported errors (isError=true)
 * so the agent loop can distinguish them in logs without crashing
 * the turn.
 */
export interface McpToolResult {
  ok: boolean;
  text: string;
  errorCode?: string;
}

/**
 * Wraps the @modelcontextprotocol/sdk client + Streamable HTTP
 * transport with Gregg-flavoured concerns: shared OWS token cache
 * via createAuthFetch, lazy connect, and a thin uniform surface
 * (listTools / callTool / close) the agent module consumes.
 */
export class OwsMcpClient {
  private readonly url: URL;
  private readonly tokenProvider: IOwsTokenProvider;
  private readonly client: Client;
  private readonly transport: StreamableHTTPClientTransport;
  private connected: Promise<void> | null = null;

  /**
   * Constructs an OwsMcpClient bound to the given MCP endpoint and
   * token provider. The transport is built immediately but the
   * MCP `initialize` handshake is deferred to the first call.
   *
   * @param url The MCP HTTP endpoint (e.g. `${API_URL}/mcp`).
   * @param tokenProvider The token source used to authenticate requests.
   */
  constructor(url: string, tokenProvider: IOwsTokenProvider) {
    this.url = new URL(url);
    this.tokenProvider = tokenProvider;
    this.transport = new StreamableHTTPClientTransport(this.url, {
      fetch: createAuthFetch(this.tokenProvider),
    });
    this.client = new Client(
      {
        name: "gregg",
        version: process.env.npm_package_version ?? "0.0.0",
      },
      { capabilities: {} },
    );
  }

  /**
   * Ensures the underlying MCP session is connected. Idempotent — the
   * SDK handshake runs at most once per OwsMcpClient instance.
   *
   * @returns A promise that resolves when the handshake is complete.
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      this.connected = this.client
        .connect(this.transport)
        .then(() => {
          logger.debug(
            `OWS MCP connected at ${this.url.toString()}: ${JSON.stringify(this.client.getServerVersion())}`,
          );
        })
        .catch((err) => {
          this.connected = null;
          throw err;
        });
    }
    await this.connected;
  }

  /**
   * Fetches the MCP tool catalogue. The caller (McpToolSource) is
   * responsible for caching — this method always round-trips to the
   * server, so a fresh listing can be requested by constructing a new
   * source.
   *
   * @returns The list of tools the OWS MCP server exposes.
   */
  async listTools(): Promise<McpToolDefinition[]> {
    await this.connect();
    const response = await this.client.listTools();
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Dispatches a single MCP tool call and reduces the SDK's content
   * envelope to a single text payload the agent can hand back to the
   * Responses API as a function_call_output. Transport / RPC failures
   * are caught and surfaced as ok=false so they don't poison the
   * agent loop.
   *
   * @param name The MCP tool name.
   * @param args Parsed JSON arguments to pass to the tool.
   * @returns A normalized result for the agent loop.
   */
  async callTool(name: string, args: unknown): Promise<McpToolResult> {
    try {
      await this.connect();
      const response = await this.client.callTool({
        name,
        arguments: (args ?? {}) as Record<string, unknown>,
      });
      const content = (response.content ?? []) as {
        type: string;
        text?: string;
      }[];
      const text = content
        .filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text as string)
        .join("\n");
      return {
        ok: !response.isError,
        text,
        errorCode: response.isError ? "tool_error" : undefined,
      };
    } catch (err) {
      logger.warn(err, `OWS MCP tool call failed: ${name}`);
      return {
        ok: false,
        text: JSON.stringify({
          error: "transport_error",
          detail: (err as Error).message,
        }),
        errorCode: "transport_error",
      };
    }
  }

  /**
   * Closes the MCP session, releasing transport-level resources. Safe
   * to call when not connected.
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (err) {
      logger.debug(err, "OWS MCP close failed (non-fatal)");
    }
    this.connected = null;
  }
}
