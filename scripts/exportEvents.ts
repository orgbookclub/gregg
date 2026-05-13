import {
  EventDocument,
  EventsV2ControllerFindStatusEnum,
} from "@organizedbookclub/ows-client";
import { createArrayCsvWriter as createCsvWriter } from "csv-writer";

import { getAuthorString } from "../src/utils/bookUtils";
import { findEventsPage } from "../src/utils/eventsApi";

import { getOwsClient } from "./utils";

const BASE_URL = process.env.API_URL ?? "";
const PAGE_SIZE = 100;
main();

async function main() {
  const client = await getOwsClient(BASE_URL);
  const allEvents: EventDocument[] = [];
  let page = 1;
  while (true) {
    const res = await findEventsPage(
      client,
      { status: EventsV2ControllerFindStatusEnum.Completed },
      undefined,
      undefined,
      page,
      PAGE_SIZE,
    );
    allEvents.push(...res.items);
    if (page * res.pageSize >= res.total) break;
    page += 1;
  }
  const allRows: (string | number)[][] = [];
  const header = [
    "ID",
    "Title",
    "Author",
    "Link",
    "Pages",
    "Event Type",
    "Event Status",
    "Start Date",
    "End Date",
    "Participant Type",
    "Points",
    "User ID",
  ];

  for (const eventDoc of allEvents) {
    const row: (string | number)[] = [
      eventDoc._id,
      eventDoc.book.title,
      getAuthorString(eventDoc.book.authors, 3),
      eventDoc.book.url,
      eventDoc.book.numPages,
      eventDoc.type,
      eventDoc.status,
      new Date(eventDoc.dates.startDate).toISOString(),
      new Date(eventDoc.dates.endDate).toISOString(),
    ];

    for (const leader of eventDoc.leaders) {
      const newRow = [...row, "leader", leader.points, leader.user.userId];
      allRows.push(newRow);
    }
    for (const reader of eventDoc.readers) {
      const newRow = [...row, "reader", reader.points, reader.user.userId];
      allRows.push(newRow);
    }
  }
  const writer = createCsvWriter({
    path: "data/scores.csv",
    header: header,
  });
  writer.writeRecords(allRows);
}
