import { actorHeaders } from "./actor";
import {
  EngineActor,
  EngineAppTokenResponse,
  EngineBook,
  EngineBookSearchResult,
  EngineClubContext,
  EngineClubOverview,
  EngineCreateManualBookRequest,
  EngineCreateEventRequest,
  EngineEventDetail,
  EngineEventListItem,
  EngineExternalLinkInput,
  EngineFeedPage,
  EngineImportBookRequest,
  EngineInstallation,
  EngineInstallationSettings,
  EngineInstallationTokenResponse,
  EngineItems,
  EngineLeaderboard,
  EngineMember,
  EngineMemberStats,
  EnginePage,
  EngineParticipant,
  EngineProblem,
  EngineResultEntry,
  EngineStatsWindowQuery,
  EngineTierAssignment,
  EngineUpdateEventRequest,
} from "./types";

type FetchLike = typeof fetch;

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  token?: string;
  basicAuth?: { username: string; password: string };
  body?: unknown;
  form?: Record<string, string>;
  query?: Record<string, QueryValue>;
  actor?: EngineActor;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

interface CachedInstallation {
  client: EngineInstallationClient | null;
  expiresAt: number;
}

/**
 * Tokens are refreshed this long before the engine-reported expiry, leaving
 * room for clock drift and slow requests.
 */
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const INSTALLATION_CACHE_TTL_MS = 5 * 60 * 1000;
const MISSING_INSTALLATION_CACHE_TTL_MS = 60 * 1000;

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * An error response from the engine, carrying the RFC 7807 problem fields.
 */
export class EngineError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly detail: string | undefined;

  /**
   * Creates an engine error.
   *
   * @param method The HTTP method.
   * @param path The request path.
   * @param problem The parsed problem body.
   */
  constructor(method: string, path: string, problem: EngineProblem) {
    super(
      `${method} ${path} → HTTP ${problem.status}${problem.code ? ` ${problem.code}` : ""}${problem.detail ? `: ${problem.detail}` : ""}`,
    );
    this.name = "EngineError";
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
  }
}

/**
 * Options for {@link EngineClient}.
 */
export interface EngineClientOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: FetchLike;
  now?: () => number;
}

/**
 * App-level client for the gregg-core engine. Holds the app token (client
 * credentials), claims installations, and hands out per-guild
 * {@link EngineInstallationClient}s with cached installation tokens.
 */
export class EngineClient {
  readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: FetchLike;
  readonly now: () => number;
  private appToken: CachedToken | null = null;
  private appTokenPromise: Promise<string> | null = null;
  private installations = new Map<string, CachedInstallation>();
  private installationPromises = new Map<
    string,
    Promise<EngineInstallationClient | null>
  >();

