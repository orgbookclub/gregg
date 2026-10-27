import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { approveValidBRs } from "../src/jobs/approveValidBRs";
import { endCompletedEvents } from "../src/jobs/endCompletedEvents";
import { pollEngineFeed } from "../src/jobs/pollEngineFeed";
import { rejectInvalidBRs } from "../src/jobs/rejectInvalidBRs";
import { startAnnouncedEvents } from "../src/jobs/startAnnouncedEvents";
import { syncEngineTierRoles } from "../src/jobs/syncEngineTierRoles";
import { updateReaderRoles } from "../src/jobs/updateReaderRoles";
import {
  filterForBackend,
  isButtonAvailable,
  isCommandAvailable,
  parseBackend,
} from "../src/modules/engine/backend";
import { parseEnv } from "../src/validateEnv";

const BASE_ENV = {
  DISCORD_TOKEN: "t",
  CLIENT_ID: "c",
  SENTRY_DSN: "s",
  MONGODB_URI: "m",
  WH_URL: "w",
};

describe("backend switch", () => {
  it("parses BACKEND with ows as the default", () => {
    assert.equal(parseBackend(undefined), "ows");
    assert.equal(parseBackend(""), "ows");
    assert.equal(parseBackend("ENGINE"), "engine");
    assert.equal(parseBackend("mongo"), null);
  });

  it("keeps today's OWS requirements by default", () => {
    const missing = parseEnv({ ...BASE_ENV });
    assert.equal(missing.ok, false);
    const ok = parseEnv({ ...BASE_ENV, API_URL: "u", CLIENT_SECRET: "x" });
    assert.ok(ok.ok);
    assert.equal(ok.config.backend, "ows");
    assert.equal(ok.config.engine, null);
  });

  it("requires engine credentials, not OWS ones, for BACKEND=engine", () => {
    const missing = parseEnv({ ...BASE_ENV, BACKEND: "engine" });
    assert.equal(missing.ok, false);
    assert.match(missing.ok ? "" : missing.error, /ENGINE_URL/);
    const ok = parseEnv({
      ...BASE_ENV,
      BACKEND: "engine",
      ENGINE_URL: "http://localhost:4000",
      ENGINE_CLIENT_ID: "gregg-dev",
      ENGINE_CLIENT_SECRET: "secret",
    });
    assert.ok(ok.ok);
    assert.equal(ok.config.backend, "engine");
    assert.deepEqual(ok.config.engine, {
      url: "http://localhost:4000",
      clientId: "gregg-dev",
      clientSecret: "secret",
    });
  });

  it("rejects an unknown BACKEND", () => {
    const result = parseEnv({ ...BASE_ENV, BACKEND: "nope" });
    assert.equal(result.ok, false);
  });

  it("turns off Gregg's lifecycle and stats jobs on the engine", () => {
    const jobs = [
      approveValidBRs,
      rejectInvalidBRs,
      startAnnouncedEvents,
      endCompletedEvents,
      updateReaderRoles,
      pollEngineFeed,
      syncEngineTierRoles,
    ];
    assert.deepEqual(
      filterForBackend(jobs, "engine").map((job) => job.name),
      ["pollEngineFeed", "syncEngineTierRoles"],
    );
    assert.deepEqual(
      filterForBackend(jobs, "ows").map((job) => job.name),
      [
        "approveValidBRs",
        "rejectInvalidBRs",
        "startAnnouncedEvents",
        "endCompletedEvents",
        "updateReaderRoles",
      ],
    );
  });

  it("serves every command and button on the engine", () => {
    for (const [command, sub] of [
      ["events", "edit"],
      ["events", "list"],
      ["events", "adduser"],
      ["book", "search"],
      ["user", "events"],
      ["user", "info"],
      ["sprint", "start"],
    ]) {
      assert.equal(isCommandAvailable("engine", command, sub), true);
    }
    for (const id of ["evt-edit-abc", "evt-thread-abc", "evt-announce-abc"]) {
      assert.equal(isButtonAvailable("engine", id), true);
    }
    assert.equal(isButtonAvailable("engine", "evt-addpts-abc"), true);
    assert.equal(isButtonAvailable("engine", "book-br-OL1W"), true);
    assert.equal(isButtonAvailable("engine", "er-abc-lead"), true);
    assert.equal(isButtonAvailable("ows", "evt-edit-abc"), true);
  });
});
