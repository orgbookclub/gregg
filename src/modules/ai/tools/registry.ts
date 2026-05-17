import OpenAI from "openai";

import { logger } from "../../../utils/logHandler";

function getToolName(tool: OpenAI.Responses.Tool): string | undefined {
  return (tool as { name?: string }).name;
}

/**
 * Outcome of dispatching a single function tool call. The agent loop
 * converts this into a `function_call_output` item for the Responses
 * API. `ok=false` covers both transport-level failures and
 * tool-reported errors; the agent surfaces it as a `tool_error` finish
 * reason without crashing the turn.
 */
export interface ToolDispatchResult {
  ok: boolean;
  text: string;
  errorCode?: string;
}

/**
 * One backing source of tools (e.g. The OWS MCP server, the local
 * registry, future Discord-context registry). A source declares which
 * tool names it owns via `list()` and dispatches calls to those tools
 * via `dispatch()`. Sources should not declare the same tool name as
 * another source; CompositeToolRegistry logs a warning and keeps the
 * earlier source's binding when a duplicate is detected at list time.
 */
export interface ToolSource {
  list(): Promise<OpenAI.Responses.Tool[]>;
  owns(name: string): boolean;
  dispatch(name: string, args: unknown): Promise<ToolDispatchResult>;
}

/**
 * The agent-facing contract over zero or more ToolSource instances.
 * The agent loop only ever talks to a registry — it never knows
 * whether a tool is dispatched locally, over MCP, or hosted by the
 * provider.
 */
export interface ToolRegistry {
  list(): Promise<OpenAI.Responses.Tool[]>;
  dispatch(name: string, args: unknown): Promise<ToolDispatchResult>;
}

/**
 * A registry composed of multiple ToolSource instances. Tool listings
 * are concatenated in source order; duplicate tool names are dropped
 * (with a warning) so the model always sees a coherent unique list.
 * Dispatching looks up the owning source by name; the agent treats an
 * unknown tool name as a tool-level error so the loop can recover
 * gracefully and the model gets feedback instead of a thrown exception.
 */
export class CompositeToolRegistry implements ToolRegistry {
  private readonly sources: ToolSource[];

  /**
   * Constructs a CompositeToolRegistry over the given sources.
   *
   * @param sources The ordered list of tool sources to compose.
   */
  constructor(sources: ToolSource[]) {
    this.sources = sources;
  }

  /**
   * Returns the union of every source's tool list, suitable for the
   * Responses-API `tools` parameter. Failures in an individual source
   * (e.g. MCP server unreachable) are logged by the source and treated
   * as "no tools right now" so other sources still surface. Collisions
   * across sources are dropped in favour of the earlier-listed source
   * and warned about so they can be fixed at the source.
   *
   * @returns The combined tool list with duplicates removed.
   */
  async list(): Promise<OpenAI.Responses.Tool[]> {
    const lists = await Promise.all(this.sources.map((s) => s.list()));
    const seen = new Set<string>();
    const combined: OpenAI.Responses.Tool[] = [];
    for (const tool of lists.flat()) {
      const name = getToolName(tool);
      if (!name) continue;
      if (seen.has(name)) {
        logger.warn(
          `CompositeToolRegistry: duplicate tool name "${name}" — keeping the first source's binding`,
        );
        continue;
      }
      seen.add(name);
      combined.push(tool);
    }
    return combined;
  }

  /**
   * Dispatches a tool call to the owning source. Returns a structured
   * error result when no source claims the tool name.
   *
   * @param name The function tool name the model emitted.
   * @param args Parsed JSON arguments to pass to the tool.
   * @returns The tool's normalized result for the agent loop.
   */
  async dispatch(name: string, args: unknown): Promise<ToolDispatchResult> {
    const source = this.sources.find((s) => s.owns(name));
    if (!source) {
      return {
        ok: false,
        text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        errorCode: "unknown_tool",
      };
    }
    return await source.dispatch(name, args);
  }
}
