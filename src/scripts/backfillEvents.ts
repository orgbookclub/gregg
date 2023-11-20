import { OWSClient } from "../providers/owsClient";
import { logger } from "../utils/logHandler";

const BASE_URL = process.env.API_URL ?? "";

void (async () => {
  logger.debug(`Connecting to ${BASE_URL} ...`);
  const client = new OWSClient(BASE_URL);
  await client.initialize();
  logger.debug("Initalized API Client!");
})();
