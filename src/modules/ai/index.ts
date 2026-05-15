import { Bot } from "../../models";
import { logger } from "../../utils/logHandler";

import { AIAgent, AIAgentConfig } from "./agent";
import { AiLogger } from "./logging";
import { SessionStore } from "./sessions/store";

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
  return AIAgent.create(bot, config, sessions, aiLogger);
}

export { AIAgent } from "./agent";
export { aiMentionHandler } from "./listener";
export { createAIAgent, isAiEnabled };
