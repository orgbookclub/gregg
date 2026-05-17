import OpenAI from "openai";

import { logger } from "../../../utils/logHandler";
import { McpToolDefinition, OwsMcpClient } from "../mcp/client";

import { ToolDispatchResult, ToolSource } from "./registry";

function toFunctionTool(tool: McpToolDefinition): OpenAI.Responses.Tool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  } as OpenAI.Responses.Tool;
}

/**
 * A ToolSource backed by an OwsMcpClient. Lazily fetches and caches
 * the OWS MCP tool catalogue, exposes each tool as an OpenAI function
 * tool, and dispatches calls back over MCP. An optional deny-list of
 * tool names hides server-side tools the agent shouldn't see — useful
 * when the OWS catalogue exposes power-user tools the AI's default
 * flow shouldn't pick by accident.
 */
export class McpToolSource implements ToolSource {
  private readonly mcp: OwsMcpClient;
  private readonly denyList: Set<string>;
  private toolsCache: OpenAI.Responses.Tool[] | null = null;
  private nameSet: Set<string> = new Set();

  /**
   * Constructs an MCP-backed tool source.
   *
   * @param mcp The connected OwsMcpClient.
   * @param options Optional configuration; `denyList` hides server-side
   *   tools from the agent's catalogue.
   */
  constructor(mcp: OwsMcpClient, options: { denyList?: string[] } = {}) {
    this.mcp = mcp;
    this.denyList = new Set(options.denyList ?? []);
  }

  /**
   * Returns the MCP tools, translated to the Responses-API function
   * tool shape. The first call connects to MCP and caches the result;
   * subsequent calls are zero-cost. MCP errors are logged and treated
   * as "no tools" so the agent can still respond from training data.
   * Tools named in the constructor's deny-list are filtered out before
   * caching.
   *
   * @returns The MCP tools as function tools.
   */
  async list(): Promise<OpenAI.Responses.Tool[]> {
    if (this.toolsCache) return this.toolsCache;
    try {
      const tools = await this.mcp.listTools();
      const allowed = tools.filter((t) => !this.denyList.has(t.name));
      this.toolsCache = allowed.map(toFunctionTool);
      this.nameSet = new Set(allowed.map((t) => t.name));
      return this.toolsCache;
    } catch (err) {
      logger.warn(err, "MCP tools/list failed; agent will run tool-less");
      return [];
    }
  }

  /**
   * Returns true if the given tool name is owned by this source.
   * Owned tools are populated by `list()`; calling `owns` before
   * `list` resolves always returns false.
   *
   * @param name The tool name to check.
   * @returns Whether this source dispatches the tool.
   */
  owns(name: string): boolean {
    return this.nameSet.has(name);
  }

  /**
   * Dispatches a tool call over MCP and returns the normalized
   * result. Transport errors are caught upstream by OwsMcpClient.
   *
   * @param name The MCP tool name.
   * @param args Parsed JSON arguments.
   * @returns The MCP tool result.
   */
  async dispatch(name: string, args: unknown): Promise<ToolDispatchResult> {
    const result = await this.mcp.callTool(name, args);
    return {
      ok: result.ok,
      text: result.text || JSON.stringify({ ok: result.ok }),
      errorCode: result.errorCode,
    };
  }
}
