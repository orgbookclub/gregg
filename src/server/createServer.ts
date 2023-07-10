import express from "express";

import { logger } from "../utils/logHandler";

/**
 * Spins up a basic web server for uptime monitoring.
 *
 * @returns True if the server was started, false if it crashed.
 */
export const createServer = () => {
  const app = express();
  app.get("/", (_, res) => {
    res.status(200).send("Ping!");
  });

  app.get("/health", (_, res) => {
    res.status(200).send();
  });
  const httpPort = process.env.PORT ?? 3000;

  app.listen(httpPort, () => {
    logger.info(`http server is live on port ${httpPort}`);
  });
  return true;
};
