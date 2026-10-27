/**
 * End-to-end check of Gregg's engine integration against a running
 * gregg-core engine (e.g. `PORT=4010 npm run dev:memory` in gregg-core). Discord and
 * Prisma are replaced by in-memory fakes; everything else is the real code.
 *
 *   ENGINE_TEST_URL=http://localhost:4010 yarn test:engine.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { Bot } from "../src/models";
import { withAnnouncementLock } from "../src/modules/engine/announcements";
import {
  bookRequestPrefill,
  parseBookReference,
} from "../src/modules/engine/books";
import {
  EngineClient,
  EngineError,
  EngineInstallationClient,
} from "../src/modules/engine/client";
import {
  discordThreadLink,
  withDiscordLink,
} from "../src/modules/engine/links";
import { formatEngineUser } from "../src/modules/engine/mappings";
import {
  EngineService,
  pushRoleCatalog,
  syncGuildTierRoles,
} from "../src/modules/engine/service";
import {
  engineListQuery,
  planEventEdit,
  planParticipantChange,
} from "../src/modules/engine/staffActions";
import { EngineActor } from "../src/modules/engine/types";

const BASE_URL = process.env.ENGINE_TEST_URL;
const OWNER_EMAIL = process.env.ENGINE_TEST_OWNER_EMAIL ?? "alice@example.com";
const OWNER_PASSWORD = process.env.ENGINE_TEST_OWNER_PASSWORD ?? "password123";
const CLIENT_ID = process.env.ENGINE_TEST_CLIENT_ID ?? "gregg-dev";
const CLIENT_SECRET =
  process.env.ENGINE_TEST_CLIENT_SECRET ?? "gregg-dev-secret";
const ALICE_DISCORD_ID = "200000000000000001";

const runId = Date.now().toString(36);
const guildId = `gregg-it-${runId}`;
const staffRoleId = `staff-${runId}`;
const bookwormRoleId = `bookworm-${runId}`;

async function ownerCall<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.ok(response.ok, `${method} ${path} → ${response.status} ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

interface EditedMessage {
  embeds: { toJSON(): { fields?: { name: string; value: string }[] } }[];
  components: { toJSON(): { components: { disabled?: boolean }[] } }[];
}

function fakeRole(id: string, name: string, position: number) {
  return { id, name, position, managed: false };
}

function fakeMember(id: string, roleIds: string[]) {
  const cache = new Map(roleIds.map((r) => [r, {}]));
  return {
    id,
    user: { bot: false },
    roles: {
      cache,
      add: (roleId: string) => {
        cache.set(roleId, {});
        return Promise.resolve();
      },
      remove: (roleId: string) => {
        cache.delete(roleId);
        return Promise.resolve();
      },
    },
  };
}

describe("Gregg on the engine (integration)", { skip: !BASE_URL }, () => {
  let ownerToken = "";
  let clubId = "";
  let engine: EngineClient;
  let service: EngineService;
  let installation: EngineInstallationClient;
  let eventId = "";
  const edits: EditedMessage[] = [];
  const cursors = new Map<string, string>();
  const eventMessages: Record<string, unknown>[] = [];
  const announcementChannelId = `announcements-${runId}`;
  const sent: { channelId: string; content?: string }[] = [];
  let guildConfig: Record<string, unknown> | null = null;
  const announcementChannel = {
    id: announcementChannelId,
    isTextBased: (): boolean => true,
    isSendable: (): boolean => true,
    send: (payload: { content?: string }) => {
      sent.push({ channelId: announcementChannelId, content: payload.content });
      return Promise.resolve({
        id: `sent-${sent.length}`,
        url: `https://discord.com/channels/${guildId}/${announcementChannelId}/sent-${sent.length}`,
        channel: { id: announcementChannelId },
        createdAt: new Date(),
      });
    },
  };
  const guildRoles = new Map(
    [
      fakeRole(guildId, "@everyone", 0),
      fakeRole(staffRoleId, "Event Staff", 3),
      fakeRole(bookwormRoleId, "Bookworm", 2),
      fakeRole(`readers-${runId}`, "Readers", 1),
    ].map((role) => [role.id, role]),
  );
  const members = new Map([
    [ALICE_DISCORD_ID, fakeMember(ALICE_DISCORD_ID, [])],
    ["999", fakeMember("999", [bookwormRoleId])],
  ]);
  const guild = {
    id: guildId,
    name: "Gregg integration guild",
    iconURL: () => null,
    roles: { fetch: () => Promise.resolve(guildRoles) },
    members: { fetch: () => Promise.resolve(members) },
  };
  const message = {
    content: "",
    edit: (payload: EditedMessage) => {
      edits.push(payload);
      return Promise.resolve(message);
    },
  };
  const bot = {
    guilds: { cache: new Map([[guildId, guild]]) },
    channels: {
      fetch: (id: string) =>
        Promise.resolve(
          id === announcementChannelId
            ? announcementChannel
            : {
                isTextBased: (): boolean => true,
                isSendable: (): boolean => false,
                messages: { fetch: () => Promise.resolve(message) },
              },
        ),
    },
    db: {
      eventMessages: {
        findMany: ({
          where,
        }: {
          where: { eventId: string; guildId: string };
        }) =>
          Promise.resolve(
            eventMessages.filter(
              (doc) =>
                doc.eventId === where.eventId && doc.guildId === where.guildId,
            ),
          ),
        findFirst: ({
          where,
        }: {
          where: { eventId: string; guildId: string; type: string };
        }) =>
          Promise.resolve(
            eventMessages.find(
              (doc) =>
                doc.eventId === where.eventId &&
                doc.guildId === where.guildId &&
                doc.type === where.type,
            ) ?? null,
          ),
        create: ({ data }: { data: Record<string, unknown> }) => {
          eventMessages.push(data);
          return Promise.resolve(data);
        },
      },
      engineFeedCursors: {
        findUnique: ({ where }: { where: { installationId: string } }) => {
          const cursor = cursors.get(where.installationId);
          return Promise.resolve(cursor ? { cursor } : null);
        },
        upsert: ({
          create,
        }: {
          create: { installationId: string; cursor: string };
        }) => {
          cursors.set(create.installationId, create.cursor);
          return Promise.resolve();
        },
      },
      guilds: {
        findUnique: () =>
          Promise.resolve(guildConfig ? { config: guildConfig } : null),
      },
    },
  } as unknown as Bot;

  const reader: EngineActor = {
    subject: `it-reader-${runId}`,
    name: "IT Reader",
    roles: [`readers-${runId}`],
  };
  const second: EngineActor = {
    subject: `it-second-${runId}`,
    name: "IT Second",
  };
  const staff: EngineActor = {
    subject: `it-staff-${runId}`,
    name: "IT Staff",
    roles: [staffRoleId],
  };

  before(async () => {
    const response = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    assert.equal(response.status, 200, "owner can sign in");
    const login = (await response.json()) as { accessToken: string };
    ownerToken = login.accessToken;
    const clubs = await ownerCall<{
      items: { club: { id: string; slug: string } }[];
    }>(ownerToken, "GET", "/v1/clubs");
    clubId =
      clubs.items.find((item) => item.club.slug === "obc")?.club.id ?? "";
    assert.ok(clubId, "owner belongs to club obc");
    engine = new EngineClient({
      baseUrl: BASE_URL ?? "",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    bot.engine = new EngineService(bot, engine);
    service = bot.engine;
  });

  after(async () => {
    if (installation) {
      await ownerCall(
        ownerToken,
        "PATCH",
        `/v1/clubs/${clubId}/integrations/${installation.installation.id}`,
        {
          status: "revoked",
        },
      );
    }
  });

  it("/link claims a link code and binds the guild to the club", async () => {
    assert.equal(await service.forGuild(guildId), null);
    const linkCode = await ownerCall<{ code: string }>(
      ownerToken,
      "POST",
      `/v1/clubs/${clubId}/integrations/link-codes`,
      { platform: "discord" },
    );
    await engine.claimInstallation(linkCode.code, guildId, guild.name);
    const client = await service.forGuild(guildId);
    assert.ok(client, "guild resolves to an installation");
    installation = client;
    assert.equal(installation.clubId, clubId);
    await assert.rejects(
      engine.claimInstallation(linkCode.code, `${guildId}-2`, "again"),
      (error: unknown) => error instanceof EngineError && error.status === 422,
    );
  });

  it("pushes the role catalogue and honours mapped staff roles", async () => {
    await pushRoleCatalog(guild as never, installation);
    const roles = await ownerCall<{
      items: { id: string; externalRoles: { id: string }[] }[];
    }>(ownerToken, "GET", `/v1/clubs/${clubId}/integrations`);
    const pushed = roles.items.find(
      (item) => item.id === installation.installation.id,
    );
    assert.deepEqual(
      pushed?.externalRoles.map((role) => role.id),
      [staffRoleId, bookwormRoleId, `readers-${runId}`],
    );
    await ownerCall(
      ownerToken,
      "PATCH",
      `/v1/clubs/${clubId}/integrations/${installation.installation.id}`,
      {
        roleMappings: [{ externalRoleId: staffRoleId, role: "moderator" }],
      },
    );
    const ctx = await installation.getClub(staff);
    assert.equal(ctx.me?.role, "moderator");
  });

  it("acts for members: request + lead, join, approve (actor-asserted)", async () => {
    await service.pollFeeds();
    assert.ok(
      cursors.get(installation.installation.id),
      "first poll fast-forwards",
    );
    const start = new Date(Date.now() + 40 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const end = new Date(Date.now() + 54 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const created = await installation.createEvent(
      {
        typeKey: "buddy-read",
        title: `Gregg IT ${runId}`,
        startDate: start,
        endDate: end,
        leadSelf: true,
      },
      reader,
    );
    eventId = created.id;
    assert.equal(created.status, "requested");
    assert.equal(created.me?.isLeader, true);
    eventMessages.push({
      guildId,
      eventId,
      channelId: "c1",
      messageId: "m1",
      type: "BRRequest",
    });
    const joined = await installation.setInterest(eventId, true, second);
    assert.equal(joined.counts.interested, 2);
    const led = await installation.setLead(eventId, true, second);
    assert.equal(led.counts.leaders, 2);
    const unled = await installation.setLead(eventId, false, second);
    assert.equal(unled.counts.leaders, 1);
    await assert.rejects(
      installation.transition(eventId, "approved", reader),
      (error: unknown) => error instanceof EngineError && error.status === 403,
    );
    const approved = await installation.transition(
      eventId,
      "approved",
      staff,
      "IT",
    );
    assert.equal(approved.status, "approved");
    const participants = await installation.listParticipants(eventId);
    const readerRow = participants.find((p) => p.isLeader);
    assert.equal(
      formatEngineUser(readerRow?.user ?? created.createdBy!),
      `<@${reader.subject}>`,
    );
  });

  it("sets the Discord thread link without dropping web links", async () => {
    await ownerCall(
      ownerToken,
      "PUT",
      `/v1/clubs/${clubId}/events/${eventId}/links`,
      {
        links: [
          {
            platform: "web",
            kind: "meeting",
            url: "https://meet.example.com/it",
          },
        ],
      },
    );
    const event = await installation.getEvent(eventId);
    const linked = await installation.putLinks(
      eventId,
      withDiscordLink(
        event.externalLinks,
        discordThreadLink(guildId, { id: "777", name: "gregg-it" }),
      ),
    );
    assert.deepEqual(linked.externalLinks.map((l) => l.platform).sort(), [
      "discord",
      "web",
    ]);
  });

  it("consumes the feed and refreshes the request embed", async () => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await service.pollFeeds();
      const last = edits.at(-1)?.embeds[0].toJSON();
      const author = JSON.stringify(last ?? {});
      if (
        author.includes("Approved") &&
        author.includes(`<@${second.subject}>`)
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    assert.ok(edits.length > 0, "feed triggered a message refresh");
    const json = edits.at(-1)?.embeds[0].toJSON();
    const fields = Object.fromEntries(
      (json?.fields ?? []).map((f) => [f.name, f.value]),
    );
    assert.equal(
      fields["Interested (2)"],
      `<@${reader.subject}>, <@${second.subject}>`,
    );
    assert.match(JSON.stringify(json), /Approved/);
    assert.ok(
      edits
        .at(-1)
        ?.components[0].toJSON()
        .components.every((c) => !c.disabled),
    );
  });

  it("finds members by Discord id for /events stats user:@someone", async () => {
    const member = await installation.findMemberByDiscordId(reader.subject);
    assert.ok(member);
    const stats = await installation.getMemberStats(member.user.id, {
      window: "all_time",
    });
    assert.equal(stats.user.id, member.user.id);
    assert.equal(
      await installation.findMemberByDiscordId("does-not-exist"),
      null,
    );
    const board = await installation.getLeaderboard({
      window: "all_time",
      pageSize: 5,
    });
    assert.ok(
      board.items.some((e) => formatEngineUser(e.user).startsWith("<@")),
    );
  });

  it("lists and searches events as the viewer (/events list|search, /user events)", async () => {
    const listed = await installation.listEventsAs(
      {
        ...engineListQuery({ type: "BuddyRead", status: "Approved" }),
        pageSize: 100,
      },
      second,
    );
    const row = listed.items.find((item) => item.id === eventId);
    assert.ok(row, "approved buddy read is listed");
    assert.equal(row.me?.interested, true);
    const found = await installation.listEventsAs(
      engineListQuery({ q: `Gregg IT ${runId}` }),
      reader,
    );
    assert.deepEqual(
      found.items.map((item) => item.id),
      [eventId],
    );
    const mine = await installation.listEventsAs(
      engineListQuery({ mine: true }),
      second,
    );
    assert.ok(mine.items.some((item) => item.id === eventId));
    const member = await installation.findMemberByDiscordId(second.subject);
    assert.ok(member);
    const theirs = await installation.listEventsAs(
      engineListQuery({ participant: member.user.id }),
      reader,
    );
    assert.ok(theirs.items.some((item) => item.id === eventId));
  });

  it("edits events as staff (/events edit)", async () => {
    let event = await installation.getEvent(eventId, staff);
    const rename = planEventEdit("name", `Gregg IT ${runId} (renamed)`, event);
    assert.equal(rename.kind, "patch");
    if (rename.kind === "patch") {
      event = await installation.updateEvent(eventId, rename.body, staff);
    }
    assert.equal(event.title, `Gregg IT ${runId} (renamed)`);
    const status = planEventEdit("status", "Announced", event);
    assert.deepEqual(status, { kind: "transition", to: "announced" });
    event = await installation.transition(eventId, "announced", staff);
    assert.equal(event.status, "announced");
    await assert.rejects(
      installation.updateEvent(
        eventId,
        { expectedVersion: event.version, title: "x" },
        reader,
      ),
      (error: unknown) => error instanceof EngineError && error.status === 403,
    );
  });

  it("adds and removes participants as staff (/events adduser|removeuser)", async () => {
    const newcomer = `it-new-${runId}`;
    assert.equal(await installation.findMemberByDiscordId(newcomer), null);
    await assert.rejects(
      installation.ensureMemberByDiscordId(newcomer, "Newcomer", reader),
      (error: unknown) => error instanceof EngineError && error.status === 403,
    );
    const member = await installation.ensureMemberByDiscordId(
      newcomer,
      "Newcomer",
      staff,
    );
    const target = { discordId: newcomer, userId: member.user.id };
    let event = await installation.getEvent(eventId, staff);
    let participants = await installation.listParticipants(eventId);
    const interest = planParticipantChange(
      "add",
      "interested",
      0,
      [target],
      participants,
      event.status,
    );
    for (const patch of interest.patches) {
      participants = await installation.updateParticipant(
        eventId,
        patch.userId,
        patch.body,
        staff,
      );
    }
    assert.equal(
      participants.find((p) => p.user.id === member.user.id)?.interested,
      true,
    );
    const lead = planParticipantChange(
      "add",
      "leaders",
      0,
      [target],
      participants,
      event.status,
    );
    assert.equal(lead.patches.length, 1);
    participants = await installation.updateParticipant(
      eventId,
      member.user.id,
      lead.patches[0].body,
      staff,
    );
    assert.equal(
      participants.find((p) => p.user.id === member.user.id)?.isLeader,
      true,
    );

    event = await installation.transition(eventId, "ongoing", staff);
    const readers = planParticipantChange(
      "add",
      "readers",
      7,
      [target],
      participants,
      event.status,
    );
    participants = await installation.recordResults(
      eventId,
      readers.results,
      staff,
    );
    let row = participants.find((p) => p.user.id === member.user.id);
    assert.equal(row?.completion, "completed");
    assert.equal(row?.points.reader, 7);
    assert.equal(row?.isLeader, true);

    const removeReader = planParticipantChange(
      "remove",
      "readers",
      0,
      [target],
      participants,
      event.status,
    );
    participants = await installation.recordResults(
      eventId,
      removeReader.results,
      staff,
    );
    row = participants.find((p) => p.user.id === member.user.id);
    assert.equal(row?.completion, "not_completed");
    assert.equal(row?.points.reader, 0);

    await installation.removeParticipant(eventId, member.user.id, staff);
    participants = await installation.listParticipants(eventId);
    assert.ok(!participants.some((p) => p.user.id === member.user.id));
  });

  it("searches, adds and looks up books (/book)", async () => {
    await assert.rejects(installation.createBook({ title: "", authors: [] }));
    const book = await installation.createBook({
      title: `Gregg Book ${runId}`,
      authors: ["IT Author"],
      pageCount: 123,
    });
    assert.equal((await installation.getBook(book.id)).pageCount, 123);
    const results = await installation.searchBooks(`Gregg Book ${runId}`, 5);
    assert.ok(results.some((r) => r.bookId === book.id));
  });

  it("imports books by source identity, page URL and legacy button id (/book, /events request)", async () => {
    const [hit] = (await installation.searchBooks("The Hobbit", 5)).filter(
      (r) => r.bookId,
    );
    assert.ok(hit?.bookId, "the demo catalogue has The Hobbit");
    const catalogued = await installation.getBook(hit.bookId);
    const identity = catalogued.externalIds[0];
    assert.ok(identity, "the catalogue book has a source identity");
    const bySource = await installation.importBook({
      source: identity.source,
      externalId: identity.id,
    });
    assert.equal(bySource.id, catalogued.id);
    const fromUrl = parseBookReference(identity.url);
    assert.equal(fromUrl?.kind, "import");
    if (fromUrl?.kind !== "import") return;
    assert.equal(
      (await installation.importBook(fromUrl.ref)).id,
      catalogued.id,
    );
    if (identity.source === "openlibrary") {
      const legacy = bookRequestPrefill(`book-br-${identity.id}`);
      const reference = legacy ? parseBookReference(legacy) : null;
      assert.equal(reference?.kind, "import");
      if (reference?.kind === "import") {
        assert.equal(
          (await installation.importBook(reference.ref)).id,
          catalogued.id,
        );
      }
    }
    await assert.rejects(
      installation.importBook({
        openLibraryWorkId: identity.id,
      } as never),
      (error: unknown) => error instanceof EngineError && error.status === 400,
      "the removed openLibraryWorkId field is refused",
    );
  });

  it("posts the Discord announcement when an event is announced outside Discord", async () => {
    guildConfig = { eventAnnouncementChannel: announcementChannelId };
    try {
      const start = new Date(Date.now() + 70 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const end = new Date(Date.now() + 84 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const createApproved = async (title: string) =>
        await installation.createEvent(
          {
            typeKey: "buddy-read",
            title,
            startDate: start,
            endDate: end,
            status: "approved",
          },
          staff,
        );
      const pollUntil = async (done: () => boolean, ms: number) => {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {
          await service.pollFeeds();
          if (done()) return true;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return done();
      };
      const announcementsFor = (id: string) =>
        eventMessages.filter(
          (doc) => doc.eventId === id && doc.type === "Announcement",
        );

      const web = await createApproved(`Gregg IT web announce ${runId}`);
      await ownerCall(
        ownerToken,
        "POST",
        `/v1/clubs/${clubId}/events/${web.id}/transitions`,
        { to: "announced" },
      );
      assert.ok(
        await pollUntil(() => announcementsFor(web.id).length > 0, 20_000),
        "the feed posted the announcement",
      );
      const posted = sent.length;
      assert.match(sent.at(-1)?.content ?? "", /New Buddy Read/);
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await service.pollFeeds();
      assert.equal(sent.length, posted, "redelivery doesn't post twice");
      assert.equal(announcementsFor(web.id).length, 1);

      const discord = await createApproved(
        `Gregg IT Discord announce ${runId}`,
      );
      await withAnnouncementLock(discord.id, async () => {
        await installation.transition(discord.id, "announced", staff);
        await new Promise((resolve) => setTimeout(resolve, 2_500));
        await service.pollFeeds();
        assert.equal(
          announcementsFor(discord.id).length,
          0,
          "no feed post while /events announce is posting",
        );
        eventMessages.push({
          guildId,
          eventId: discord.id,
          channelId: announcementChannelId,
          messageId: "manual",
          type: "Announcement",
        });
      });
      await service.pollFeeds();
      assert.equal(announcementsFor(discord.id).length, 1);
    } finally {
      guildConfig = null;
    }
  });

  it("syncs reader tier roles from tier assignments", async () => {
    const assignments = await installation.getTierAssignments();
    assert.ok(
      assignments.some((a) =>
        a.identities.some((i) => i.subject === ALICE_DISCORD_ID),
      ),
    );
    await syncGuildTierRoles(bot, guild as never, installation);
    assert.ok(
      members.get(ALICE_DISCORD_ID)?.roles.cache.has(bookwormRoleId),
      "Bookworm added to alice",
    );
    assert.ok(
      !members.get("999")?.roles.cache.has(bookwormRoleId),
      "Bookworm removed from non-holder",
    );
  });

  it("stops working once the club revokes the installation", async () => {
    await ownerCall(
      ownerToken,
      "PATCH",
      `/v1/clubs/${clubId}/integrations/${installation.installation.id}`,
      {
        status: "revoked",
      },
    );
    await assert.rejects(installation.getClub());
    engine.invalidateGuild(guildId);
    assert.equal(await service.forGuild(guildId), null);
    installation = undefined as unknown as EngineInstallationClient;
  });
});