  /**
   * Creates a client.
   *
   * @param options The engine URL and app credentials.
   */
  constructor(options: EngineClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  /**
   * Sends a request and parses the JSON response. Throws {@link EngineError}
   * on non-2xx responses.
   *
   * @param method The HTTP method.
   * @param path The path below the base URL.
   * @param options Auth, body, query and actor options.
   * @returns The parsed body.
   */
  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    let body: string | undefined;
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.basicAuth) {
      const raw = `${options.basicAuth.username}:${options.basicAuth.password}`;
      headers.Authorization = `Basic ${Buffer.from(raw).toString("base64")}`;
    }
    if (options.actor) Object.assign(headers, actorHeaders(options.actor));
    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.form).toString();
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const url = `${this.baseUrl}${path}${buildQuery(options.query)}`;
    const response = await this.fetchImpl(url, { method, headers, body });
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { detail: text };
      }
    }
    if (!response.ok) {
      const problem = (parsed ?? {}) as Partial<EngineProblem>;
      throw new EngineError(method, path, {
        ...problem,
        status: response.status,
      });
    }
    return parsed as T;
  }

  /**
   * Returns a valid app token, fetching one with client credentials when the
   * cached token is missing or close to expiry.
   *
   * @returns The app token.
   */
  async getAppToken(): Promise<string> {
    if (
      this.appToken &&
      this.now() < this.appToken.expiresAt - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.appToken.value;
    }
    if (!this.appTokenPromise) {
      this.appTokenPromise = this.fetchAppToken().finally(() => {
        this.appTokenPromise = null;
      });
    }
    return await this.appTokenPromise;
  }

  /**
   * Claims a link code created by a club admin, binding the guild to the club.
   *
   * @param code The link code.
   * @param guildId The Discord guild id.
   * @param guildName The Discord guild name.
   * @returns The new installation.
   */
  async claimInstallation(
    code: string,
    guildId: string,
    guildName: string,
  ): Promise<EngineInstallation> {
    const installation = await this.appRequest<EngineInstallation>(
      "POST",
      "/v1/apps/installations/claim",
      {
        body: {
          code: code.trim(),
          externalTenantId: guildId,
          externalTenantName: guildName,
        },
      },
    );
    this.invalidateGuild(guildId);
    return installation;
  }

  /**
   * Lists this app's installations, optionally for one guild.
   *
   * @param guildId The Discord guild id to filter on.
   * @returns The installations in every status, newest first.
   */
  async listInstallations(guildId?: string): Promise<EngineInstallation[]> {
    const page = await this.appRequest<EngineItems<EngineInstallation>>(
      "GET",
      "/v1/apps/installations",
      { query: { externalTenantId: guildId } },
    );
    return page.items;
  }

  /**
   * Mints a 1 h installation token.
   *
   * @param installationId The installation id.
   * @returns The token response, including the bound club id.
   */
  async mintInstallationToken(
    installationId: string,
  ): Promise<EngineInstallationTokenResponse> {
    return await this.appRequest<EngineInstallationTokenResponse>(
      "POST",
      `/v1/apps/installations/${installationId}/token`,
    );
  }

  /**
   * Returns the client for the guild's active installation, or null when the
   * guild isn't linked. Results are cached briefly.
   *
   * @param guildId The Discord guild id.
   * @returns The installation client, or null.
   */
  async forGuild(guildId: string): Promise<EngineInstallationClient | null> {
    const cached = this.installations.get(guildId);
    if (cached && this.now() < cached.expiresAt) return cached.client;
    let pending = this.installationPromises.get(guildId);
    if (!pending) {
      pending = this.resolveGuild(guildId).finally(() => {
        this.installationPromises.delete(guildId);
      });
      this.installationPromises.set(guildId, pending);
    }
    return await pending;
  }

  /**
   * Drops the cached installation for a guild (after a claim or revocation).
   *
   * @param guildId The Discord guild id.
   */
  invalidateGuild(guildId: string): void {
    this.installations.delete(guildId);
  }

  private async resolveGuild(
    guildId: string,
  ): Promise<EngineInstallationClient | null> {
    const installations = await this.listInstallations(guildId);
    const active = installations.find(
      (item) => item.status === "active" && item.externalTenantId === guildId,
    );
    let client: EngineInstallationClient | null = null;
    if (active) {
      client = new EngineInstallationClient(this, active);
      await client.getToken();
    }
    this.installations.set(guildId, {
      client,
      expiresAt:
        this.now() +
        (client
          ? INSTALLATION_CACHE_TTL_MS
          : MISSING_INSTALLATION_CACHE_TTL_MS),
    });
    return client;
  }

  private async appRequest<T>(
    method: string,
    path: string,
    options: Omit<RequestOptions, "token"> = {},
  ): Promise<T> {
    const token = await this.getAppToken();
    try {
      return await this.request<T>(method, path, { ...options, token });
    } catch (error) {
      if (!(error instanceof EngineError) || error.status !== 401) throw error;
      this.appToken = null;
      const fresh = await this.getAppToken();
      return await this.request<T>(method, path, { ...options, token: fresh });
    }
  }

  private async fetchAppToken(): Promise<string> {
    const response = await this.request<EngineAppTokenResponse>(
      "POST",
      "/v1/auth/app-token",
      {
        basicAuth: { username: this.clientId, password: this.clientSecret },
        // eslint-disable-next-line camelcase
        form: { grant_type: "client_credentials" },
      },
    );
    this.appToken = {
      value: response.access_token,
      expiresAt: this.now() + response.expires_in * 1000,
    };
    return response.access_token;
  }
}

