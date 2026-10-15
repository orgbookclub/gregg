import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { engineParticipantButton } from "../src/modules/engine/listView";
import {
  engineListQuery,
  interestedDiscordIds,
  planEventEdit,
  planParticipantChange,
  primaryThreadId,
} from "../src/modules/engine/staffActions";
import {
  EngineEventDetail,
  EngineEventListItem,
  EngineParticipant,
} from "../src/modules/engine/types";

function participant(
  id: string,
  overrides: Partial<EngineParticipant> = {},
  discordId?: string,
): EngineParticipant {
  return {
    user: {
      id,
      displayName: id,
      avatarUrl: null,
      isClaimed: true,
      platforms: discordId
        ? [{ provider: "discord", username: id, subject: discordId }]
        : [],
    },
    interested: true,
    isLeader: false,
    completion: "unknown",
    points: { reader: 0, leader: 0, bonus: 0, total: 0 },
    ...overrides,
  };
}

const event = {
  id: "ev1",
  title: "T",
  status: "ongoing",
  version: 7,
  externalLinks: [
    {
      platform: "web",
      kind: "meeting",
      url: "https://m",
      externalId: null,
      label: null,
    },
    {
      platform: "discord",
      kind: "thread",
      url: "https://d/1",
      externalId: "111",
      label: null,
    },
  ],
} as unknown as EngineEventDetail;

describe("participant planning", () => {
  const participants = [
    participant("u1", {
      completion: "completed",
      points: { reader: 5, leader: 3, bonus: 0, total: 8 },
      isLeader: true,
    }),
    participant("u2"),
  ];
  const targets = [
    { discordId: "d1", userId: "u1" },
    { discordId: "d2", userId: "u2" },
    { discordId: "d3", userId: "u3" },
  ];

  it("records reader results and keeps leader points", () => {
    const plan = planParticipantChange(
      "add",
      "readers",
      10,
      targets,
      participants,
      "ongoing",
    );
    assert.deepEqual(plan.patches, []);
    assert.deepEqual(plan.results, [
      {
        userId: "u1",
        completion: "completed",
        readerPoints: 10,
        leaderPoints: 3,
      },
      {
        userId: "u2",
        completion: "completed",
        readerPoints: 10,
        leaderPoints: 0,
      },
      {
        userId: "u3",
        completion: "completed",
        readerPoints: 10,
        leaderPoints: 0,
      },
    ]);
  });

  it("sets leadership with a staff edit before the event starts", () => {
    const plan = planParticipantChange(
      "add",
      "leaders",
      10,
      targets.slice(1, 2),
      participants,
      "approved",
    );
    assert.deepEqual(plan.patches, [
      { userId: "u2", body: { isLeader: true } },
    ]);
    assert.deepEqual(plan.results, []);
  });

  it("records leader points once the event is ongoing", () => {
    const plan = planParticipantChange(
      "add",
      "leaders",
      4,
      targets.slice(1, 2),
      participants,
      "ongoing",
    );
    assert.deepEqual(plan.results, [
      {
        userId: "u2",
        completion: "unknown",
        isLeader: true,
        leaderPoints: 4,
        readerPoints: 0,
      },
    ]);
  });

  it("adds and removes interest with staff edits", () => {
    assert.deepEqual(
      planParticipantChange(
        "add",
        "interested",
        0,
        [targets[2]],
        participants,
        "requested",
      ).patches,
      [{ userId: "u3", body: { interested: true } }],
    );
    const removal = planParticipantChange(
      "remove",
      "interested",
      0,
      targets,
      participants,
      "requested",
    );
    assert.deepEqual(removal.patches, [
      { userId: "u1", body: { interested: false } },
      { userId: "u2", body: { interested: false } },
    ]);
    assert.deepEqual(removal.notListed, ["d3"]);
  });

  it("removes readers and leaders only when listed", () => {
    const readers = planParticipantChange(
      "remove",
      "readers",
      0,
      targets,
      participants,
      "completed",
    );
    assert.deepEqual(readers.results, [
      {
        userId: "u1",
        completion: "not_completed",
        readerPoints: 0,
        leaderPoints: 3,
      },
    ]);
    assert.deepEqual(readers.notListed, ["d2", "d3"]);
    const leaders = planParticipantChange(
      "remove",
      "leaders",
      0,
      targets,
      participants,
      "completed",
    );
    assert.deepEqual(leaders.results, [
      {
        userId: "u1",
        completion: "completed",
        isLeader: false,
        leaderPoints: 0,
        readerPoints: 5,
      },
    ]);
    const early = planParticipantChange(
      "remove",
      "leaders",
      0,
      targets,
      participants,
      "announced",
    );
    assert.deepEqual(early.patches, [
      { userId: "u1", body: { isLeader: false } },
    ]);
  });

  it("treats users without an engine id as not listed", () => {
    const plan = planParticipantChange(
      "add",
      "readers",
      5,
      [{ discordId: "x", userId: null }],
      [],
      "ongoing",
    );
    assert.deepEqual(plan, { patches: [], results: [], notListed: ["x"] });
  });
});

