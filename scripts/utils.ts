import { OWSClient } from "../src/providers/owsClient";
import { logger } from "../src/utils/logHandler";

/**
 * Returns the client.
 *
 * @param baseUrl The base URL.
 * @returns The client.
 */
export async function getOwsClient(baseUrl: string) {
  logger.debug(`Connecting to ${baseUrl}...`);
  const client = new OWSClient(baseUrl);
  await client.initialize();
  logger.debug("Initalized API Client!");
  return client;
}
