import { PrismaClient } from "@prisma/client";

import { logger } from "../../../utils/logHandler";
import { AgentSource, SessionKey } from "../types";

import { sessionCacheKey } from "./key";

const DEFAULT_IDLE_MINUTES = 30;
const DEFAULT_SESSION_MAX_PROMPT_TOKENS = 50_000;
const DEFAULT_SESSION_MAX_COMPLETION_TOKENS = 20_000;

/**
 * Active-session record cached in-memory and mirrored to Mongo. The
 * canonical row lives in the aiSessions collection; this struct is a
 * lightweight view of the fields the agent loop needs hot.
 */
export interface ActiveSession {
  id: string;
  key: SessionKey;
  source: AgentSource;
  turnIndex: number;
  lastResponseId: string | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  startedAt: Date;
  lastTurnAt: Date;
}

/**
 * Per-turn statistics persisted by recordTurn.
 */
export interface TurnRecord {
  openaiResponseId: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsdEstimate: number;
}

/**
 * Reason a session was closed. Mirrored into aiSessions.closeReason.
 */
export type SessionCloseReason =
  | "idle"
  | "capped"
  | "revoked"
  | "oneshot"
  | "explicit_reset"
  | "error";

/**
 * Configuration knobs for session lifecycle policy. Defaults match the
 * AI_SESSION_* env vars described in the plan.
 */
export interface SessionStoreConfig {
  idleMinutes: number;
  sessionMaxPromptTokens: number;
  sessionMaxCompletionTokens: number;
}

/**
 * Holds the active conversation for each (guild, channel/thread, user)
 * triple. In-memory cache layered over the aiSessions Mongo collection
 * so the hot path is a single Map lookup; Mongo is the source of truth
 * across restarts.
 */
export class SessionStore {
  private cache: Map<string, ActiveSession> = new Map();
  private readonly db: PrismaClient;
  private readonly config: SessionStoreConfig;

  /**
   * Constructs a SessionStore backed by the given Prisma client.
   *
   * @param db The Prisma client used to read/write aiSessions.
   * @param config Optional lifecycle overrides; defaults are reasonable.
   */
  constructor(db: PrismaClient, config: Partial<SessionStoreConfig> = {}) {
    this.db = db;
    this.config = {
      idleMinutes: config.idleMinutes ?? DEFAULT_IDLE_MINUTES,
      sessionMaxPromptTokens:
        config.sessionMaxPromptTokens ?? DEFAULT_SESSION_MAX_PROMPT_TOKENS,
      sessionMaxCompletionTokens:
        config.sessionMaxCompletionTokens ??
        DEFAULT_SESSION_MAX_COMPLETION_TOKENS,
    };
  }

  /**
   * Returns the active session for the given key, opening a new one (or
   * rotating after idle / cap) if needed. For one-shot slash sources, a
   * brand new session is created on every call and never cached.
   *
   * @param key The session coordinates.
   * @param source Whether this invocation came from a mention or a slash command.
   * @returns The session to use for the upcoming turn.
   */
  async getOrCreate(
    key: SessionKey,
    source: AgentSource,
  ): Promise<ActiveSession> {
    if (source === "slash") {
      return this.openFresh(key, source);
    }
    const cacheKey = sessionCacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (cached && this.shouldReuse(cached)) {
      return cached;
    }
    if (cached) {
      await this.close(cached, this.expireReason(cached));
    }
    const rehydrated = await this.rehydrateFromMongo(key);
    if (rehydrated) {
      if (this.shouldReuse(rehydrated)) {
        this.cache.set(cacheKey, rehydrated);
        return rehydrated;
      }
      await this.close(rehydrated, this.expireReason(rehydrated));
    }
    return this.openFresh(key, source);
  }

