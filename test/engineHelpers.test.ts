import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { actorFromDiscord, actorHeaders } from "../src/modules/engine/actor";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  buildEngineStaffRow,
} from "../src/modules/engine/embeds";
import {
  discordThreadIds,
  discordThreadLink,
  withDiscordLink,
} from "../src/modules/engine/links";
import {
  engineTypeKey,
  formatEngineUser,
  toEngineStatsWindow,
} from "../src/modules/engine/mappings";
import {
  isTierSyncEnabled,
  planTierRoleChanges,
  resolveTierRoleMap,
} from "../src/modules/engine/tierRoles";
import {
  EngineEventDetail,
  EngineParticipant,
  EngineReaderTier,
  EngineUserSummary,
} from "../src/modules/engine/types";

function user(id: string, discordId?: string): EngineUserSummary {
  return {
    id,
    displayName: `User ${id}`,
    avatarUrl: null,
    isClaimed: true,
    platforms: discordId
      ? [{ provider: "discord", username: `u${id}`, subject: discordId }]
      : [],
  };
}

describe("actor", () => {
  it("drops @everyone and reads roles from cached or raw members", () => {
    const cached = actorFromDiscord({
      user: { id: "1", username: "ann" },
      member: {
        roles: {
          cache: new Map([
            ["g", {}],
            ["r1", {}],
          ]),
        },
      },
      guildId: "g",
    });
    assert.deepEqual(cached.roles, ["r1"]);
    const raw = actorFromDiscord({
      user: { id: "1", username: "ann" },
      member: { roles: ["r2"] },
      guildId: "g",
    });
    assert.deepEqual(actorHeaders(raw), {
      "X-Actor-Provider": "discord",
      "X-Actor-Subject": "1",
      "X-Actor-Name": "ann",
      "X-Actor-Roles": "r2",
    });
  });
});

describe("mappings", () => {
  it("maps OWS event types to engine keys", () => {
    assert.equal(engineTypeKey("BuddyRead"), "buddy-read");
    assert.equal(engineTypeKey("MonthlyRead"), "book-of-the-month");
    assert.equal(engineTypeKey("ShortStoryRead"), "short-story-read");
  });

  it("maps date windows onto engine stats windows", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    assert.deepEqual(toEngineStatsWindow(null, { label: "All Time" }, now), {
      window: "all_time",
    });
    assert.deepEqual(toEngineStatsWindow("last-year", { label: "x" }, now), {
      window: "year",
      year: 2025,
    });
    assert.deepEqual(
      toEngineStatsWindow(
        null,
        {
          label: "Q1",
          after: new Date("2026-01-01T00:00:00Z"),
          before: new Date("2026-04-01T00:00:00Z"),
        },
        now,
      ),
      { window: "custom", from: "2026-01-01", to: "2026-03-31" },
    );
  });

  it("mentions users when the engine exposes the Discord id", () => {
    assert.equal(formatEngineUser(user("a", "123")), "<@123>");
    assert.equal(formatEngineUser(user("b")), "User b");
  });
});

describe("thread links", () => {
  it("keeps other Discord links and replaces the same thread", () => {
    const existing = [
      {
        platform: "web",
        kind: "meeting" as const,
        url: "https://meet.example.com",
        externalId: null,
        label: null,
      },
      {
        platform: "discord",
        kind: "thread" as const,
        url: "https://discord.com/channels/g/1",
        externalId: "1",
        label: "#old",
      },
    ];
    const added = withDiscordLink(
      existing,
      discordThreadLink("g", { id: "2", name: "new" }),
    );
    assert.deepEqual(
      added.map((l) => l.externalId),
      ["1", "2"],
    );
    assert.ok(added.every((l) => l.platform === "discord"));
    const renamed = withDiscordLink(
      existing,
      discordThreadLink("g", { id: "1", name: "renamed" }),
    );
    assert.deepEqual(
      renamed.map((l) => l.label),
      ["#renamed"],
    );
    assert.deepEqual(discordThreadIds(existing), ["1"]);
  });
});

