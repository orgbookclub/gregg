/* eslint-disable @typescript-eslint/no-explicit-any */
import { createReadStream } from "fs";

import {
  CreateEventDto,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  ParticipantDto,
} from "@orgbookclub/ows-client";
import { parse } from "csv-parse";

import { OWSClient } from "../src/providers/owsClient";
import { logger } from "../src/utils/logHandler";
import { upsertUser } from "../src/utils/userUtils";

const BASE_URL = process.env.API_URL ?? "http://localhost:3000";
const DATA_CSV = "scripts/data.csv";
const MEMBERS_CSV = "scripts/members.csv";

main();

async function main() {
  const client = await getOwsClient();
  const memberMap = await getMemberIdMap();
  const groupedEventRecords: Record<string, any[]> =
    await getGroupedEventRecords();

  for await (const key of Object.keys(groupedEventRecords)) {
    const response = await client.events.eventsControllerFind({ name: key });
    if (response.data.length > 0) {
      logger.info(`Event with key: ${key} already created, skipping...`);
    } else {
      await processAndCreateEvent(
        groupedEventRecords[key],
        key,
        client,
        memberMap,
      );
    }
  }
}

async function processAndCreateEvent(
  rows: any[],
  key: string,
  client: OWSClient,
  memberMap: Record<string, string>,
) {
  const firstRow = rows[0];
  logger.info(`Start processing event for: ${firstRow["Name of Book"]}`);
  const url = firstRow["Link"];
  const startDate = new Date(firstRow["BR Start"]);
  const endDate = new Date(firstRow["BR end"]);

  const readerDtos: ParticipantDto[] = await getReaderDtos(rows, client);

  const createEventDto: CreateEventDto = {
    name: key,
    threads: [],
    status: EventDtoStatusEnum.Completed,
    type: EventDtoTypeEnum.BuddyRead,
    dates: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    interested: [],
    readers: readerDtos,
  };

  const leaderName = firstRow["BR leader"].toString().toLowerCase();
  const leaderUserId = memberMap[leaderName];
  if (leaderUserId === undefined) {
    createEventDto.type = EventDtoTypeEnum.MonthlyRead;
  }
  const leaderDto = await getParticipantDto(
    client,
    leaderUserId,
    leaderName,
    3,
  );
  createEventDto.requestedBy = leaderDto;
  createEventDto.leaders = [leaderDto];

  const response = await client.events.eventsControllerCreateFromUrl({
    url: url,
    createEventDto: createEventDto,
  });
  const eventDoc = response.data;
  logger.info(
    `Successfully created event for ${firstRow["Name of Book"]}, ID: ${eventDoc._id}`,
  );
}

async function getReaderDtos(rows: any[], client: OWSClient) {
  const readerDtos: ParticipantDto[] = [];
  for await (const row of rows) {
    const dto = await getParticipantDto(
      client,
      row["ID"],
      row["Members"],
      row["Points"],
    );
    readerDtos.push(dto);
  }
  return readerDtos;
}

async function getParticipantDto(
  client: OWSClient,
  userId: string | undefined,
  userName: string,
  points: number,
) {
  if (userId === undefined) {
    userId = "811182966046064660";
    userName = "voeisme";
    points = 0;
  }
  const userDoc = await upsertUser(client, userId, userName);
  const dto = {
    user: userDoc._id,
    points: points,
  };
  return dto;
}

async function getGroupedEventRecords() {
  const records = await readCsv(DATA_CSV);
  const groupedRecords: Record<string, any[]> = {};
  records.forEach((row: Record<string, any>) => {
    const startDate = new Date(row["BR Start"]);
    const endDate = new Date(row["BR end"]);
    const key = row["Link"] + startDate.toISOString() + endDate.toISOString();
    if (groupedRecords[key] === undefined) {
      groupedRecords[key] = [];
    }
    groupedRecords[key].push(row);
  });
  return groupedRecords;
}

async function getMemberIdMap() {
  const memberRecords = await readCsv(MEMBERS_CSV);
  const memberMap: Record<string, string> = {};
  memberRecords.forEach((row: Record<string, any>) => {
    memberMap[row["username"].toString().toLowerCase()] = row["id"];
  });
  return memberMap;
}

async function getOwsClient() {
  logger.debug(`Connecting to ${BASE_URL}...`);
  const client = new OWSClient(BASE_URL);
  await client.initialize();
  logger.debug("Initalized API Client!");
  return client;
}

async function readCsv(filepath: string) {
  const records: any = [];
  logger.debug(`Reading ${filepath}...`);
  const parser = createReadStream(filepath).pipe(
    // eslint-disable-next-line camelcase
    parse({ cast: true, cast_date: true, columns: true, trim: true }),
  );
  for await (const record of parser) {
    records.push(record);
  }
  return records;
}