/**
 * Club-scoped client for one installation (one Discord guild). Mints and
 * caches the installation token and asserts actors per request.
 */
export class EngineInstallationClient {
  readonly installation: EngineInstallation;
  private readonly engine: EngineClient;
  private token: CachedToken | null = null;
  private tokenPromise: Promise<string> | null = null;
  private boundClubId: string | null = null;

  /**
   * Creates an installation client.
   *
   * @param engine The app-level client.
   * @param installation The active installation.
   */
  constructor(engine: EngineClient, installation: EngineInstallation) {
    this.engine = engine;
    this.installation = installation;
  }

  /**
   * The Discord guild id bound to this installation.
   *
   * @returns The guild id.
   */
  get guildId(): string {
    return this.installation.externalTenantId;
  }

  /**
   * The club the installation token is bound to. Available after the first
   * token was minted, which {@link EngineClient.forGuild} guarantees.
   *
   * @returns The club id.
   */
  get clubId(): string {
    if (!this.boundClubId) {
      throw new Error("Installation token has not been minted yet");
    }
    return this.boundClubId;
  }

  /**
   * Returns a valid installation token, minting a new one near expiry.
   *
   * @returns The token.
   */
  async getToken(): Promise<string> {
    if (
      this.token &&
      this.engine.now() < this.token.expiresAt - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.token.value;
    }
    if (!this.tokenPromise) {
      this.tokenPromise = this.mint().finally(() => {
        this.tokenPromise = null;
      });
    }
    return await this.tokenPromise;
  }

  /**
   * Sends a request with the installation token, retrying once with a fresh
   * token on 401. A 401 after re-minting means the installation was revoked.
   *
   * @param method The HTTP method.
   * @param path The path below the base URL.
   * @param options Body, query and actor options.
   * @returns The parsed body.
   */
  async request<T>(
    method: string,
    path: string,
    options: Omit<RequestOptions, "token" | "basicAuth"> = {},
  ): Promise<T> {
    const token = await this.getToken();
    try {
      return await this.engine.request<T>(method, path, { ...options, token });
    } catch (error) {
      if (!(error instanceof EngineError) || error.status !== 401) throw error;
      this.token = null;
      let fresh: string;
      try {
        fresh = await this.getToken();
      } catch (mintError) {
        this.engine.invalidateGuild(this.guildId);
        throw mintError;
      }
      return await this.engine.request<T>(method, path, {
        ...options,
        token: fresh,
      });
    }
  }

  /**
   * Fetches the club context; `me` is set when an actor is given.
   *
   * @param actor The optional actor.
   * @returns The club context.
   */
  async getClub(actor?: EngineActor): Promise<EngineClubContext> {
    return await this.request("GET", this.clubPath(), { actor });
  }

  /**
   * Fetches an event. Permissions and transitions are computed for the actor.
   *
   * @param eventId The event id.
   * @param actor The optional actor.
   * @returns The event.
   */
  async getEvent(
    eventId: string,
    actor?: EngineActor,
  ): Promise<EngineEventDetail> {
    return await this.request("GET", this.eventPath(eventId), { actor });
  }

  /**
   * Lists events.
   *
   * @param query The list filters.
   * @returns A page of events.
   */
  async listEvents(
    query: Record<string, QueryValue>,
  ): Promise<EnginePage<EngineEventListItem>> {
    return await this.request("GET", `${this.clubPath()}/events`, { query });
  }