describe("tier roles", () => {
  const tiers: EngineReaderTier[] = [
    {
      id: "t1",
      name: "Bookworm",
      color: "#000",
      minPoints: 50,
      window: "all_time",
      awardMode: "threshold",
    },
    {
      id: "t2",
      name: "Reader of the Month",
      color: "#000",
      minPoints: 1,
      window: "month",
      awardMode: "top",
    },
    {
      id: "t3",
      name: "Unmapped",
      color: "#000",
      minPoints: 1,
      window: "year",
      awardMode: "top",
    },
  ];
  const roles = [
    { id: "r1", name: "bookworm" },
    { id: "r2", name: "Reader of the Month" },
    { id: "r9", name: "Custom" },
  ];

  it("maps by explicit setting first, then by name", () => {
    const map = resolveTierRoleMap(tiers, roles, { tierRoles: { t2: "r9" } });
    assert.deepEqual(
      [...map],
      [
        ["t1", "r1"],
        ["t2", "r9"],
      ],
    );
    assert.equal(isTierSyncEnabled({}), true);
    assert.equal(isTierSyncEnabled({ syncTierRoles: false }), false);
  });

  it("plans additions and removals for guild members only", () => {
    const map = resolveTierRoleMap(tiers, roles, {});
    const changes = planTierRoleChanges(
      [
        {
          user: user("a"),
          identities: [{ provider: "discord", subject: "d1" }],
          tierIds: ["t1"],
        },
        {
          user: user("b"),
          identities: [{ provider: "discord", subject: "gone" }],
          tierIds: ["t1"],
        },
      ],
      map,
      [
        { id: "d1", roleIds: ["r2"] },
        { id: "d2", roleIds: ["r1"] },
      ],
    );
    assert.deepEqual(
      changes.map((c) => `${c.action}:${c.memberId}:${c.roleId}`).sort(),
      ["add:d1:r1", "remove:d1:r2", "remove:d2:r1"],
    );
  });

  it("never strips roles when the engine reports no assignments", () => {
    const map = resolveTierRoleMap(tiers, roles, {});
    assert.deepEqual(
      planTierRoleChanges([], map, [{ id: "d2", roleIds: ["r1"] }]),
      [],
    );
  });
});

describe("embeds", () => {
  const event = {
    id: "ev1",
    title: "American Gods",
    status: "requested",
    type: { key: "buddy-read", name: "Buddy Read", color: "#3B82F6" },
    book: {
      id: "b",
      title: "American Gods",
      authors: ["Neil Gaiman"],
      coverUrl: null,
      pageCount: 576,
    },
    startDate: "2026-10-22",
    endDate: "2026-11-05",
    counts: { interested: 2, leaders: 1, completed: 0 },
    me: null,
    externalLinks: [],
    version: 1,
    description: "Let's read it",
    requestedBy: user("a", "111"),
    createdBy: null,
    allowedTransitions: ["approved", "rejected", "cancelled"],
    permissions: {} as EngineEventDetail["permissions"],
    createdAt: "",
    updatedAt: "",
  } as EngineEventDetail;
  const points = { reader: 0, leader: 0, bonus: 0, total: 0 };
  const participants: EngineParticipant[] = [
    {
      user: user("a", "111"),
      interested: true,
      isLeader: true,
      completion: "unknown",
      points,
    },
    {
      user: user("b"),
      interested: true,
      isLeader: false,
      completion: "unknown",
      points,
    },
  ];

  it("renders participants with mentions and display-name fallback", () => {
    const json = buildEngineEventEmbed(event, participants, "request").toJSON();
    assert.equal(json.title, "American Gods - Neil Gaiman");
    assert.equal(json.footer?.text, "Event ID: ev1");
    const fields = Object.fromEntries(
      (json.fields ?? []).map((f) => [f.name, f.value]),
    );
    assert.equal(fields["Requested By"], "<@111>");
    assert.equal(fields["Leader(s)"], "<@111>");
    assert.equal(fields["Interested (2)"], "<@111>, User b");
  });

  it("keeps the er/ea custom-id scheme and adds Lead", () => {
    const row = buildEngineParticipationRow("ev1", "er", true).toJSON();
    const ids = row.components.map((c) =>
      "custom_id" in c ? c.custom_id : "",
    );
    assert.deepEqual(ids, [
      "er-ev1-interested",
      "er-ev1-notInterested",
      "er-ev1-lead",
    ]);
    assert.ok(row.components.every((c) => c.disabled));
  });

  it("shows staff buttons only for transitions the engine allows", () => {
    assert.equal(buildEngineStaffRow(event)?.toJSON().components.length, 2);
    assert.equal(
      buildEngineStaffRow({ ...event, allowedTransitions: [] }),
      null,
    );
  });
});
