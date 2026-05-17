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
import { ToolRegistry } from "./tools/registry";
import {
  AgentContext,
  AgentFinishReason,
  AgentResult,
  ToolCallLog,
} from "./types";

const MAX_TOOL_ITERATIONS = 6;

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

function safeParseJson(raw: string): ParseResult {
  if (!raw) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

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
 * per-turn logger, and a ToolRegistry that abstracts where each tool
 * is dispatched (OWS MCP, local Gregg code, hosted Foundry tool).
 * Callers (mention listener, slash command handlers) invoke `run` with
 * text + context and receive a structured AgentResult back.
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
  private readonly tools: ToolRegistry;

  /**
   * Initialises an AIAgent.
   *
   * @param bot The bot instance, used for canonical error reporting.
   * @param client The OpenAI SDK client pointed at Foundry.
   * @param model The deployment name to invoke (e.g. Gpt-5.4-mini).
   * @param sessions The SessionStore that owns conversation lifecycle.
   * @param aiLogger The per-turn logger writing to aiInteractions.
   * @param tools The ToolRegistry that lists and dispatches tools.
   */
  constructor(
    bot: Bot,
    client: OpenAI,
    model: string,
    sessions: SessionStore,
    aiLogger: AiLogger,
    tools: ToolRegistry,
  ) {
    this.bot = bot;
    this.client = client;
    this.model = model;
    this.sessions = sessions;
    this.aiLogger = aiLogger;
    this.tools = tools;
  }

  /**
   * Convenience constructor that wires up the OpenAI client from a
   * config bundle and reuses the supplied store + logger + registry.
   *
   * @param bot The bot instance, used for canonical error reporting.
   * @param config Foundry endpoint + model.
   * @param sessions The SessionStore instance.
   * @param aiLogger The AiLogger instance.
   * @param tools The ToolRegistry instance.
   * @returns A ready-to-use agent.
   */
  static create(
    bot: Bot,
    config: AIAgentConfig,
    sessions: SessionStore,
    aiLogger: AiLogger,
    tools: ToolRegistry,
  ): AIAgent {
    const client = createAzureFoundryClient(config.foundry);
    return new AIAgent(
      bot,
      client,
      config.foundry.model,
      sessions,
      aiLogger,
      tools,
    );
  }

  /**
   * Runs one conversation turn. Resolves or extends a session for the
   * caller's context, calls the Responses API with chained
   * previous_response_id when applicable, runs the function-call
   * dispatch loop until the model produces a final message (or hits
   * the iteration cap), persists usage, and returns the structured
   * result for the caller to deliver.
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
    const tools = await this.tools.list();
    const totals = { prompt: 0, completion: 0, reasoning: 0 };
    const toolCalls: ToolCallLog[] = [];
    let chainAnchor = session.lastResponseId;
    let nextInput: OpenAI.Responses.ResponseCreateParams["input"] = sanitized;
    let finishReason: AgentFinishReason = "stop";
    let response: OpenAI.Responses.Response | null = null;
    let sendInstructions = isFirstTurn;
    try {
      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        const isLastIter = iter === MAX_TOOL_ITERATIONS - 1;
        response = await this.callResponses({
          instructions: sendInstructions ? buildInstructions() : undefined,
          previousResponseId: chainAnchor,
          input: nextInput,
          tools: isLastIter ? undefined : tools,
        });
        sendInstructions = false;
        this.accumulateUsage(totals, response);
        const funcCalls = response.output.filter(
          (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === "function_call",
        );
        if (funcCalls.length === 0) {
          if (isLastIter && chainAnchor !== session.lastResponseId) {
            finishReason = "length";
          }
          break;
        }
        if (isLastIter) {
          finishReason = "length";
          break;
        }
        const outputs = await this.dispatchToolCalls(funcCalls, toolCalls);
        chainAnchor = response.id;
        nextInput = outputs;
      }
    } catch (err) {
      await errorHandler(this.bot, "modules > ai > agent", err);
      return await this.recordFailure(session, sanitized, startedAt, toolCalls);
    }
    if (!response) {
      return await this.recordFailure(session, sanitized, startedAt, toolCalls);
    }
    const outputText = sanitizeOutput(response.output_text ?? "");
    await this.sessions.recordTurn(session, {
      openaiResponseId: response.id,
      promptTokens: totals.prompt,
      completionTokens: totals.completion,
      reasoningTokens: totals.reasoning,
      costUsdEstimate: 0,
    });
    await this.aiLogger.recordInteraction(session, {
      openaiResponseId: response.id,
      prevResponseId: isFirstTurn ? null : session.lastResponseId,
      inputText: sanitized,
      outputText,
      promptTokens: totals.prompt,
      completionTokens: totals.completion,
      reasoningTokens: totals.reasoning,
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
        promptTokens: totals.prompt,
        completionTokens: totals.completion,
        reasoningTokens: totals.reasoning,
        toolCalls,
        latencyMs: Date.now() - startedAt,
        finishReason,
        costUsdEstimate: 0,
      },
    };
  }

  private async callResponses(args: {
    instructions: string | undefined;
    previousResponseId: string | null;
    input: OpenAI.Responses.ResponseCreateParams["input"];
    tools: OpenAI.Responses.Tool[] | undefined;
  }): Promise<OpenAI.Responses.Response> {
    const hasTools = args.tools !== undefined && args.tools.length > 0;
    return await this.client.responses.create({
      model: this.model,
      instructions: args.instructions,
      // eslint-disable-next-line camelcase
      previous_response_id: args.previousResponseId ?? undefined,
      input: args.input,
      tools: hasTools ? args.tools : undefined,
      // eslint-disable-next-line camelcase
      parallel_tool_calls: hasTools ? false : undefined,
    });
  }

  private accumulateUsage(
    totals: { prompt: number; completion: number; reasoning: number },
    response: OpenAI.Responses.Response,
  ): void {
    totals.prompt += response.usage?.input_tokens ?? 0;
    totals.completion += response.usage?.output_tokens ?? 0;
    totals.reasoning +=
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0;
  }

  private async dispatchToolCalls(
    funcCalls: OpenAI.Responses.ResponseFunctionToolCall[],
    log: ToolCallLog[],
  ): Promise<OpenAI.Responses.ResponseInputItem[]> {
    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of funcCalls) {
      const toolStart = Date.now();
      const parsed = safeParseJson(call.arguments);
      let result;
      if (parsed.ok) {
        result = await this.tools.dispatch(call.name, parsed.value);
      } else {
        result = {
          ok: false,
          text: JSON.stringify({
            error: "invalid_arguments",
            detail: parsed.error,
            raw: call.arguments,
          }),
          errorCode: "invalid_arguments",
        };
      }
      log.push({
        name: call.name,
        args: parsed.ok ? parsed.value : { __unparsed: call.arguments },
        ok: result.ok,
        latencyMs: Date.now() - toolStart,
        errorCode: result.errorCode,
      });
      outputs.push({
        type: "function_call_output",
        // eslint-disable-next-line camelcase
        call_id: call.call_id,
        output: result.text,
      });
    }
    return outputs;
  }

  private async recordFailure(
    session: ActiveSession,
    input: string,
    startedAt: number,
    toolCalls: ToolCallLog[],
  ): Promise<AgentResult> {
    await this.aiLogger.recordInteraction(session, {
      openaiResponseId: "error",
      prevResponseId: session.lastResponseId,
      inputText: input,
      outputText: null,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      toolCalls,
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
        toolCalls,
        latencyMs: Date.now() - startedAt,
        finishReason: "error",
        costUsdEstimate: 0,
      },
    };
  }
}
