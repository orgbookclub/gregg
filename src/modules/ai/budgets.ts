import { PrismaClient } from "@prisma/client";
import { GuildMember } from "discord.js";

import { logger } from "../../utils/logHandler";

import { SessionKey } from "./types";

const DEFAULT_TURN_MAX_TOKENS = 10_000;
const DEFAULT_DAILY_TOKEN_BUDGET = 100_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-turn and per-day token budget knobs plus the controls that
 * disable enforcement entirely (`enabled=false`) or exempt members
 * with a specific role (`bypassRoleId`). Both ceilings count
 * `promptTokens + completionTokens`; reasoning tokens are excluded
 * because the user isn't billed for them in the same way and they
 * inflate noisily on multi-iteration turns.
 */
export interface BudgetCheckerConfig {
  enabled: boolean;
  turnMaxTokens: number;
  dailyTokenBudget: number;
  bypassRoleId?: string;
}

/**
 * Result of a per-day budget check. When `ok` is false, the agent
 * refuses the turn and surfaces the numbers to the user so they
 * understand why.
 */
export interface DailyBudgetCheck {
  ok: boolean;
  usedTokens: number;
  budget: number;
}

/**
 * Enforces two independent token ceilings on top of the per-session
 * caps that SessionStore already enforces:
 *
 *   - Per turn: prevents a single agent invocation from running
 *     through the iteration loop until its tokens balloon. Checked
 *     after each Responses-API call inside the loop; when exceeded,
 *     the loop breaks with finishReason="budget" and the partial
 *     response (whatever the model has written so far) is delivered.
 *   - Per (guild, user, rolling 24h): prevents a single user from
 *     monopolising the API spend. Checked once at turn start by
 *     summing aiInteractions for the last 24 hours scoped to the
 *     user's sessions in this guild; if over, the agent refuses
 *     without spending any further tokens.
 *
 * Database failures fail open (the check returns ok=true and logs
 * a warning) — a degraded budget check is preferable to blocking
 * the agent on a transient Mongo hiccup.
 */
export class BudgetChecker {
  private readonly db: PrismaClient;
  private readonly config: BudgetCheckerConfig;

  /**
   * Constructs a BudgetChecker.
   *
   * @param db The Prisma client used to aggregate aiInteractions.
   * @param config Optional overrides; defaults are reasonable for v1.
   */
  constructor(db: PrismaClient, config: Partial<BudgetCheckerConfig> = {}) {
    this.db = db;
    this.config = {
      enabled: config.enabled ?? true,
      turnMaxTokens: config.turnMaxTokens ?? DEFAULT_TURN_MAX_TOKENS,
      dailyTokenBudget: config.dailyTokenBudget ?? DEFAULT_DAILY_TOKEN_BUDGET,
      bypassRoleId: config.bypassRoleId,
    };
  }

  /**
   * Returns true when budgets should be enforced for the given
   * caller. Returns false when budgets are globally disabled via
   * config OR the caller's member has the configured bypass role.
   * The agent calls this once at the top of run() and skips both
   * the daily check and the per-turn check when it returns false.
   *
   * @param member The Discord guild member invoking the agent, if any.
   * @returns Whether budget checks should run for this caller.
   */
  isEnforcedFor(member: GuildMember | undefined): boolean {
    if (!this.config.enabled) return false;
    if (
      this.config.bypassRoleId &&
      member?.roles.cache.has(this.config.bypassRoleId)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Checks whether the (guild, user) pair has tokens remaining in
   * their rolling 24-hour budget. Aggregates aiInteractions over the
   * user's sessions in this guild filtered to the last 24h. Fails
   * open on database errors so a degraded Mongo doesn't shut the
   * agent down.
   *
   * @param key The session coordinates identifying (guildId, userId).
   * @returns The check result with current usage + budget for messaging.
   */
  async checkDailyBudget(key: SessionKey): Promise<DailyBudgetCheck> {
    const since = new Date(Date.now() - DAY_MS);
    try {
      const sessions = await this.db.aiSessions.findMany({
        where: { guildId: key.guildId, userId: key.userId },
        select: { id: true },
      });
      if (sessions.length === 0) {
        return {
          ok: true,
          usedTokens: 0,
          budget: this.config.dailyTokenBudget,
        };
      }
      const aggregate = await this.db.aiInteractions.aggregate({
        where: {
          sessionId: { in: sessions.map((s) => s.id) },
          createdAt: { gte: since },
        },
        _sum: { promptTokens: true, completionTokens: true },
      });
      const used =
        (aggregate._sum.promptTokens ?? 0) +
        (aggregate._sum.completionTokens ?? 0);
      return {
        ok: used < this.config.dailyTokenBudget,
        usedTokens: used,
        budget: this.config.dailyTokenBudget,
      };
    } catch (err) {
      logger.warn(err, "BudgetChecker: daily budget check failed; allowing");
      return {
        ok: true,
        usedTokens: 0,
        budget: this.config.dailyTokenBudget,
      };
    }
  }

  /**
   * Pure check: has this turn's accumulated prompt+completion tokens
   * crossed the per-turn ceiling? Called by the agent loop after
   * each Responses-API iteration.
   *
   * @param totals The per-turn token accumulator the agent maintains.
   * @returns True if the loop should stop synthesising more tool calls.
   */
  isOverTurnBudget(totals: { prompt: number; completion: number }): boolean {
    return totals.prompt + totals.completion >= this.config.turnMaxTokens;
  }
}
