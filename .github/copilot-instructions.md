# Copilot Instructions for Gregg

Gregg is a TypeScript Discord bot (discord.js v14) for the Organized Book Club server. It uses Prisma over MongoDB, Sentry for error reporting, pino for logging, and an internal backend (`@organizedbookclub/ows-client`) hosted on Azure.

## Build, lint, run

- Install: `yarn install --frozen-lockfile` (Node 24.x). `@organizedbookclub/ows-client` is published on public npm (`registry.npmjs.org`); no auth needed. (Older CI workflows still log in to GitHub Packages for the legacy `@orgbookclub` scope — those steps are now no-ops and can be removed in a cleanup pass.) `postinstall` runs `prisma generate` against `prisma/schema.prisma`.
- Build: `yarn build` (`tsc` → `./dist`). `yarn prebuild` cleans `./dist`.
- Lint: `yarn lint` (ESLint with `--max-warnings 0`, then Prettier `--check`). Auto-fix: `yarn lint:fix`. CI runs `yarn lint` then `yarn build`; both must pass.
- Run dev: `yarn start:dev` (rebuilds, then `node -r dotenv/config ./dist/index.js`). Run prod: `yarn start`. Required env vars are listed in `sample.env` and validated in `src/validateEnv.ts` (the process exits if any are missing).
- There is no test suite. Do not add a new linter/test framework unless the task requires it.
- Two ESLint configs exist (`eslint.config.mjs` flat config and a legacy `.eslintrc.json`). ESLint 9 picks up the flat config — the flat config (`eslint.config.mjs`) is authoritative. Mirror any rule changes into `.eslintrc.json` using the equivalent legacy syntax.
- **Don't run `yarn lint && yarn build` after every small edit.** Batch a coherent set of edits, then verify once at the end (or before commit). ESLint here is _not_ type-aware (no `parserOptions.project`), so `yarn build` (tsc) is required to catch type errors — but each lint+build pass takes ~30–60s, so running them after every file change is wasteful. Skip `yarn build` entirely for non-code changes (README/comments/lockfile-only).

## Architecture

The entry point `src/index.ts` constructs a `Client` and casts it to the `Bot` interface (`src/models/Bot.ts`), which augments it with `commands`, `contexts`, `configs`, `db` (PrismaClient), `api` (OWSClient), `sprintManager`, `jobManager`, `cooldowns`, and `debugHook`. Everything downstream receives this `Bot` instance — there is no DI container; `Bot` is the dependency bag.

**Dynamic loading by filename convention.** `src/utils/loadCommands.ts` and `loadEventListeners.ts` glob compiled JS under `./dist/{commands,contexts,jobs,events}` and `import(file)`, then read the export whose name equals the file's basename:

```ts
const name = file.split("/").at(-1)?.split(".")[0] ?? "";
commands.push(mod[name] as T);
```

So `src/commands/sprint.ts` **must** export `export const sprint: Command = {...}`. Same for `Context` (in `src/contexts/`), `Job` (`src/jobs/`), and `Event` (`src/events/<area>/<eventName>.ts`). A new file is auto-registered just by being placed in the right folder with the matching export name — no manifest to update. (`registerCommands` in dev mode pushes commands to `HOME_GUILD_ID`; in prod it registers globally.)

