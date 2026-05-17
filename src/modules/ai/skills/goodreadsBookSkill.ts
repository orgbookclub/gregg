import OpenAI from "openai";

import { logger } from "../../../utils/logHandler";
import { ToolCallLog } from "../types";

const GOODREADS_EXTRACTION_INSTRUCTIONS = `
You are a structured-data extractor for Goodreads book pages. 
Your job is to recover the data for a book via web_search.

Procedure:
1. Issue ONE web_search query of the form
   \`<book title> site:goodreads.com\`
   (include the author when you know it). This biases the results
   toward the canonical Goodreads page.
2. From the search results, identify the most likely Goodreads
   book page (URL pattern: \`https://www.goodreads.com/book/show/<id>\`).
3. Return a JSON object matching the supplied schema with the fields
   you reliably found.

Field rules:
- title and authors (string array) are mandatory. If you cannot find
  both with confidence from a Goodreads result, return
  { "error": "not_found" }.
- url should be the canonical Goodreads book page URL.
- coverUrl MUST match the Goodreads cover pattern verbatim:
  \`https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/<digits>i/<id>.<ext>\`
  Search result snippets usually surface this URL. Do NOT guess,
  construct, or substitute a different host (publisher / Squarespace /
  Wikipedia). Omit coverUrl entirely if the snippet doesn't contain
  one matching the pattern.
- description is the full Goodreads blurb VERBATIM as it appears on
  the book's Goodreads page. Do NOT paraphrase, summarize, or trim
  it. If your search snippet contains a truncated blurb (ends in "…"
  or similar), use only the verbatim portion you can see and stop
  there — never invent a continuation. If you only have a one-line
  search snippet preview, that one line is what you return.
- avgRating is the Goodreads average rating (out of 5).
- numPages is the page count Goodreads lists.
- genres is the array of Goodreads genre shelves (e.g. ["Fantasy",
  "Speculative Fiction"]).
- Output ONLY the JSON object. No prose, no explanation.
`.trim();

const GOODREADS_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    authors: { type: "array", items: { type: "string" } },
    url: { type: "string" },
    coverUrl: { type: "string" },
    description: { type: "string" },
    avgRating: { type: "number" },
    numPages: { type: "integer" },
    genres: { type: "array", items: { type: "string" } },
    error: { type: "string", enum: ["not_found"] },
  },
  additionalProperties: false,
};

const GOODREADS_COVER_URL_PATTERN =
  /^https:\/\/m\.media-amazon\.com\/images\/S\/compressed\.photo\.goodreads\.com\/books\//;

const WEB_SEARCH_TOOL = { type: "web_search" } as OpenAI.Responses.Tool;

