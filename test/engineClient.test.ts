/* eslint-disable camelcase */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EngineClient, EngineError } from "../src/modules/engine/client";

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

type Route = (call: Call) => { status: number; body?: unknown };

function fakeFetch(route: Route) {
  const calls: Call[] = [];
  const impl = (input: unknown, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? "GET",
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    };
    calls.push(call);
    const { status, body } = route(call);
    const text = body === undefined ? "" : JSON.stringify(body);
    return Promise.resolve(new Response(text || null, { status }));
  };
  return { calls, fetch: impl as typeof fetch };
}

const INSTALLATION = {
  id: "inst1",
  appId: "gregg-dev",
  appName: "Gregg",
  platform: "discord",
  externalTenantId: "guild1",
  externalTenantName: "Guild",
  status: "active",
  scopes: [],
  roleMappings: [],
  externalRoles: [],
  publicSettings: {},
  createdAt: "2026-01-01T00:00:00Z",
  lastSeenAt: null,
};

function engineRoutes(overrides: Record<string, Route> = {}): Route {
  let minted = 0;
  return (call) => {
    const path = new URL(call.url).pathname;
    const key = `${call.method} ${path}`;
    if (overrides[key]) return overrides[key](call);
    if (key === "POST /v1/auth/app-token") {
      return {
        status: 200,
        body: { access_token: "app-token", expires_in: 3600 },
      };
    }
    if (key === "GET /v1/apps/installations") {
      const tenant = new URL(call.url).searchParams.get("externalTenantId");
      return {
        status: 200,
        body: { items: tenant === "guild1" ? [INSTALLATION] : [] },
      };
    }
    if (key === "POST /v1/apps/installations/inst1/token") {
      minted += 1;
      return {
        status: 200,
        body: {
          access_token: `inst-token-${minted}`,
          expires_in: 3600,
          installationId: "inst1",
          clubId: "club1",
        },
      };
    }
    return { status: 404, body: { status: 404, code: "NOT_FOUND" } };
  };
}

function makeClient(route: Route) {
  const fake = fakeFetch(route);
  const client = new EngineClient({
    baseUrl: "http://engine.test/",
    clientId: "gregg-dev",
    clientSecret: "s3cret",
    fetch: fake.fetch,
  });
  return { client, calls: fake.calls };
}

describe("EngineClient", () => {
  it("gets an app token with client credentials and caches it", async () => {
    const { client, calls } = makeClient(engineRoutes());
    assert.equal(await client.getAppToken(), "app-token");
    assert.equal(await client.getAppToken(), "app-token");
    const tokenCalls = calls.filter((c) => c.url.endsWith("/app-token"));
    assert.equal(tokenCalls.length, 1);
    const expected = `Basic ${Buffer.from("gregg-dev:s3cret").toString("base64")}`;
    assert.equal(tokenCalls[0].headers.Authorization, expected);
    assert.equal(tokenCalls[0].body, "grant_type=client_credentials");
  });

  it("resolves a guild to its installation and mints a club-bound token", async () => {
    const { client, calls } = makeClient(engineRoutes());
    const inst = await client.forGuild("guild1");
    assert.ok(inst);
    assert.equal(inst.clubId, "club1");
    assert.equal(await inst.getToken(), "inst-token-1");
    assert.equal(await client.forGuild("guild1"), inst);
    assert.equal(
      calls.filter((c) => c.url.includes("/apps/installations?")).length,
      1,
    );
  });

  it("returns null for unlinked guilds", async () => {
    const { client } = makeClient(engineRoutes());
    assert.equal(await client.forGuild("other-guild"), null);
  });

  it("asserts the actor with X-Actor headers", async () => {
    const { client, calls } = makeClient(
      engineRoutes({
        "POST /v1/clubs/club1/events/ev1/interest": () => ({
          status: 200,
          body: { id: "ev1" },
        }),
      }),
    );
    const inst = await client.forGuild("guild1");
    await inst?.setInterest("ev1", true, {
      subject: "42",
      name: "Zoë Reader",
      roles: ["r1", "r2"],
    });
    const call = calls.find((c) => c.url.endsWith("/interest"));
    assert.ok(call);
    assert.equal(call.headers.Authorization, "Bearer inst-token-1");
    assert.equal(call.headers["X-Actor-Provider"], "discord");
    assert.equal(call.headers["X-Actor-Subject"], "42");
    assert.equal(call.headers["X-Actor-Name"], "Zo%C3%AB%20Reader");
    assert.equal(call.headers["X-Actor-Roles"], "r1,r2");
  });

  it("re-mints the installation token once on 401", async () => {
    let attempts = 0;
    const { client } = makeClient(
      engineRoutes({
        "GET /v1/clubs/club1": (call) => {
          attempts += 1;
          return call.headers.Authorization === "Bearer inst-token-1"
            ? { status: 401, body: { status: 401, code: "UNAUTHENTICATED" } }
            : { status: 200, body: { club: { id: "club1" } } };
        },
      }),
    );
    const inst = await client.forGuild("guild1");
    const ctx = await inst?.getClub();
    assert.equal(ctx?.club.id, "club1");
    assert.equal(attempts, 2);
  });

  it("raises EngineError with the problem fields", async () => {
    const { client } = makeClient(
      engineRoutes({
        "POST /v1/apps/installations/claim": () => ({
          status: 422,
          body: { status: 422, code: "INVARIANT_VIOLATION", detail: "expired" },
        }),
      }),
    );
    await assert.rejects(
      client.claimInstallation("ABCD1234", "guild2", "Guild 2"),
      (error: unknown) =>
        error instanceof EngineError &&
        error.status === 422 &&
        error.code === "INVARIANT_VIOLATION" &&
        error.detail === "expired",
    );
  });

  it("maps a 404 member lookup to null", async () => {
    const { client } = makeClient(engineRoutes());
    const inst = await client.forGuild("guild1");
    assert.equal(await inst?.findMemberByDiscordId("999"), null);
  });
});
