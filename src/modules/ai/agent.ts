import OpenAI from "openai";

import { Bot } from "../../models";
import { errorHandler } from "../../utils/errorHandler";

import {
  AzureFoundryConfig,
  createAzureFoundryClient,
} from "./client/azureClient";
import { sanitizeInput, sanitizeOutput } from "./guards";
import { AiLogger } from "./logging";
import { buildInstructions } from "./prompts/promptBuilder";
import { ActiveSession, SessionStore } from "./sessions/store";
import {
  AgentContext,
  AgentFinishReason,
  AgentResult,
  ToolCallLog,
} from "./types";

/**
 * Configuration values the agent loop reads at construction time. All
 * tool/budget knobs land here as the implementation grows; v1 is
 * deliberately small.
 */
export interface AIAgentConfig {
  foundry: AzureFoundryConfig;
}

/**
 * The conversational AI agent. Owns the OpenAI client, session store,
 * and per-turn logger. Callers (mention listener, slash command
 * handlers) invoke `run` with text + context and receive a structured
 * AgentResult back.
 *
 * The agent never touches Discord directly. Delivery to channels or
 * interactions is the caller's job — see `deliver.ts`.
 */
export class AIAgent {
  private readonly bot: Bot;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly sessions: SessionStore;
  private readonly aiLogger: AiLogger;

  /**
   * Initialises an AIAgent.
   *
   * @param bot The bot instance, used for canonical error reporting.
   * @param client The OpenAI SDK client pointed at Foundry.
   * @param model The deployment name to invoke (e.g. Gpt-5.4-mini).
   * @param sessions The SessionStore that owns conversation lifecycle.
   * @param aiLogger The per-turn logger writing to aiInteractions.
   */
  constructor(
    bot: Bot,
    client: OpenAI,
    model: string,
    sessions: SessionStore,
    aiLogger: AiLogger,
  ) {
    this.bot = bot;
    this.client = client;
    this.model = model;
    this.sessions = sessions;
    this.aiLogger = aiLogger;
  }

  /**
   * Convenience constructor that wires up the OpenAI client from a
   * config bundle and reuses the supplied store + logger.
   *
   * @param bot The bot instance, used for canonical error reporting.
   * @param config Foundry endpoint + model.
   * @param sessions The SessionStore instance.
   * @param aiLogger The AiLogger instance.
   * @returns A ready-to-use agent.
   */
  static create(
    bot: Bot,
    config: AIAgentConfig,
    sessions: SessionStore,
    aiLogger: AiLogger,
  ): AIAgent {
    const client = createAzureFoundryClient(config.foundry);
    return new AIAgent(bot, client, config.foundry.model, sessions, aiLogger);
  }

  /**
   * Runs one conversation turn. Resolves or extends a session for the
   * caller's context, calls the Responses API with chained
   * previous_response_id when applicable, persists usage, and returns
   * the structured result for the caller to deliver.
   *
   * @param input Raw text from the user (will be sanitized).
   * @param context Per-call context from the caller.
   * @returns A typed AgentResult ready for delivery.
   */
  async run(input: string, context: AgentContext): Promise<AgentResult> {
    const startedAt = Date.now();
    const sanitized = sanitizeInput(input);
    const session = await this.sessions.getOrCreate(
      context.sessionKey,
      context.source,
    );
    const isFirstTurn = session.lastResponseId === null;
    let response: OpenAI.Responses.Response;
    let finishReason: AgentFinishReason = "stop";
    let outputText = "";
    try {
      response = await this.client.responses.create({
        model: this.model,
        instructions: isFirstTurn ? buildInstructions() : undefined,
        // eslint-disable-next-line camelcase
        previous_response_id: session.lastResponseId ?? undefined,
        input: sanitized,
      });
      outputText = sanitizeOutput(response.output_text ?? "");
    } catch (err) {
      await errorHandler(this.bot, "modules > ai > agent", err);
      finishReason = "error";
      const failure = await this.recordFailure(
        session,
        sanitized,
        startedAt,
        err,
      );
      return failure;
    }
    const promptTokens = response.usage?.input_tokens ?? 0;
    const completionTokens = response.usage?.output_tokens ?? 0;
    const reasoningTokens =
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0;
    const toolCalls: ToolCallLog[] = [];
    await this.sessions.recordTurn(session, {
      openaiResponseId: response.id,
      promptTokens,
      completionTokens,
      reasoningTokens,
      costUsdEstimate: 0,
    });
    await this.aiLogger.recordInteraction(session, {
      openaiResponseId: response.id,
      prevResponseId: isFirstTurn ? null : session.lastResponseId,
      inputText: sanitized,
      outputText,
      promptTokens,
      completionTokens,
      reasoningTokens,
      toolCalls,
      artifacts: [],
      latencyMs: Date.now() - startedAt,
      finishReason,
      costUsdEstimate: 0,
    });
    return {
      text: outputText || undefined,
      session: {
        sessionId: session.id,
        openaiResponseId: response.id,
        turnIndex: session.turnIndex,
      },
      meta: {
        promptTokens,
        completionTokens,
        reasoningTokens,
        toolCalls,
        latencyMs: Date.now() - startedAt,
        finishReason,
        costUsdEstimate: 0,
      },
    };
  }

  private async recordFailure(
    session: ActiveSession,
    input: string,
    startedAt: number,
    _err: unknown,
  ): Promise<AgentResult> {
    await this.aiLogger.recordInteraction(session, {
      openaiResponseId: "error",
      prevResponseId: session.lastResponseId,
      inputText: input,
      outputText: null,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      toolCalls: [],
      artifacts: [],
      latencyMs: Date.now() - startedAt,
      finishReason: "error",
      costUsdEstimate: 0,
    });
    return {
      text: "Sorry — something went wrong reaching the assistant. Please try again in a moment.",
      session: {
        sessionId: session.id,
        openaiResponseId: "error",
        turnIndex: session.turnIndex,
      },
      meta: {
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        toolCalls: [],
        latencyMs: Date.now() - startedAt,
        finishReason: "error",
        costUsdEstimate: 0,
      },
    };
  }
}
