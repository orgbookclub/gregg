<p align="center">
<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-develop-ci.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-develop-ci.yml/badge.svg">
</a>

<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-deploy-azure.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-deploy-azure.yml/badge.svg">
</a>

<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-prod-deploy-azure.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-prod-deploy-azure.yml/badge.svg">
</a>
</p>

# Gregg

This is the repository for Gregg, a Discord bot for Book Clubs. Currently, Gregg is custom-tailored to the [Organized Book Club](https://discord.gg/BookClubs) server on Discord.

## Running the project

```bash
yarn install

# development
yarn start:dev

# prod
yarn start
```

## Test

```bash
# unit tests (node:test, compiled with tsconfig.test.json)
yarn test

# end-to-end against a running ows-next engine, e.g. a throwaway one:
#   (in ows-next) PORT=4010 npm run dev:memory
ENGINE_TEST_URL=http://localhost:4010 yarn test:engine
```

`yarn test:engine` drives the real engine client and Discord sync code with
in-memory Discord/Prisma fakes: `/link` (claim a link code), role catalogue
push and role mapping, actor-asserted request/interest/lead/approve, thread
links, feed-driven embed refresh, member lookup by Discord id, event
list/search/participant filters, edits, staff participant changes (ensure
member, participant edits, results, removal), books, tier role sync and
revocation. It defaults to the dev seed (`alice@example.com`,
`gregg-dev`); override with `ENGINE_TEST_OWNER_EMAIL`,
`ENGINE_TEST_OWNER_PASSWORD`, `ENGINE_TEST_CLIENT_ID` and
`ENGINE_TEST_CLIENT_SECRET`.

## Backends (`BACKEND=ows|engine`)

Gregg can run against either backend, which allows a parallel run before
the cutover:

| | `BACKEND=ows` (default) | `BACKEND=engine` |
|---|---|---|
| API | OWS (`API_URL`, `CLIENT_ID`, `CLIENT_SECRET`) | [ows-next](https://github.com/orgbookclub/ows-next) (`ENGINE_URL`, `ENGINE_CLIENT_ID`, `ENGINE_CLIENT_SECRET`) |
| Lifecycle jobs (`approveValidBRs`, `rejectInvalidBRs`, `startAnnouncedEvents`, `endCompletedEvents`) | Run in Gregg | Off. The engine's scheduler owns approval and lifecycle rules |
| Stats, readerboard, reader roles | Computed by Gregg (`updateReaderRoles`) | Read from the engine (leaderboard, overview, member stats); `syncEngineTierRoles` mirrors engine tier assignments onto Discord roles |
| Embed refresh | On Gregg's own writes | `pollEngineFeed` follows the club feed every 15 s and re-renders request and announcement messages, so changes made on the web show up in Discord too |

With `BACKEND=engine`:

1. A club admin creates a Discord link code in the web app (club settings →
   integrations) and runs **`/link code:<CODE>`** in the server (requires
   *Manage Server*). Gregg claims the installation, binding the guild to the
   club, and pushes the server's role catalogue (refreshed hourly).
2. Admins map Discord roles to club roles (member/moderator/admin) in the web
   app. Gregg calls the engine **as the Discord member** (`X-Actor-*` headers
   with their role ids), so the engine decides what each person may do:
   Join/Leave/Lead buttons, `/events request`, approve/reject, announce and
   thread creation.
3. `/events createthread` attaches the Discord thread to the event
   (`externalLinks`), which the web app shows as *Discuss on Discord*.
4. Tier → role mapping: `publicSettings.tierRoles[tierId] = roleId` on the
   installation wins; otherwise a role whose name matches the tier name
   (case-insensitive) is used. Set `publicSettings.syncTierRoles` to `false`
   to turn role sync off.

Every slash command works on the engine backend. Event and user commands call
the engine as the member, so staff-only actions follow the club's role mapping:

- `/events list|search` and `/user events` use the engine's event list
  (`mine` for yourself, `participant` for another member), with Join/Leave
  buttons based on your participation.
- `/events edit` maps name/description/type/dates to an edit with optimistic
  concurrency, status to a lifecycle transition (only allowed edges), and
  threads to Discord thread links. `requestedBy` can't be edited on the engine.
- `/events adduser|removeuser` (and the Add/Remove Points buttons) first ensure
  the selected Discord users are club members, then:
  - **Interested:** staff participation edits.
  - **Leaders:** the leader flag before the event starts; once it is ongoing,
    leader points via results.
  - **Readers:** results (completed with points, or `not_completed` with 0
    points on removal).
- `/events broadcast` pings the interested members in the event's linked
  thread. Only the event's leaders and staff can use it.
- `/user info` shows the member's role, join date, points, rank and tiers.
- `/book search|info|cover|link` use the engine's catalogue and Open Library
  search. `/book add` (staff) adds a manual book and replies with its book ID,
  which `/events request` accepts alongside Open Library URLs and ISBNs. The
  *Request Buddy Read* button on `/book info` opens the same request form.

Only the Edit, Create Thread and Announce buttons on the event card are still
OWS-only (use `/events edit|createthread|announce`). Everything that doesn't use
OWS (sprints, QOTD, config, bookmarks, `/gregg`) works unchanged. `/gregg ask`
runs without OWS MCP tools. Engine event ids equal the imported OWS ids, so
existing Discord message mappings keep working. The code lives in
`src/modules/engine/`.

## OWS authentication

Gregg authenticates to the OWS backend using OAuth 2.0 client-credentials
(RFC 6749 §4.4) and an RS256 bearer token (1 h TTL by default). Three
env vars drive the flow:

- `API_URL` — base URL of the OWS deployment.
- `CLIENT_ID` — must match a client registered in the OWS deployment's
  client catalogue (`config/clients.json` by default; the file the
  deployment's `CLIENTS_FILE` env var points at otherwise).
- `CLIENT_SECRET` — the plaintext client secret whose argon2id hash is
  stored in that catalogue against the matching `clientId`.

The registered `gregg` client should be granted these scopes (covers
every endpoint Gregg currently calls plus the obvious near-term
additions):

```
events:read events:write
users:read users:write
books:read books:write
reviews:read reviews:write
```

The wrapper in `src/providers/owsClient.ts` requests a token at boot,
caches it until 5 minutes before the server-reported `expires_in`, and
single-flights refresh on demand. A response interceptor on the shared
axios instance retries any 401 once after a refresh, so brief outages
or key rotations don't bubble up to command handlers.

## License

This project is licensed under the GNU General Public License v3.0 or later.
See the [LICENSE](./LICENSE) file for the full license text.