  /**
   * Lists events with the viewer's participation (`me`) filled in for the
   * actor, which also makes `mine=true` work.
   *
   * @param query The list filters.
   * @param actor The viewer.
   * @returns A page of events.
   */
  async listEventsAs(
    query: Record<string, QueryValue>,
    actor: EngineActor,
  ): Promise<EnginePage<EngineEventListItem>> {
    return await this.request("GET", `${this.clubPath()}/events`, {
      query,
      actor,
    });
  }

  /**
   * Edits an event as the actor (optimistic concurrency via
   * `expectedVersion`).
   *
   * @param eventId The event id.
   * @param body The changed fields.
   * @param actor The actor.
   * @returns The updated event.
   */
  async updateEvent(
    eventId: string,
    body: EngineUpdateEventRequest,
    actor: EngineActor,
  ): Promise<EngineEventDetail> {
    return await this.request("PATCH", this.eventPath(eventId), {
      body,
      actor,
    });
  }

  /**
   * Records results (completion and points) for members as the actor.
   *
   * @param eventId The event id.
   * @param entries The result entries.
   * @param actor The actor.
   * @returns All participants after the upsert.
   */
  async recordResults(
    eventId: string,
    entries: EngineResultEntry[],
    actor: EngineActor,
  ): Promise<EngineParticipant[]> {
    const page = await this.request<EngineItems<EngineParticipant>>(
      "POST",
      `${this.eventPath(eventId)}/results`,
      { body: { entries }, actor },
    );
    return page.items;
  }

  /**
   * Searches the book catalogue, then the first book source (Goodreads,
   * StoryGraph, Open Library) that has hits.
   *
   * @param q The query.
   * @param limit The maximum number of results.
   * @returns The results.
   */
  async searchBooks(q: string, limit = 10): Promise<EngineBookSearchResult[]> {
    const page = await this.request<EngineItems<EngineBookSearchResult>>(
      "GET",
      "/v1/books/search",
      { query: { q, limit } },
    );
    return page.items;
  }

  /**
   * Fetches a catalogue book.
   *
   * @param bookId The book id.
   * @returns The book.
   */
  async getBook(bookId: string): Promise<EngineBook> {
    return await this.request("GET", `/v1/books/${encodeURIComponent(bookId)}`);
  }

  /**
   * Adds a book that no book source knows to the catalogue.
   *
   * @param body The book.
   * @returns The created book.
   */
  async createBook(body: EngineCreateManualBookRequest): Promise<EngineBook> {
    return await this.request("POST", "/v1/books", { body });
  }

  /**
   * Lists the participants of an event.
   *
   * @param eventId The event id.
   * @returns The participants.
   */
  async listParticipants(eventId: string): Promise<EngineParticipant[]> {
    const page = await this.request<EngineItems<EngineParticipant>>(
      "GET",
      `${this.eventPath(eventId)}/participants`,
    );
    return page.items;
  }

  /**
   * Creates an event as the actor (members can only request).
   *
   * @param body The event to create.
   * @param actor The actor.
   * @returns The created event.
   */
  async createEvent(
    body: EngineCreateEventRequest,
    actor: EngineActor,
  ): Promise<EngineEventDetail> {
    return await this.request("POST", `${this.clubPath()}/events`, {
      body,
      actor,
    });
  }

  /**
   * Joins or leaves an event as the actor.
   *
   * @param eventId The event id.
   * @param interested Whether to join (true) or leave (false).
   * @param actor The actor.
   * @returns The updated event.
   */
  async setInterest(
    eventId: string,
    interested: boolean,
    actor: EngineActor,
  ): Promise<EngineEventDetail> {
    return await this.request(
      interested ? "POST" : "DELETE",
      `${this.eventPath(eventId)}/interest`,
      { actor },
    );
  }

