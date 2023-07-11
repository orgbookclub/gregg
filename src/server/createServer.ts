import { join } from "path";

import express from "express";

import { logger } from "../utils/logHandler";

/**
 * Spins up a basic web server for uptime monitoring.
 *
 * @returns True if the server was started, false if it crashed.
 */
export const createServer = () => {
  const app = express();
  const docsPath = join(__dirname, "..", "..", "docs");
  app.use("/", express.static(docsPath));

  app.get("/health", (_, res) => {
    res.status(200).send();
  });

  const httpPort = process.env.PORT ?? 3001;

  app.listen(httpPort, () => {
    logger.info(`http server is live on port ${httpPort}`);
  });
  return true;
};