describe("edit planning", () => {
  it("maps fields onto patches, transitions and thread links", () => {
    assert.deepEqual(planEventEdit("name", " New ", event), {
      kind: "patch",
      body: { expectedVersion: 7, title: "New" },
    });
    assert.deepEqual(planEventEdit("type", "MonthlyRead", event), {
      kind: "patch",
      body: { expectedVersion: 7, typeKey: "book-of-the-month" },
    });
    assert.deepEqual(planEventEdit("dates.endDate", "2026-12-01", event), {
      kind: "patch",
      body: { expectedVersion: 7, endDate: "2026-12-01" },
    });
    assert.deepEqual(planEventEdit("status", "Completed", event), {
      kind: "transition",
      to: "completed",
    });
    assert.deepEqual(planEventEdit("threads", "<#1>, 2", event), {
      kind: "threads",
      threadIds: ["1", "2"],
    });
  });

  it("rejects invalid input and unsupported fields", () => {
    assert.equal(planEventEdit("status", "Done", event).kind, "error");
    assert.equal(planEventEdit("dates.startDate", "soon", event).kind, "error");
    assert.equal(planEventEdit("threads", "abc", event).kind, "error");
    assert.equal(planEventEdit("requestedBy", "123", event).kind, "error");
  });
});

describe("list helpers", () => {
  it("maps OWS list options to the engine query", () => {
    assert.deepEqual(
      engineListQuery({
        type: "BuddyRead",
        status: "Ongoing",
        sort: "endDateAsc",
      }),
      {
        typeKey: "buddy-read",
        status: "ongoing",
        sort: "endDate",
        q: undefined,
        mine: undefined,
        participant: undefined,
      },
    );
    assert.equal(engineListQuery({}).sort, "-startDate");
    assert.equal(engineListQuery({ participant: "u1" }).participant, "u1");
  });

  it("finds broadcast targets and the primary thread", () => {
    assert.deepEqual(
      interestedDiscordIds([
        participant("a", {}, "1"),
        participant("b", { interested: false }, "2"),
        participant("c"),
      ]),
      ["1"],
    );
    assert.equal(primaryThreadId(event), "111");
  });

  it("shows Join or Leave from the viewer's participation", () => {
    const base = {
      id: "e",
      type: { key: "buddy-read", name: "Buddy Read", color: "#000" },
      status: "approved",
      me: null,
    } as unknown as EngineEventListItem;
    const id = (item: EngineEventListItem) =>
      (
        engineParticipantButton(item)?.toJSON() as
          | { custom_id?: string }
          | undefined
      )?.custom_id;
    assert.equal(id(base), "evt-join-e");
    const me = {
      interested: true,
      isLeader: false,
      completion: "unknown",
      points: { reader: 0, leader: 0, bonus: 0, total: 0 },
    } as const;
    assert.equal(id({ ...base, me }), "evt-leave-e");
    assert.equal(id({ ...base, status: "completed" }), undefined);
    assert.equal(
      id({ ...base, type: { ...base.type, key: "other" } }),
      undefined,
    );
  });
});
