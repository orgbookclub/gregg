import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FeedConsumer,
  FeedCursorStore,
  FeedSource,
  summarizeFeed,
} from "../src/modules/engine/feed";
import { EngineFeedEntry } from "../src/modules/engine/types";

function entry(
  seq: number,
  type: EngineFeedEntry["type"],
  data: Record<string, unknown>,
  id = `e${seq}`,
): EngineFeedEntry {
  return {
    id,
    seq,
    version: 1,
    type,
    clubId: "club1",
    occurredAt: "2026-10-14T00:00:00Z",
    data,
  };
}

function memoryStore(initial: Record<string, string> = {}) {
  const cursors = new Map(Object.entries(initial));
  const store: FeedCursorStore = {
    get: (id) => Promise.resolve(cursors.get(id) ?? null),
    set: (id, _guild, cursor) => {
      cursors.set(id, cursor);
      return Promise.resolve();
    },
  };
  return { store, cursors };
}

function source(entries: EngineFeedEntry[], redeliver = 0): FeedSource {
  return {
    guildId: "guild1",
    installation: { id: "inst1" },
    readFeed: (after, limit = 100) => {
      const start = Math.max(0, Number(after) - redeliver);
      const items = entries.filter((item) => item.seq > start).slice(0, limit);
      return Promise.resolve({
        items,
        nextCursor: items.length ? String(items.at(-1)?.seq) : after,
      });
    },
  };
}

describe("feed consumer", () => {
  const feed = [
    entry(1, "event.created", { eventId: "a", status: "requested" }),
    entry(2, "participation.changed", { eventId: "a", userId: "u" }),
    entry(3, "membership.changed", { userId: "u" }),
    entry(4, "event.status_changed", {
      eventId: "a",
      from: "requested",
      to: "approved",
    }),
    entry(5, "event.links_changed", { eventId: "b" }),
  ];

  it("summarizes entries into events to refresh and status changes", () => {
    const summary = summarizeFeed(feed);
    assert.deepEqual(summary.eventIds, ["a", "b"]);
    assert.deepEqual(summary.statusChanges, [
      { eventId: "a", from: "requested", to: "approved", reason: null },
    ]);
  });

  it("fast-forwards on first run instead of replaying history", async () => {
    const { store, cursors } = memoryStore();
    const handled: string[] = [];
    const consumer = new FeedConsumer({
      store,
      handler: (_s, items) => {
        handled.push(...items.map((i) => i.id));
        return Promise.resolve();
      },
    });
    assert.equal(await consumer.poll(source(feed)), 0);
    assert.deepEqual(handled, []);
    assert.equal(cursors.get("inst1"), "5");
  });

  it("delivers new entries in pages and saves the cursor", async () => {
    const { store, cursors } = memoryStore({ inst1: "1" });
    const batches: string[][] = [];
    const consumer = new FeedConsumer({
      store,
      pageSize: 2,
      handler: (_s, items) => {
        batches.push(items.map((i) => i.id));
        return Promise.resolve();
      },
    });
    assert.equal(await consumer.poll(source(feed)), 4);
    assert.deepEqual(batches, [
      ["e2", "e3"],
      ["e4", "e5"],
    ]);
    assert.equal(cursors.get("inst1"), "5");
  });

  it("drops redelivered entries (at-least-once)", async () => {
    const { store } = memoryStore({ inst1: "0" });
    const handled: string[] = [];
    const consumer = new FeedConsumer({
      store,
      handler: (_s, items) => {
        handled.push(...items.map((i) => i.id));
        return Promise.resolve();
      },
    });
    const redelivering = source(feed, 2);
    await consumer.poll(redelivering);
    await consumer.poll(redelivering);
    assert.deepEqual(handled, ["e1", "e2", "e3", "e4", "e5"]);
  });

  it("keeps the cursor when the handler fails so entries are retried", async () => {
    const { store, cursors } = memoryStore({ inst1: "3" });
    let fail = true;
    const handled: string[] = [];
    const consumer = new FeedConsumer({
      store,
      handler: (_s, items) => {
        if (fail) return Promise.reject(new Error("discord down"));
        handled.push(...items.map((i) => i.id));
        return Promise.resolve();
      },
    });
    await assert.rejects(consumer.poll(source(feed)));
    assert.equal(cursors.get("inst1"), "3");
    fail = false;
    await consumer.poll(source(feed));
    assert.deepEqual(handled, ["e4", "e5"]);
  });

  it("skips overlapping polls of the same installation", async () => {
    const { store } = memoryStore({ inst1: "0" });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const consumer = new FeedConsumer({ store, handler: () => gate });
    const first = consumer.poll(source(feed));
    assert.equal(await consumer.poll(source(feed)), 0);
    release();
    assert.equal(await first, 5);
  });
});