  /**
   * Records a completed turn against a session: bumps counters, updates
   * lastResponseId for the next chain step, and writes the row through
   * to Mongo. For one-shot slash sessions, also closes the session.
   *
   * @param session The session the turn belongs to.
   * @param turn The per-turn statistics to record.
   */
  async recordTurn(session: ActiveSession, turn: TurnRecord): Promise<void> {
    const now = new Date();
    const nextTurnIndex = session.turnIndex + 1;
    await this.db.aiSessions.update({
      where: { id: session.id },
      data: {
        turnCount: nextTurnIndex,
        lastResponseId: turn.openaiResponseId,
        lastTurnAt: now,
        totalPromptTokens: { increment: turn.promptTokens },
        totalCompletionTokens: { increment: turn.completionTokens },
        totalReasoningTokens: { increment: turn.reasoningTokens },
        totalCostUsd: { increment: turn.costUsdEstimate },
      },
    });
    session.turnIndex = nextTurnIndex;
    session.lastResponseId = turn.openaiResponseId;
    session.totalPromptTokens += turn.promptTokens;
    session.totalCompletionTokens += turn.completionTokens;
    session.lastTurnAt = now;
    if (session.source === "slash") {
      await this.close(session, "oneshot");
    } else if (this.exceedsCap(session)) {
      await this.close(session, "capped");
    }
  }

  /**
   * Closes a session, evicting it from the in-memory cache and stamping
   * the close reason in Mongo. Safe to call multiple times.
   *
   * @param session The session to close.
   * @param reason Why it's being closed.
   */
  async close(
    session: ActiveSession,
    reason: SessionCloseReason,
  ): Promise<void> {
    this.cache.delete(sessionCacheKey(session.key));
    try {
      await this.db.aiSessions.update({
        where: { id: session.id },
        data: {
          status: reason === "oneshot" ? "oneshot" : reason,
          closedAt: new Date(),
          closeReason: reason,
        },
      });
    } catch (err) {
      logger.warn(err, `Failed to close aiSessions row ${session.id}`);
    }
  }

  private async openFresh(
    key: SessionKey,
    source: AgentSource,
  ): Promise<ActiveSession> {
    const now = new Date();
    const row = await this.db.aiSessions.create({
      data: {
        guildId: key.guildId,
        channelId: key.channelId,
        isThread: key.isThread,
        userId: key.userId,
        source,
        status: source === "slash" ? "oneshot" : "active",
        startedAt: now,
        lastTurnAt: now,
      },
    });
    const session: ActiveSession = {
      id: row.id,
      key,
      source,
      turnIndex: 0,
      lastResponseId: null,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      startedAt: now,
      lastTurnAt: now,
    };
    if (source === "mention") {
      this.cache.set(sessionCacheKey(key), session);
    }
    return session;
  }

  private async rehydrateFromMongo(
    key: SessionKey,
  ): Promise<ActiveSession | null> {
    const row = await this.db.aiSessions.findFirst({
      where: {
        guildId: key.guildId,
        channelId: key.channelId,
        userId: key.userId,
        status: "active",
      },
      orderBy: { lastTurnAt: "desc" },
    });
    if (!row) return null;
    return {
      id: row.id,
      key: { ...key, isThread: row.isThread },
      source: row.source as AgentSource,
      turnIndex: row.turnCount,
      lastResponseId: row.lastResponseId,
      totalPromptTokens: row.totalPromptTokens,
      totalCompletionTokens: row.totalCompletionTokens,
      startedAt: row.startedAt,
      lastTurnAt: row.lastTurnAt,
    };
  }

  private shouldReuse(session: ActiveSession): boolean {
    if (this.exceedsCap(session)) return false;
    const ageMs = Date.now() - session.lastTurnAt.getTime();
    return ageMs < this.config.idleMinutes * 60_000;
  }

  private exceedsCap(session: ActiveSession): boolean {
    return (
      session.totalPromptTokens >= this.config.sessionMaxPromptTokens ||
      session.totalCompletionTokens >= this.config.sessionMaxCompletionTokens
    );
  }

  private expireReason(session: ActiveSession): SessionCloseReason {
    return this.exceedsCap(session) ? "capped" : "idle";
  }
}