  /**
   * Volunteers or withdraws as leader of an event as the actor.
   *
   * @param eventId The event id.
   * @param lead Whether to lead (true) or withdraw (false).
   * @param actor The actor.
   * @returns The updated event.
   */
  async setLead(
    eventId: string,
    lead: boolean,
    actor: EngineActor,
  ): Promise<EngineEventDetail> {
    return await this.request(
      lead ? "POST" : "DELETE",
      `${this.eventPath(eventId)}/lead`,
      { actor },
    );
  }

  /**
   * Moves an event to a new status as the actor.
   *
   * @param eventId The event id.
   * @param to The target status.
   * @param actor The actor.
   * @param reason An optional reason.
   * @returns The updated event.
   */
  async transition(
    eventId: string,
    to: string,
    actor: EngineActor,
    reason?: string,
  ): Promise<EngineEventDetail> {
    return await this.request(
      "POST",
      `${this.eventPath(eventId)}/transitions`,
      { body: reason ? { to, reason } : { to }, actor },
    );
  }

  /**
   * Replaces this installation's (Discord) links on an event. Links of other
   * platforms are preserved by the engine.
   *
   * @param eventId The event id.
   * @param links The full set of Discord links.
   * @returns The updated event.
   */
  async putLinks(
    eventId: string,
    links: EngineExternalLinkInput[],
  ): Promise<EngineEventDetail> {
    return await this.request("PUT", `${this.eventPath(eventId)}/links`, {
      body: { links },
    });
  }

  /**
   * Pushes the guild's role catalogue for the role-mapping UI.
   *
   * @param roles The guild roles.
   * @returns The updated installation.
   */
  async putExternalRoles(
    roles: { id: string; name: string }[],
  ): Promise<EngineInstallation> {
    return await this.request("PUT", "/v1/apps/installation/external-roles", {
      body: { roles },
    });
  }

  /**
   * Reads the installation settings.
   *
   * @returns The settings.
   */
  async getSettings(): Promise<EngineInstallationSettings> {
    return await this.request("GET", "/v1/apps/installation/settings");
  }

  /**
   * Reads one page of the club feed.
   *
   * @param after The cursor to continue after.
   * @param limit The page size (max 500).
   * @returns The feed page.
   */
  async readFeed(after: string, limit = 100): Promise<EngineFeedPage> {
    return await this.request("GET", "/v1/apps/feed", {
      query: { after, limit },
    });
  }

  /**
   * Reads tier assignments, with identities filtered to Discord.
   *
   * @returns The assignments.
   */
  async getTierAssignments(): Promise<EngineTierAssignment[]> {
    const page = await this.request<EngineItems<EngineTierAssignment>>(
      "GET",
      `${this.clubPath()}/tiers/assignments`,
    );
    return page.items;
  }

  /**
   * Reads the leaderboard; `me` is set for the actor.
   *
   * @param query The window query plus paging.
   * @param actor The optional actor.
   * @returns The leaderboard page.
   */
  async getLeaderboard(
    query: EngineStatsWindowQuery & { page?: number; pageSize?: number },
    actor?: EngineActor,
  ): Promise<EngineLeaderboard> {
    return await this.request("GET", `${this.clubPath()}/stats/leaderboard`, {
      query: { ...query },
      actor,
    });
  }

  /**
   * Reads the club overview stats.
   *
   * @param query The window query.
   * @returns The overview.
   */
  async getOverview(
    query: EngineStatsWindowQuery,
  ): Promise<EngineClubOverview> {
    return await this.request("GET", `${this.clubPath()}/stats/overview`, {
      query: { ...query },
    });
  }

  /**
   * Reads the actor's own member stats.
   *
   * @param query The window query.
   * @param actor The actor.
   * @returns The member stats.
   */
  async getMyStats(
    query: EngineStatsWindowQuery,
    actor: EngineActor,
  ): Promise<EngineMemberStats> {
    return await this.request("GET", `${this.clubPath()}/stats/members/me`, {
      query: { ...query },
      actor,
    });
  }

