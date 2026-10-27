/**
 * The subset of the gregg-core v1 API contract that Gregg uses. The normative
 * source is `gregg-core/docs/api-contract.ts`; keep these shapes structurally
 * compatible with it.
 */

export type EngineEventStatus =
  | "requested"
  | "approved"
  | "announced"
  | "ongoing"
  | "completed"
  | "rejected"
  | "cancelled";

export type EngineCompletion = "unknown" | "completed" | "not_completed";

export type EngineRole = "owner" | "admin" | "moderator" | "member";

export interface EngineItems<T> {
  items: T[];
}

export interface EnginePage<T> extends EngineItems<T> {
  page: number;
  pageSize: number;
  total: number;
}

export interface EngineProblem {
  type?: string;
  title?: string;
  status: number;
  code?: string;
  detail?: string;
  errors?: { field: string; message: string }[];
}

export interface EngineUserSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isClaimed: boolean;
  /** `subject` is present for the installation's own platform (A6). */
  platforms: {
    provider: string;
    username: string | null;
    subject?: string;
  }[];
}

export interface EngineMember {
  user: EngineUserSummary;
  role: EngineRole;
  nickname: string | null;
  source: "web" | "invite" | "integration";
  showOnLeaderboard: boolean;
  joinedAt: string;
}

export interface EngineClub {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  timezone: string;
  memberCount: number;
}

export interface EngineClubMe {
  userId: string;
  role: EngineRole;
  permissions: string[];
  showOnLeaderboard: boolean;
  joinedAt: string;
}

export interface EngineEventType {
  key: string;
  name: string;
  description: string;
  color: string;
  allowMemberRequests: boolean;
  archived: boolean;
}

export interface EngineReaderTier {
  id: string;
  name: string;
  color: string;
  minPoints: number;
  window: "all_time" | "year" | "month";
  awardMode: "threshold" | "top";
}

export interface EngineClubContext {
  club: EngineClub;
  me: EngineClubMe | null;
  eventTypes: EngineEventType[];
  readerTiers: EngineReaderTier[];
  today: string;
}

export interface EngineBookSummary {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}

export type EngineBookSourceId = "goodreads" | "storygraph" | "openlibrary";

export interface EngineBookExternalId {
  source: EngineBookSourceId;
  id: string;
  url: string;
}

export interface EngineBook extends EngineBookSummary {
  subtitle: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  description: string | null;
  genres: string[];
  series: { name: string; position: string | null } | null;
  source: EngineBookSourceId | "manual";
  externalIds: EngineBookExternalId[];
}

/**
 * `POST /books/import`: exactly one of `source` + `externalId`, `url`, or
 * `isbn`.
 */
export type EngineImportBookRequest =
  | { source: EngineBookSourceId; externalId: string }
  | { url: string }
  | { isbn: string };

export interface EngineExternalLink {
  platform: string;
  kind: "thread" | "channel" | "message" | "meeting" | "other";
  url: string;
  externalId: string | null;
  label: string | null;
}

export type EngineExternalLinkInput = Omit<
  EngineExternalLink,
  "externalId" | "label"
> & { externalId?: string | null; label?: string | null };

export interface EnginePoints {
  reader: number;
  leader: number;
  bonus: number;
  total: number;
}

export interface EngineMyParticipation {
  interested: boolean;
  isLeader: boolean;
  completion: EngineCompletion;
  points: EnginePoints;
}

export interface EngineEventListItem {
  id: string;
  title: string;
  status: EngineEventStatus;
  type: { key: string; name: string; color: string };
  book: EngineBookSummary | null;
  startDate: string;
  endDate: string;
  counts: { interested: number; leaders: number; completed: number };
  me: EngineMyParticipation | null;
  externalLinks: EngineExternalLink[];
  version: number;
}

export interface EngineEventPermissions {
  canEdit: boolean;
  canRecordResults: boolean;
  canSetLinks: boolean;
  canJoin: boolean;
  canLeave: boolean;
  canVolunteerLead: boolean;
  canWithdrawLead: boolean;
}