function safeParseJson(
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  if (!raw) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function recordHostedToolCalls(
  response: OpenAI.Responses.Response,
  log: ToolCallLog[],
): void {
  for (const item of response.output) {
    if (item.type === "web_search_call") {
      const call = item as {
        type: "web_search_call";
        status?: string;
        action?: unknown;
      };
      log.push({
        name: "web_search",
        args: call.action,
        ok: call.status !== "failed",
        latencyMs: 0,
        errorCode: call.status === "failed" ? "tool_error" : undefined,
      });
    }
  }
}

/**
 * Typed result of a successful GoodreadsBookSkill run. Title and
 * authors are guaranteed (validated by the skill). All other fields
 * are best-effort — present when the model surfaced them in the
 * web_search snippets, omitted otherwise. CoverUrl is only present
 * when it matched the canonical Goodreads CDN pattern.
 */
export interface GoodreadsBookSkillResult {
  title: string;
  authors: string[];
  url?: string;
  coverUrl?: string;
  description?: string;
  avgRating?: number;
  numPages?: number;
  genres?: string[];
}

/**
 * Configuration the Goodreads book skill needs at construction time.
 * The OpenAI client must be a Responses-API-capable instance pointed
 * at a deployment that has the hosted web_search tool enabled.
 */
export interface GoodreadsBookSkillConfig {
  client: OpenAI;
  model: string;
}

/**
 * Token usage accumulator the skill mutates in place so the caller
 * can fold the sub-call's tokens into the overall turn totals.
 */
export interface UsageAccumulator {
  prompt: number;
  completion: number;
  reasoning: number;
}

/**
 * A "skill" is a reusable, code-invoked LLM capability — distinct
 * from a tool (which the conversational agent decides to call) and
 * from a plain utility function (which is deterministic). The
 * skill's contract is for Gregg code, not the model: it takes a
 * typed input, runs a focused sub-call with its own instructions
 * + tools + output schema, and returns typed data the caller uses
 * programmatically. The sub-call does NOT inherit the parent
 * conversation's `previous_response_id` chain, so the skill stays
 * stateless and its tokens never pollute future turns.
 *
 * `GoodreadsBookSkill` looks up a single book on Goodreads via the
 * hosted web_search tool and extracts the canonical fields against
 * a strict JSON schema. It is the workhorse behind the model-facing
 * `book_lookup` tool. A sibling `StorygraphBookSkill` with
 * `site:thestorygraph.com` and the moods/pace/warnings fields is
 * the natural next addition for Storygraph-specific queries.
 */
export class GoodreadsBookSkill {
  private readonly client: OpenAI;
  private readonly model: string;

  /**
   * Initialises a GoodreadsBookSkill.
   *
   * @param config The OpenAI client + model deployment to use.
   */
  constructor(config: GoodreadsBookSkillConfig) {
    this.client = config.client;
    this.model = config.model;
  }

  /**
   * Runs the Goodreads-targeted extraction sub-call for one book
   * query. Returns the typed book record on success, or null on any
   * failure (extraction errored, model returned non-JSON, JSON missed
   * required fields, model returned the not_found sentinel). Strips
   * any coverUrl that doesn't match the canonical Goodreads CDN
   * pattern so a hallucinated URL can't sneak through into the embed.
   *
   * Mutates `totals` and `log` in place so the caller can fold this
   * sub-call into its per-turn accounting.
   *
   * @param query Free-text book query (title, "title by author", etc.).
   * @param totals Token-usage accumulator the caller owns.
   * @param log Per-turn tool-call log the caller owns.
   * @returns The extracted book record, or null.
   */
  async run(
    query: string,
    totals: UsageAccumulator,
    log: ToolCallLog[],
  ): Promise<GoodreadsBookSkillResult | null> {
    const start = Date.now();
    try {
      const response = (await this.client.responses.create({
        model: this.model,
        tools: [WEB_SEARCH_TOOL],
        instructions: GOODREADS_EXTRACTION_INSTRUCTIONS,
        input: `Find the Goodreads page for "${query}" and return the JSON.`,
        text: {
          format: {
            type: "json_schema",
            name: "goodreads_book_extraction",
            schema: GOODREADS_EXTRACTION_SCHEMA,
            strict: false,
          },
        },
      } as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming)) as OpenAI.Responses.Response;
      totals.prompt += response.usage?.input_tokens ?? 0;
      totals.completion += response.usage?.output_tokens ?? 0;
      totals.reasoning +=
        response.usage?.output_tokens_details?.reasoning_tokens ?? 0;
      recordHostedToolCalls(response, log);
      const text = response.output_text ?? "";
      const parsed = safeParseJson(text);
      log.push({
        name: "goodreads_book_skill",
        args: { query },
        ok: parsed.ok,
        latencyMs: Date.now() - start,
        errorCode: parsed.ok ? undefined : "invalid_json",
      });
      if (!parsed.ok) {
        logger.warn(
          { query, rawText: text },
          "GoodreadsBookSkill: model returned non-JSON output",
        );
        return null;
      }
      if (typeof parsed.value !== "object" || parsed.value === null) {
        logger.warn(
          { query, value: parsed.value },
          "GoodreadsBookSkill: parsed JSON is not an object",
        );
        return null;
      }
      const data = parsed.value as Record<string, unknown>;
      if ("error" in data) {
        logger.warn(
          { query, error: data.error },
          "GoodreadsBookSkill: model returned not_found sentinel",
        );
        return null;
      }
      if (
        typeof data.title !== "string" ||
        !Array.isArray(data.authors) ||
        data.authors.length === 0
      ) {
        logger.warn(
          { query, data },
          "GoodreadsBookSkill: required fields title/authors missing",
        );
        return null;
      }
      if (
        typeof data.coverUrl === "string" &&
        !GOODREADS_COVER_URL_PATTERN.test(data.coverUrl)
      ) {
        logger.debug(
          { query, coverUrl: data.coverUrl },
          "GoodreadsBookSkill: dropping non-canonical coverUrl",
        );
        delete data.coverUrl;
      }
      logger.debug(
        {
          query,
          title: data.title,
          hasCover: typeof data.coverUrl === "string",
          numGenres: Array.isArray(data.genres) ? data.genres.length : 0,
        },
        "GoodreadsBookSkill succeeded",
      );
      return this.toResult(data);
    } catch (err) {
      logger.warn(err, `GoodreadsBookSkill failed for "${query}"`);
      log.push({
        name: "goodreads_book_skill",
        args: { query },
        ok: false,
        latencyMs: Date.now() - start,
        errorCode: "skill_error",
      });
      return null;
    }
  }

  /**
   * Adapts the validated raw extraction object into the typed skill
   * result. The caller (run) has already confirmed title and authors
   * are present and well-shaped; this method picks up the
   * best-effort optional fields and quietly drops anything mistyped.
   *
   * @param data The validated raw JSON object from the model.
   * @returns The typed skill result.
   */
  private toResult(data: Record<string, unknown>): GoodreadsBookSkillResult {
    const result: GoodreadsBookSkillResult = {
      title: data.title as string,
      authors: data.authors as string[],
    };
    if (typeof data.url === "string") result.url = data.url;
    if (typeof data.coverUrl === "string") result.coverUrl = data.coverUrl;
    if (typeof data.description === "string") {
      result.description = data.description;
    }
    if (typeof data.avgRating === "number") result.avgRating = data.avgRating;
    if (typeof data.numPages === "number") result.numPages = data.numPages;
    if (
      Array.isArray(data.genres) &&
      data.genres.every((g) => typeof g === "string")
    ) {
      result.genres = data.genres as string[];
    }
    return result;
  }
}