**Command shape.** Top-level slash commands in `src/commands/*.ts` each build a `SlashCommandBuilder` with subcommands and dispatch via a `handlers: Record<string, CommandHandler>` map to per-subcommand modules in `src/commands/subcommands/<command>/*.ts` (re-exported from that folder's `index.ts`). The top-level `run` wraps the dispatch in `try/catch` and calls `errorHandler(bot, "commands > <name>", err, ..., interaction)`. Each subcommand handler typically `deferReply()`s first and replies via `editReply`. `Command.cooldown` (seconds) is enforced in `src/modules/events/interactions/processChatInputCommand.ts`, which also fetches `GuildsConfig` via `getGuildConfigFromDb` and passes it as the third arg to `command.run` for guild interactions.

When adding a new subcommand: create the handler file in `src/commands/subcommands/<command>/`, export it from that folder's `index.ts`, add the subcommand to the parent `SlashCommandBuilder`, and add a key to the parent command's `handlers` map matching the subcommand name.

**Interaction routing.** `src/events/interactionEvents/interactionCreate.ts` is the single Discord interaction listener; it forwards to `src/modules/events/interactions/process{ChatInputCommand,ContextMenuCommand,ButtonClick,StringSelectMenu,ModalSubmit}.ts`. Buttons/selects/modals are routed by parsing `customId` prefixes (e.g. `bookmark-delete`, `er-<eventId>-interested`, `qs-<qotdId>-approve`). Keep that prefix-`-` split scheme when adding new components.

**Jobs.** `src/jobs/*.ts` export `Job { name, cronTime, callBack }`. `JobManager` (`src/models/jobs/JobManager.ts`) creates a `CronJob` per file at startup and starts it immediately. The hourly `refreshClientToken` job re-initializes the OWS API client; if you add long-running periodic work, mirror this pattern and wrap the body in `errorHandler`.

**Database.** Prisma uses the `mongodb` provider; `GuildsConfig` and `GuildsReaderRoles` are embedded composite types on the `guilds` model (not separate collections). DB access lives in `src/utils/dbUtils.ts` and per-feature modules. Check `src/utils/dbUtils.ts` and the relevant per-feature module under `src/modules/` for an existing helper before introducing a direct `bot.db` call from a top-level command. `commandUsages` is upserted automatically for every chat-input command.

**Sprints are in-memory.** `bot.sprintManager` (`src/models/commands/sprint/SprintManager.ts`) holds active sprint state by `threadId` — sprints are not persisted between bot restarts.

**ComponentsV2 (CV2).** CV2 is a first-class UI pattern in this repo, used by `paginationManager`, `lazyPaginationManager`, `eventUtils`, `readerboard`, `sprint/leaderboard`, `qotd/list`, etc. Checklist when building a CV2 message:

1. **Mutual exclusivity:** a message with `flags: MessageFlags.IsComponentsV2` must not include `embeds` or top-level `content` — Discord rejects the payload.
2. **Component limit:** at most **40** components per message (`COMPONENT_MAX_TOTAL_COMPONENTS_EXCEEDED`). Nested containers, sections, separators, and buttons all count. For paginated lists, use `lazyPaginationManager` rather than building a flat 40-row block.
3. **Thumbnail placement:** put thumbnails on a `ContainerBuilder` accessory, not on an embed.
4. **Select menus in modals:** `discord.js@14.x` supports `UserSelectMenu` / `RoleSelectMenu` / `StringSelectMenu` inside modals. The canonical example is `src/commands/subcommands/events/addUser.ts`.

**Cross-repo workflow with `../ows`.** Gregg is the Discord-facing half of a pair; the backend API lives in the sibling repo `/home/ravsodhi/projects/ows` (referenced in user prompts as `@../ows/`). When the user asks about API behavior, scopes, request/response shapes, MCP tools, or anything served by the `@organizedbookclub/ows-client` SDK:

- Treat `../ows` source as the source of truth. Read the relevant controller / DTO / scope guard there.
- **Do not** rely on `plan.md` files from previous sessions or older OWS READMEs for current API contracts — they describe _proposed_ behavior, not what shipped. A real example: a prior plan mentioned a `migrations:run` scope that never existed; the actual controller uses `events:write, users:write, books:write`.
- The user typically republishes `@organizedbookclub/ows-client` from `../ows` (to public npm) before asking Gregg to consume new behavior. If the SDK doesn't expose what the user is describing, check whether they've published yet rather than assuming the OWS side is missing it.

## Conventions

- **Error handling:** every `try/catch` in a command/handler/job/event ends with `await errorHandler(bot, "<area> > <command> > <subcommand>", err, interaction.guild?.name, message?, interaction?)`. The `>`-separated context string is the breadcrumb that shows up in Sentry and the debug webhook embed. Match the existing format when adding new files.
- **Imports:** ESLint enforces grouped + alphabetized imports (`builtin`, `external`, `internal`, `parent`, `sibling`, `index`, `object`, `type`, `unknown`) with blank lines between groups. Run `yarn lint:fix` rather than hand-ordering.
- **Style:** double quotes, trailing commas everywhere, semicolons required, `eqeqeq`, `require-await`, no inline comments (except `eslint-disable` directives, which are the explicit exception), `camelcase` enforced. Prisma's `command_subcommand` compound key needs an `// eslint-disable-next-line camelcase` (see `processChatInputCommand.ts`).
- **JSDoc:** `jsdoc/require-jsdoc` is on with `publicOnly: true` and `require-description-complete-sentence`. Every exported function/class/method needs a JSDoc with a sentence-ending description; `@param` types are off (TS provides them).
- **Logging:** use `logger` from `src/utils/logHandler.ts` (pino multistream to `logs/<iso>_*.txt` + pretty stdout). `no-console` is off in ESLint, but `console.log` is still banned by convention — always use the pino logger.
- **Env:** add new env vars to both `sample.env` and `validateEnv.ts` (the process must exit on missing required vars).
