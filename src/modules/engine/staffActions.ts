import { discordThreadIds } from "./links";
import { discordIdOf, engineTypeKey } from "./mappings";
import {
  EngineEventDetail,
  EngineEventStatus,
  EngineParticipant,
  EngineResultEntry,
  EngineUpdateEventRequest,
} from "./types";

const STATUSES: EngineEventStatus[] = [
  "requested",
  "approved",
  "announced",
  "ongoing",
  "completed",
  "rejected",
  "cancelled",
];

const PRE_START: EngineEventStatus[] = ["requested", "approved", "announced"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SORTS: Record<string, string> = {
  startDateAsc: "startDate",
  startDateDesc: "-startDate",
  endDateAsc: "endDate",
  endDateDesc: "-endDate",
};

function existingFor(
  participants: EngineParticipant[],
  userId: string,
): EngineParticipant | undefined {
  return participants.find((p) => p.user.id === userId);
}

/**
 * The participant list a staff action targets (the OWS `/events adduser`
 * and `removeuser` choices).
 */
export type ParticipantKind = "readers" | "leaders" | "interested";

/**
 * A Discord user selected in the add/remove modal, with their engine user
 * id when they are a club member.
 */
export interface ParticipantTarget {
  discordId: string;
  userId: string | null;
}

/**
 * The engine calls that apply a staff add/remove: staff participation edits
 * (A7) and result entries, plus the selected users who weren't on the list.
 */
export interface ParticipantPlan {
  patches: {
    userId: string;
    body: { interested?: boolean; isLeader?: boolean };
  }[];
  results: EngineResultEntry[];
  notListed: string[];
}

/**
 * What an `/events edit field value` turns into on the engine.
 */
export type EditPlan =
  | { kind: "patch"; body: EngineUpdateEventRequest }
  | { kind: "transition"; to: EngineEventStatus }
  | { kind: "threads"; threadIds: string[] }
  | { kind: "error"; message: string };

/**
 * Normalizes a date typed by staff to a club-calendar date. `YYYY-MM-DD`
 * is used as-is; anything else `Date` can parse is converted via UTC.
 *
 * @param raw The input.
 * @returns The calendar date, or null when unparseable.
 */
export function toCalendarDateInput(raw: string): string | null {
  const value = raw.trim();
  if (DATE_PATTERN.test(value)) return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Plans a staff `/events adduser` or `removeuser` on the engine.
 *
 * - Interested: set or clear interest (staff participation edit).
 * - Leaders: before the event starts, set or clear the leader flag; once
 *   ongoing or completed, record leader points with results instead
 *   (leadership is locked by then).
 * - Readers: record results (completed with the given reader points, or
 *   `not_completed` with 0 on removal).
 *
 * Fields an entry doesn't change are resent with their current values,
 * because the engine resets omitted reader/leader points to type defaults.
 * Targets without an engine user id are treated as not on the list.
 *
 * @param action Add or remove.
 * @param kind The participant list.
 * @param points The points to award when adding readers or leaders.
 * @param targets The selected users.
 * @param participants The event's current participants.
 * @param status The event status.
 * @returns The plan.
 */
export function planParticipantChange(
  action: "add" | "remove",
  kind: ParticipantKind,
  points: number,
  targets: ParticipantTarget[],
  participants: EngineParticipant[],
  status: EngineEventStatus,
): ParticipantPlan {
  const plan: ParticipantPlan = { patches: [], results: [], notListed: [] };
  const beforeStart = PRE_START.includes(status);
  for (const target of targets) {
    const existing = target.userId
      ? existingFor(participants, target.userId)
      : undefined;
    if (action === "remove") {
      const listed =
        !!existing &&
        (kind === "interested"
          ? existing.interested
          : kind === "leaders"
            ? existing.isLeader
            : existing.completion === "completed");
      if (!listed) {
        plan.notListed.push(target.discordId);
        continue;
      }
    }
    if (!target.userId) {
      plan.notListed.push(target.discordId);
      continue;
    }
    const userId = target.userId;
    const add = action === "add";
    if (kind === "interested") {
      plan.patches.push({ userId, body: { interested: add } });
    } else if (kind === "leaders" && beforeStart) {
      plan.patches.push({ userId, body: { isLeader: add } });
    } else if (kind === "leaders") {
      plan.results.push({
        userId,
        completion: existing?.completion ?? "unknown",
        isLeader: add,
        leaderPoints: add ? points : 0,
        readerPoints: existing?.points.reader ?? 0,
      });
    } else {
      plan.results.push({
        userId,
        completion: add ? "completed" : "not_completed",
        readerPoints: add ? points : 0,
        leaderPoints: existing?.points.leader ?? 0,
      });
    }
  }
  return plan;
}

/**
 * Maps an `/events edit` field and value onto an engine change.
 *
 * @param field The OWS edit field (`EventFieldOptions` value).
 * @param value The new value.
 * @param event The current event.
 * @returns The plan.
 */
export function planEventEdit(
  field: string,
  value: string,
  event: EngineEventDetail,
): EditPlan {
  const base = { expectedVersion: event.version };
  switch (field) {
    case "status": {
      const to = value.trim().toLowerCase() as EngineEventStatus;
      if (!STATUSES.includes(to)) {
        return {
          kind: "error",
          message: `Invalid status. Use one of: ${STATUSES.join(", ")}.`,
        };
      }
      return { kind: "transition", to };
    }
    case "type":
      return {
        kind: "patch",
        body: { ...base, typeKey: engineTypeKey(value.trim()) },
      };
    case "dates.startDate":
    case "dates.endDate": {
      const date = toCalendarDateInput(value);
      if (!date) {
        return { kind: "error", message: "Invalid date. Use YYYY-MM-DD." };
      }
      return {
        kind: "patch",
        body:
          field === "dates.startDate"
            ? { ...base, startDate: date }
            : { ...base, endDate: date },
      };
    }
    case "threads": {
      const threadIds = value
        .split(",")
        .map((id) => id.trim().replace(/^<#(\d+)>$/, "$1"))
        .filter((id) => id.length > 0);
      if (threadIds.some((id) => !/^\d+$/.test(id))) {
        return {
          kind: "error",
          message: "Threads must be a comma-separated list of channel ids.",
        };
      }
      return { kind: "threads", threadIds };
    }
    case "description":
      return { kind: "patch", body: { ...base, description: value } };
    case "name":
      return { kind: "patch", body: { ...base, title: value.trim() } };
    default:
      return {
        kind: "error",
        message: `Editing \`${field}\` isn't supported on the engine backend.`,
      };
  }
}

/**
 * Maps the OWS list options (`EventTypeOptions`, `EventStatusOptions`,
 * `EventSortOptions` values) onto an engine list query.
 *
 * @param options The options.
 * @param options.type The OWS event type.
 * @param options.status The OWS status.
 * @param options.sort The OWS sort.
 * @param options.q The search text.
 * @param options.mine Whether to list only the actor's events.
 * @param options.participant Only events this engine user takes part in.
 * @returns The query.
 */
export function engineListQuery(options: {
  type?: string | null;
  status?: string | null;
  sort?: string | null;
  q?: string | null;
  mine?: boolean;
  participant?: string;
}): Record<string, string | boolean | undefined> {
  return {
    typeKey: options.type ? engineTypeKey(options.type) : undefined,
    status: options.status ? options.status.toLowerCase() : undefined,
    sort: SORTS[options.sort ?? "startDateDesc"] ?? "-startDate",
    q: options.q ?? undefined,
    mine: options.mine || undefined,
    participant: options.participant,
  };
}

/**
 * Discord user ids of the event's interested participants (for broadcast
 * pings). Participants without a known Discord id are skipped.
 *
 * @param participants The participants.
 * @returns The Discord ids.
 */
export function interestedDiscordIds(
  participants: EngineParticipant[],
): string[] {
  return participants
    .filter((p) => p.interested)
    .map((p) => discordIdOf(p.user))
    .filter((id): id is string => !!id);
}

/**
 * The Discord thread to broadcast in when no channel is given.
 *
 * @param event The event.
 * @returns The first linked thread id, or null.
 */
export function primaryThreadId(event: EngineEventDetail): string | null {
  return discordThreadIds(event.externalLinks)[0] ?? null;
}
