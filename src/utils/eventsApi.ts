import {
  EventDocument,
  EventsApiEventsV2ControllerFindRequest,
  EventsV2ControllerFindSortByEnum,
  PaginatedEventsDto,
} from "@organizedbookclub/ows-client";

import { Bot } from "../models";
import { OWSClient } from "../providers/owsClient";

/**
 * Filters accepted by `findEventsPage` and `findAllEvents`.
 *
 * Mirrors the v2 SDK's request type minus the four knobs the wrapper owns
 * (`fields`, `sortBy`, `page`, `pageSize`).
 */
type EventsFindFilters = Omit<
  EventsApiEventsV2ControllerFindRequest,
  "fields" | "sortBy" | "page" | "pageSize"
>;

/**
 * Maximum page size accepted by `/api/v2/events`.
 * Matches `MAX_PAGE_SIZE` in `ows/src/events/v2/dto/event-pagination.v2.dto.ts`.
 */
const EVENTS_MAX_PAGE_SIZE = 100;

/**
 * Field projection for the visible-pagination flows
 * (`/events list`, `/events search`, `/user events`).
 *
 * Inclusion mode. Matches what `getEventsListContainer` renders:
 * `book.{title,url,coverUrl,authors}`, `type`, `status`, `dates.startDate`,
 * `dates.endDate`. The `_id` field is always returned regardless.
 */
const EVENT_LIST_FIELDS = "book,type,status,dates.startDate,dates.endDate";

/**
 * Field projection for readerboard score aggregation
 * (`/user readerboard`, `jobs/updateReaderRoles`).
 */
const READERBOARD_FIELDS = "readers,leaders";

/**
 * Field projection for per-user event statistics (`/events stats`).
 */
const USER_STATS_FIELDS = "type,status,readers,leaders,interested,requestedBy";

/**
 * Accepts either a {@link Bot} (preferred for command handlers and jobs)
 * or a raw {@link OWSClient} (for scripts that don't carry a Bot instance).
 */
type ApiSource = Bot | OWSClient;

function getEventsApi(source: ApiSource) {
  return "api" in source ? source.api.events : source.events;
}

/**
 * Fetches a single page of events from `/api/v2/events`.
 *
 * @param source A {@link Bot} or {@link OWSClient}.
 * @param filters Filter clauses (status, type, participantIds, etc.).
 * @param fields Comma-separated projection string, or `undefined` for the full document.
 * @param sortBy Sort key, or `undefined` for the backend default (`startDateDesc`).
 * @param page The 1-based page number to return.
 * @param pageSize The page size to apply (capped server-side at {@link EVENTS_MAX_PAGE_SIZE}).
 * @returns The paginated envelope: `{ items, total, page, pageSize }`.
 */
async function findEventsPage(
  source: ApiSource,
  filters: EventsFindFilters,
  fields: string | undefined,
  sortBy: EventsV2ControllerFindSortByEnum | undefined,
  page: number,
  pageSize: number,
): Promise<PaginatedEventsDto> {
  const res = await getEventsApi(source).eventsV2ControllerFind({
    ...filters,
    fields,
    sortBy,
    page,
    pageSize,
  });
  return res.data;
}

/**
 * Fetches every event matching the filter by paging through `/api/v2/events`.
 *
 * Issues page 1 first to discover `total`, then fetches the remaining pages
 * in bounded-parallel batches (default concurrency 4) and concatenates the
 * results in page order.
 *
 * @param source A {@link Bot} or {@link OWSClient}.
 * @param filters Filter clauses.
 * @param fields Projection string, or `undefined` for full documents.
 * @param sortBy Optional sort key.
 * @param opts Pagination knobs.
 * @param opts.pageSize API page size; defaults to {@link EVENTS_MAX_PAGE_SIZE}.
 * @param opts.concurrency Maximum number of concurrent page fetches; defaults to 4.
 * @returns The flattened list of events across all pages.
 */
async function findAllEvents(
  source: ApiSource,
  filters: EventsFindFilters,
  fields: string | undefined,
  sortBy?: EventsV2ControllerFindSortByEnum,
  opts?: { pageSize?: number; concurrency?: number },
): Promise<EventDocument[]> {
  const pageSize = opts?.pageSize ?? EVENTS_MAX_PAGE_SIZE;
  const concurrency = Math.max(1, opts?.concurrency ?? 4);

  const first = await findEventsPage(
    source,
    filters,
    fields,
    sortBy,
    1,
    pageSize,
  );
  const totalPages = Math.max(1, Math.ceil(first.total / pageSize));
  if (totalPages <= 1) return first.items;

  const remaining: number[] = [];
  for (let p = 2; p <= totalPages; p += 1) remaining.push(p);

  const out: EventDocument[][] = new Array(totalPages);
  out[0] = first.items;

  for (let i = 0; i < remaining.length; i += concurrency) {
    const batch = remaining.slice(i, i + concurrency);
    const pages = await Promise.all(
      batch.map((p) =>
        findEventsPage(source, filters, fields, sortBy, p, pageSize),
      ),
    );
    pages.forEach((pg) => {
      out[pg.page - 1] = pg.items;
    });
  }
  return out.flat();
}

export {
  EVENTS_MAX_PAGE_SIZE,
  EVENT_LIST_FIELDS,
  READERBOARD_FIELDS,
  USER_STATS_FIELDS,
  EventsFindFilters,
  findAllEvents,
  findEventsPage,
};
