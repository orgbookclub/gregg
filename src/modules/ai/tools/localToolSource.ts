import { GoodreadsBookDto } from "@organizedbookclub/ows-client";
import OpenAI from "openai";

import { Bot } from "../../../models";
import { getGoodreadsBookEmbed } from "../../../utils/bookUtils";
import {
  GoodreadsBookSkill,
  GoodreadsBookSkillResult,
} from "../skills/goodreadsBookSkill";
import { ToolCallLog } from "../types";

import { ToolArtifacts, ToolDispatchResult, ToolSource } from "./registry";

const BOOK_LOOKUP_SCHEMA: OpenAI.Responses.Tool = {
  type: "function",
  name: "book_lookup",
  description:
    "Look up a book by title (optionally with author, e.g. 'Piranesi by " +
    "Susanna Clarke') and render its details as a Discord embed for the " +
    "user. The bot handles the Goodreads-targeted web search, JSON " +
    "extraction, and embed rendering internally — you only need to call " +
    "this tool once with a clean query. Use for any question about a " +
    "specific book ('tell me about X', 'what's X about', 'have you read " +
    "X'). After it succeeds, reply with at most one short framing " +
    "sentence; the embed IS the answer.",
  parameters: {
    type: "object",
    properties: {
      q: {
        type: "string",
        description:
          "Free-text book query. Include the author when the title is " +
          "ambiguous (e.g. 'Piranesi by Susanna Clarke').",
      },
    },
    required: ["q"],
    additionalProperties: false,
  },
  strict: false,
} as OpenAI.Responses.Tool;

/**
 * Adapts the skill's typed result into the GoodreadsBookDto shape
 * that the shared embed builder consumes. The builder predates the
 * skill and expects every field non-null, so missing values fall
 * back to safe defaults; the builder already guards URL fields
 * against empty strings before handing them to discord.js validators.
 *
 * `author.url` is intentionally left empty rather than falling back
 * to the book URL — synthesising a wrong link (the author's name
 * pointing at the book's page) is worse than rendering the author
 * name as plain text. The embed builder's `authorUrl || undefined`
 * guard handles this correctly.
 */
function toGoodreadsDto(skill: GoodreadsBookSkillResult): GoodreadsBookDto {
  return {
    title: skill.title,
    authors: skill.authors.map((name) => ({ name, url: "" })),
    url: skill.url ?? "",
    coverUrl: skill.coverUrl ?? "",
    description: skill.description ?? "",
    avgRating: skill.avgRating ?? 0,
    numPages: skill.numPages ?? 0,
    series: "",
    numRatings: 0,
    numReviews: 0,
    genres: skill.genres ?? [],
  } as GoodreadsBookDto;
}

function parseQuery(args: unknown): string | null {
  if (typeof args !== "object" || args === null) return null;
  const raw = (args as { q?: unknown }).q;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  return raw.trim();
}

/**
 * Handles a book_lookup tool call end-to-end:
 *   1. Validate the query string from the model.
 *   2. Run the GoodreadsBookSkill (LLM sub-call + Goodreads-targeted
 *      web_search + strict-JSON extraction).
 *   3. Build the Goodreads embed via the shared utility used by the
 *      `/goodreads book` slash command, so the visual output is
 *      identical regardless of which entry point the user took.
 *
 * Surfaces the skill's sub-call tokens + tool log up to the agent
 * via `nestedCalls` / `nestedUsage` so the per-turn audit row
 * captures everything that happened, not just "book_lookup ran".
 *
 * Cover URLs: the skill already drops anything that doesn't match
 * the canonical Goodreads CDN pattern, and the shared embed builder
 * guards `setThumbnail` against empty strings. If a matching URL is
 * briefly unreachable, Discord silently skips the thumbnail and
 * still posts the rest of the embed.
 */
