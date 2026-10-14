import { EngineFeedEntry, EngineFeedPage } from "./types";

const EVENT_ENTRY_TYPES = new Set([
  "event.created",
  "event.updated",
  "event.status_changed",
  "event.links_changed",
  "participation.changed",
  "event.results_recorded",
]);

/**
 * Remembers the most recent entry ids so at-least-once redeliveries are
 * dropped. Bounded: the oldest ids are evicted first.
 */
class RecentIds {
  private readonly ids = new Set<string>();

  constructor(private readonly limit: number) {}

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    this.ids.add(id);
    while (this.ids.size > this.limit) {
      const oldest = this.ids.values().next().value as string;
      this.ids.delete(oldest);
    }
  }
}

/**
 * Persists the feed cursor per installation.
 */
export interface FeedCursorStore {
  get(installationId: string): Promise<string | null>;
  set(installationId: string, guildId: string, cursor: string): Promise<void>;
}

/**
 * Something that can read a club feed: an installation client.
 */
export interface FeedSource {
  readonly guildId: string;
  readonly installation: { id: string };
  readFeed(after: string, limit?: number): Promise<EngineFeedPage>;
}

/**
 * Receives new (deduplicated) feed entries for one installation.
 */
export type FeedHandler = (
  source: FeedSource,
  entries: EngineFeedEntry[],
) => Promise<void>;

/**
 * Options for {@link FeedConsumer}.
 */
export interface FeedConsumerOptions {
  store: FeedCursorStore;
  handler: FeedHandler;
  pageSize?: number;
  maxPagesPerPoll?: number;
  dedupeWindow?: number;
  replayOnFirstRun?: boolean;
}

/**
 * A status change found in the feed.
 */
export interface FeedStatusChange {
  eventId: string;
  from: string | null;
  to: string;
  reason: string | null;
}

/**
 * What a batch of feed entries asks Gregg to do.
 */
export interface FeedSummary {
  eventIds: string[];
  statusChanges: FeedStatusChange[];
}

/**
 * Reduces feed entries to the events whose Discord messages need a refresh
 * (each once, in feed order) and the status changes to log.
 *
 * @param entries The feed entries.
 * @returns The summary.
 */
export function summarizeFeed(entries: EngineFeedEntry[]): FeedSummary {
  const eventIds: string[] = [];
  const seen = new Set<string>();
  const statusChanges: FeedStatusChange[] = [];
  for (const entry of entries) {
    if (!EVENT_ENTRY_TYPES.has(entry.type)) continue;
    const eventId = entry.data.eventId;
    if (typeof eventId !== "string") continue;
    if (!seen.has(eventId)) {
      seen.add(eventId);
      eventIds.push(eventId);
    }
    if (entry.type === "event.status_changed") {
      statusChanges.push({
        eventId,
        from: typeof entry.data.from === "string" ? entry.data.from : null,
        to: String(entry.data.to),
        reason:
          typeof entry.data.reason === "string" ? entry.data.reason : null,
      });
    }
  }
  return { eventIds, statusChanges };
}

/**
 * Polls installation feeds. Entries are delivered at least once and in `seq`
 * order; the cursor is saved after each handled page, so a crash replays at
 * most one page, and redelivered ids are skipped. On the very first poll of
 * an installation (no stored cursor) the consumer fast-forwards to the head
 * instead of replaying 30 days of history, unless `replayOnFirstRun` is set.
 */
export class FeedConsumer {
  private readonly store: FeedCursorStore;
  private readonly handler: FeedHandler;
  private readonly pageSize: number;
  private readonly maxPagesPerPoll: number;
  private readonly dedupeWindow: number;
  private readonly replayOnFirstRun: boolean;
  private readonly recent = new Map<string, RecentIds>();
  private readonly inFlight = new Set<string>();

  /**
   * Creates a consumer.
   *
   * @param options The cursor store, handler and limits.
   */
  constructor(options: FeedConsumerOptions) {
    this.store = options.store;
    this.handler = options.handler;
    this.pageSize = options.pageSize ?? 100;
    this.maxPagesPerPoll = options.maxPagesPerPoll ?? 10;
    this.dedupeWindow = options.dedupeWindow ?? 5000;
    this.replayOnFirstRun = options.replayOnFirstRun ?? false;
  }

  /**
   * Reads and handles new entries for one installation. Overlapping polls of
   * the same installation are skipped.
   *
   * @param source The installation to poll.
   * @returns The number of entries handed to the handler.
   */
  async poll(source: FeedSource): Promise<number> {
    const key = source.installation.id;
    if (this.inFlight.has(key)) return 0;
    this.inFlight.add(key);
    try {
      const stored = await this.store.get(key);
      if (stored === null && !this.replayOnFirstRun) {
        await this.fastForward(source);
        return 0;
      }
      return await this.drain(source, stored ?? "0");
    } finally {
      this.inFlight.delete(key);
    }
  }

  private recentFor(key: string): RecentIds {
    let recent = this.recent.get(key);
    if (!recent) {
      recent = new RecentIds(this.dedupeWindow);
      this.recent.set(key, recent);
    }
    return recent;
  }

  private async drain(source: FeedSource, start: string): Promise<number> {
    const key = source.installation.id;
    const recent = this.recentFor(key);
    let cursor = start;
    let delivered = 0;
    for (let page = 0; page < this.maxPagesPerPoll; page += 1) {
      const result = await source.readFeed(cursor, this.pageSize);
      const fresh = result.items.filter((entry) => !recent.has(entry.id));
      if (fresh.length > 0) {
        await this.handler(source, fresh);
        fresh.forEach((entry) => recent.add(entry.id));
        delivered += fresh.length;
      }
      if (result.nextCursor !== cursor) {
        cursor = result.nextCursor;
        await this.store.set(key, source.guildId, cursor);
      }
      if (result.items.length < this.pageSize) break;
    }
    return delivered;
  }

  private async fastForward(source: FeedSource): Promise<void> {
    let cursor = "0";
    for (;;) {
      const result = await source.readFeed(cursor, 500);
      cursor = result.nextCursor;
      if (result.items.length < 500) break;
    }
    await this.store.set(source.installation.id, source.guildId, cursor);
  }
}