  /**
   * Reads a member's stats by engine user id.
   *
   * @param userId The engine user id.
   * @param query The window query.
   * @returns The member stats.
   */
  async getMemberStats(
    userId: string,
    query: EngineStatsWindowQuery,
  ): Promise<EngineMemberStats> {
    return await this.request(
      "GET",
      `${this.clubPath()}/stats/members/${encodeURIComponent(userId)}`,
      { query: { ...query } },
    );
  }

  /**
   * Looks up a club member by Discord user id without creating anything.
   * Returns null when the identity isn't a member (404).
   *
   * @param subject The Discord user id.
   * @returns The member, or null.
   */
  async findMemberByDiscordId(subject: string): Promise<EngineMember | null> {
    try {
      return await this.request(
        "GET",
        `${this.clubPath()}/members/by-identity/discord/${encodeURIComponent(subject)}`,
      );
    } catch (error) {
      if (error instanceof EngineError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Ensures a Discord user is a club member (an unclaimed user and an
   * integration membership are created when needed). The actor must be
   * staff (contract extension A7).
   *
   * @param subject The Discord user id.
   * @param name The Discord username.
   * @param actor The acting staff member.
   * @returns The member.
   */
  async ensureMemberByDiscordId(
    subject: string,
    name: string,
    actor: EngineActor,
  ): Promise<EngineMember> {
    return await this.request(
      "PUT",
      `${this.clubPath()}/members/by-identity/discord/${encodeURIComponent(subject)}`,
      { body: { name }, actor },
    );
  }

  /**
   * Sets another member's interest or leadership as staff (A7).
   *
   * @param eventId The event id.
   * @param userId The member's engine user id.
   * @param body The flags to set.
   * @param body.interested Whether the member is interested.
   * @param body.isLeader Whether the member leads.
   * @param actor The acting staff member.
   * @returns All participants after the change.
   */
  async updateParticipant(
    eventId: string,
    userId: string,
    body: { interested?: boolean; isLeader?: boolean },
    actor: EngineActor,
  ): Promise<EngineParticipant[]> {
    const page = await this.request<EngineItems<EngineParticipant>>(
      "PATCH",
      `${this.eventPath(eventId)}/participants/${encodeURIComponent(userId)}`,
      { body, actor },
    );
    return page.items;
  }

  /**
   * Removes a member's participation (including results) as staff (A7).
   *
   * @param eventId The event id.
   * @param userId The member's engine user id.
   * @param actor The acting staff member.
   */
  async removeParticipant(
    eventId: string,
    userId: string,
    actor: EngineActor,
  ): Promise<void> {
    await this.request(
      "DELETE",
      `${this.eventPath(eventId)}/participants/${encodeURIComponent(userId)}`,
      { actor },
    );
  }

  /**
   * Imports a book from a book source (Goodreads, StoryGraph, Open Library)
   * by source id, book page URL or ISBN. Idempotent: a known identity returns
   * its catalogue book.
   *
   * @param ref The source id, URL or ISBN.
   * @returns The catalogue book.
   */
  async importBook(ref: EngineImportBookRequest): Promise<EngineBook> {
    return await this.request("POST", "/v1/books/import", { body: ref });
  }

  private clubPath(): string {
    return `/v1/clubs/${this.clubId}`;
  }

  private eventPath(eventId: string): string {
    return `${this.clubPath()}/events/${encodeURIComponent(eventId)}`;
  }

  private async mint(): Promise<string> {
    const response = await this.engine.mintInstallationToken(
      this.installation.id,
    );
    this.boundClubId = response.clubId;
    this.token = {
      value: response.access_token,
      expiresAt: this.engine.now() + response.expires_in * 1000,
    };
    return response.access_token;
  }
}