async function handleBookLookup(
  ctx: LocalToolContext,
  rawArgs: unknown,
): Promise<ToolDispatchResult> {
  const query = parseQuery(rawArgs);
  if (!query) {
    return {
      ok: false,
      text: JSON.stringify({
        error: "invalid_arguments",
        detail: "Expected { q: string } with a non-empty query.",
      }),
      errorCode: "invalid_arguments",
    };
  }

  const nestedCalls: ToolCallLog[] = [];
  const nestedUsage = { prompt: 0, completion: 0, reasoning: 0 };
  const book = await ctx.goodreadsBookSkill.run(
    query,
    nestedUsage,
    nestedCalls,
  );
  if (!book) {
    return {
      ok: false,
      text: JSON.stringify({
        error: "not_found",
        detail: `Could not extract usable book info for "${query}".`,
      }),
      errorCode: "not_found",
      nestedCalls,
      nestedUsage,
    };
  }

  const artifacts: ToolArtifacts = {
    embeds: [getGoodreadsBookEmbed(toGoodreadsDto(book))],
  };
  return {
    ok: true,
    text: JSON.stringify({
      rendered: "book_embed",
      source: "goodreads",
      title: book.title,
    }),
    artifacts,
    nestedCalls,
    nestedUsage,
  };
}

/**
 * Dependencies a tool handler receives at dispatch time. Skills
 * (LLM-backed sub-capabilities — see `../skills/`) are wired here
 * so handlers can call them without LocalToolSource itself depending
 * on the OpenAI client.
 */
interface LocalToolContext {
  bot: Bot;
  goodreadsBookSkill: GoodreadsBookSkill;
}

type LocalToolHandler = (
  ctx: LocalToolContext,
  args: unknown,
) => Promise<ToolDispatchResult>;

interface LocalToolDef {
  schema: OpenAI.Responses.Tool;
  handler: LocalToolHandler;
}

const LOCAL_TOOLS: Record<string, LocalToolDef> = {
  // eslint-disable-next-line camelcase
  book_lookup: {
    schema: BOOK_LOOKUP_SCHEMA,
    handler: handleBookLookup,
  },
};

/**
 * Configuration the LocalToolSource needs at construction time.
 */
export interface LocalToolSourceConfig {
  bot: Bot;
  goodreadsBookSkill: GoodreadsBookSkill;
}

/**
 * A ToolSource for Gregg-owned tools dispatched in-process. "Local"
 * is the boundary the registry cares about: dispatch happens inside
 * Gregg's Node process, even though a handler may make outbound HTTP
 * calls (to OpenAI, OWS REST, Discord) to do its work. Contrast with
 * `McpToolSource` (dispatch crosses the network to OWS over MCP) and
 * the hosted `web_search` tool (dispatched server-side by Foundry).
 *
 * Today this source holds a single tool — `book_lookup` — which
 * orchestrates the GoodreadsBookSkill + embed rendering in one shot
 * so the model never has to make multi-step decisions about how to
 * present a book. Phase 4 will add Discord-context tools
 * (discord_get_recent_messages, etc.) alongside it; they'll follow
 * the same handler-takes-LocalToolContext shape.
 */
export class LocalToolSource implements ToolSource {
  private readonly context: LocalToolContext;
  private readonly nameSet: Set<string>;

  /**
   * Constructs a LocalToolSource with the given context.
   *
   * @param config The bot instance and shared skill instances.
   */
  constructor(config: LocalToolSourceConfig) {
    this.context = {
      bot: config.bot,
      goodreadsBookSkill: config.goodreadsBookSkill,
    };
    this.nameSet = new Set(Object.keys(LOCAL_TOOLS));
  }

  /**
   * Returns this source's tools as Responses-API function tool defs
   * for the agent to advertise to the model.
   *
   * @returns The local tool definitions.
   */
  async list(): Promise<OpenAI.Responses.Tool[]> {
    return await Promise.resolve(
      Object.values(LOCAL_TOOLS).map((tool) => tool.schema),
    );
  }

  /**
   * Returns true if the named tool is owned by this source.
   *
   * @param name The tool name to check.
   * @returns Whether this source dispatches the tool.
   */
  owns(name: string): boolean {
    return this.nameSet.has(name);
  }

  /**
   * Dispatches a tool call to its registered handler. Unknown tool
   * names return an `unknown_tool` error result, though the
   * CompositeToolRegistry normally filters these out before they
   * reach here.
   *
   * @param name The tool name.
   * @param args Parsed JSON arguments from the model.
   * @returns The handler's normalized result.
   */
  async dispatch(name: string, args: unknown): Promise<ToolDispatchResult> {
    const tool = LOCAL_TOOLS[name];
    if (!tool) {
      return {
        ok: false,
        text: JSON.stringify({ error: "unknown_tool", detail: name }),
        errorCode: "unknown_tool",
      };
    }
    return await tool.handler(this.context, args);
  }
}
