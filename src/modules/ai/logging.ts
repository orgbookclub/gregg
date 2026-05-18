import { createHash } from "crypto";

import { PrismaClient } from "@prisma/client";

import { logger } from "../../utils/logHandler";

import { ActiveSession } from "./sessions/store";
import { AgentFinishReason, ArtifactKind, ToolCallLog } from "./types";

/**
 * Per-turn payload persisted into the aiInteractions collection.
 */
export interface InteractionRecord {
  openaiResponseId: string;
  prevResponseId: string | null;
  inputText: string;
  outputText: string | null;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  toolCalls: ToolCallLog[];
  artifacts: { kind: ArtifactKind; index: number }[];
  latencyMs: number;
  finishReason: AgentFinishReason;
  costUsdEstimate: number;
}

/**
 * Configuration for the logger. Controls whether raw user input and
 * model output are persisted (off by default for privacy).
 */
export interface AiLoggingConfig {
  logRaw: boolean;
}

/**
 * Persists per-turn agent interactions to the aiInteractions collection.
 * Errors here are logged and swallowed — logging failures must not
 * break the agent loop.
 */
export class AiLogger {
  private readonly db: PrismaClient;
  private readonly config: AiLoggingConfig;

  /**
   * Builds a logger bound to the given Prisma client.
   *
   * @param db The Prisma client.
   * @param config Logging behaviour toggles.
   */
  constructor(db: PrismaClient, config: AiLoggingConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Writes one aiInteractions row representing a single agent turn.
   *
   * @param session The session this turn belongs to.
   * @param record The turn payload.
   */
  async recordInteraction(
    session: ActiveSession,
    record: InteractionRecord,
  ): Promise<void> {
    try {
      await this.db.aiInteractions.create({
        data: {
          sessionId: session.id,
          turnIndex: session.turnIndex,
          openaiResponseId: record.openaiResponseId,
          prevResponseId: record.prevResponseId,
          inputHash: this.hash(record.inputText),
          inputRaw: this.config.logRaw ? record.inputText : null,
          outputRaw: this.config.logRaw ? record.outputText : null,
          promptTokens: record.promptTokens,
          completionTokens: record.completionTokens,
          reasoningTokens: record.reasoningTokens,
          toolCalls: record.toolCalls as unknown as object[],
          artifacts: record.artifacts as unknown as object[],
          latencyMs: record.latencyMs,
          finishReason: record.finishReason,
          costUsdEstimate: record.costUsdEstimate,
        },
      });
    } catch (err) {
      logger.warn(err, "Failed to persist aiInteractions row");
    }
  }

  private hash(input: string): string {
    return createHash("sha256").update(input).digest("hex");
  }
}
