import { Bot } from "../../models";
import { logger } from "../../utils/logHandler";

import { AIAgent, AIAgentConfig } from "./agent";
import { createAzureFoundryClient } from "./client/azureClient";
import { AiLogger } from "./logging";
import { OwsMcpClient } from "./mcp/client";
import { SessionStore } from "./sessions/store";
import { GoodreadsBookSkill } from "./skills/goodreadsBookSkill";
import { LocalToolSource } from "./tools/localToolSource";
import { McpToolSource } from "./tools/mcpToolSource";
import { CompositeToolRegistry, ToolSource } from "./tools/registry";

/**
 * Returns true when AI features are enabled via env. The bot bootstrap
 * uses this to decide whether to construct the agent at all.
 *
 * @returns Whether AI_ENABLED resolves truthy.
 */
function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === "true";
}

function readConfigFromEnv(): AIAgentConfig {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const model = process.env.AI_MODEL_GENERAL;
  if (!endpoint || !apiKey || !model) {
    throw new Error(
      "AI_ENABLED=true but AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY, or AI_MODEL_GENERAL is missing.",
    );
  }
  return { foundry: { endpoint, apiKey, model } };
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildMcpClient(bot: Bot): OwsMcpClient | null {
  const explicit = process.env.OWS_MCP_URL;
  const derived = bot.configs.apiUrl
    ? `${bot.configs.apiUrl.replace(/\/$/, "")}/mcp`
    : null;
  const url = explicit ?? derived;
  if (!url) {
    logger.debug("AI module: no OWS_MCP_URL or API_URL — agent runs tool-less");
    return null;
  }
  return new OwsMcpClient(url, bot.api);
}

/**
 * Bootstraps the AI agent for the bot. Returns null when AI is disabled
 * so the caller can attach (or not) without branching on env vars at
 * the use site.
 *
 * @param bot The bot instance, threaded into AIAgent for error reporting.
 * @returns A configured AIAgent, or null when AI is disabled.
 */
function createAIAgent(bot: Bot): AIAgent | null {
  if (!isAiEnabled()) {
    logger.debug("AI module disabled (AI_ENABLED!=true) — skipping bootstrap");
    return null;
  }
  const config = readConfigFromEnv();
  const client = createAzureFoundryClient(config.foundry);
  const goodreadsBookSkill = new GoodreadsBookSkill({
    client,
    model: config.foundry.model,
  });
  const sessions = new SessionStore(bot.db, {
    idleMinutes: parseIntEnv("AI_SESSION_IDLE_MINUTES", 30),
    sessionMaxPromptTokens: parseIntEnv("AI_SESSION_MAX_PROMPT_TOKENS", 50_000),
    sessionMaxCompletionTokens: parseIntEnv(
      "AI_SESSION_MAX_COMPLETION_TOKENS",
      20_000,
    ),
  });
  const aiLogger = new AiLogger(bot.db, {
    logRaw: process.env.AI_LOG_RAW === "true",
  });
  const mcp = buildMcpClient(bot);
  const sources: ToolSource[] = [];
  if (mcp) {
    sources.push(
      new McpToolSource(mcp, {
        denyList: [
          "goodreads_search_books",
          "storygraph_search_books",
          "goodreads_search_and_get_book",
          "storygraph_search_and_get_book",
        ],
      }),
    );
  }
  sources.push(new LocalToolSource({ bot, goodreadsBookSkill }));
  const tools = new CompositeToolRegistry(sources);
  return AIAgent.create(
    bot,
    client,
    config.foundry.model,
    sessions,
    aiLogger,
    tools,
  );
}

export { AIAgent } from "./agent";
export { aiMentionHandler } from "./listener";
export { createAIAgent, isAiEnabled };