export interface EngineEventDetail extends EngineEventListItem {
  description: string;
  requestedBy: EngineUserSummary | null;
  createdBy: EngineUserSummary | null;
  allowedTransitions: EngineEventStatus[];
  permissions: EngineEventPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface EngineParticipant {
  user: EngineUserSummary;
  interested: boolean;
  isLeader: boolean;
  completion: EngineCompletion;
  points: EnginePoints;
}

export interface EngineUpdateEventRequest {
  title?: string;
  description?: string;
  bookId?: string | null;
  typeKey?: string;
  startDate?: string;
  endDate?: string;
  expectedVersion: number;
}

export interface EngineResultEntry {
  userId: string;
  completion: EngineCompletion;
  isLeader?: boolean;
  readerPoints?: number;
  leaderPoints?: number;
  bonusPoints?: number;
}

export interface EngineBookSearchResult {
  bookId: string | null;
  source: "catalog" | EngineBookSourceId;
  externalId: string | null;
  url: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  isbn13: string | null;
}

export interface EngineCreateManualBookRequest {
  title: string;
  subtitle?: string;
  authors: string[];
  pageCount?: number;
  coverUrl?: string;
  isbn13?: string;
  publishedYear?: number;
  description?: string;
  genres?: string[];
}

export interface EngineCreateEventRequest {
  typeKey: string;
  title?: string;
  bookId?: string;
  description?: string;
  startDate: string;
  endDate: string;
  status?: "requested" | "approved" | "announced";
  leadSelf?: boolean;
}

export interface EngineStatsWindowQuery {
  window?: "all_time" | "year" | "month" | "custom";
  year?: number;
  month?: string;
  from?: string;
  to?: string;
  typeKey?: string;
}

export interface EngineResolvedWindow {
  kind: "all_time" | "year" | "month" | "custom";
  from: string | null;
  to: string | null;
  label: string;
}

export interface EngineTierBadge {
  id: string;
  name: string;
  color: string;
}

export interface EngineLeaderboardEntry {
  rank: number | null;
  user: EngineUserSummary;
  points: number;
  eventsCompleted: number;
  eventsLed: number;
  tiers: EngineTierBadge[];
}

export interface EngineLeaderboard extends EnginePage<EngineLeaderboardEntry> {
  window: EngineResolvedWindow;
  me: EngineLeaderboardEntry | null;
}

export interface EngineTypeBreakdown {
  type: { key: string; name: string; color: string };
  events: number;
  points: number;
}

export interface EngineMemberStats {
  user: EngineUserSummary;
  recentEvents: {
    event: EngineEventListItem;
    points: EnginePoints;
    completion: EngineCompletion;
    isLeader: boolean;
  }[];
  window: EngineResolvedWindow;
  points: number;
  eventsCompleted: number;
  eventsLed: number;
  pagesRead: number;
  rank: number | null;
  byType: EngineTypeBreakdown[];
  topAuthors: { name: string; count: number }[];
  tiers: {
    current: EngineTierBadge[];
    next: {
      tier: EngineTierBadge;
      pointsToNext: number;
      windowPoints: number;
    } | null;
  };
}

export interface EngineClubOverview {
  window: EngineResolvedWindow;
  eventsCompleted: number;
  activeMembers: number;
  totalPoints: number;
  pagesRead: number;
  byType: EngineTypeBreakdown[];
  topReaders: EngineLeaderboardEntry[];
  topLeaders: { user: EngineUserSummary; eventsLed: number }[];
  topBooks: { book: EngineBookSummary; readers: number }[];
  topAuthors: { name: string; count: number }[];
  counts: {
    requested: number;
    approved: number;
    announced: number;
    ongoing: number;
  };
}

export interface EngineTierAssignment {
  user: EngineUserSummary;
  identities: { provider: string; subject: string }[];
  tierIds: string[];
}

export interface EngineInstallation {
  id: string;
  appId: string;
  appName: string;
  platform: string;
  externalTenantId: string;
  externalTenantName: string;
  status: "active" | "revoked";
  scopes: string[];
  roleMappings: { externalRoleId: string; role: string }[];
  externalRoles: { id: string; name: string }[];
  publicSettings: Record<string, unknown>;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface EngineAppTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

export interface EngineInstallationTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  installationId: string;
  clubId: string;
}

export interface EngineInstallationSettings {
  publicSettings: Record<string, unknown>;
  privateSettings: Record<string, unknown>;
}

export type EngineFeedEventType =
  | "event.created"
  | "event.updated"
  | "event.status_changed"
  | "event.links_changed"
  | "participation.changed"
  | "event.results_recorded"
  | "membership.changed"
  | "club.updated";

export interface EngineFeedEntry {
  id: string;
  seq: number;
  version: 1;
  type: EngineFeedEventType;
  clubId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface EngineFeedPage {
  items: EngineFeedEntry[];
  nextCursor: string;
}

/**
 * A platform user Gregg acts for, sent as `X-Actor-*` headers.
 */
export interface EngineActor {
  subject: string;
  name?: string;
  roles?: string[];
}
