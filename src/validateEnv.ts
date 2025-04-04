import { Bot } from "./models";
import { logger } from "./utils/logHandler";

/**
 * Validates that all expected environment variables are set with *some* value.
 * Does not validate that the values are valid. Constructs a config object and
 * attaches it to the bot instance. Terminates the process on missing values.
 *
 * @returns The bots config object.
 */
export const validateEnv = (): Bot["configs"] => {
  if (!process.env.DISCORD_TOKEN) {
    logger.error("Missing Discord token");
    process.exit(1);
  }
  if (!process.env.CLIENT_ID) {
    logger.error("Missing Bot's Client ID");
    process.exit(1);
  }
  if (!process.env.CLIENT_SECRET) {
    logger.error("Missing Bot's Client secret");
    process.exit(1);
  }
  if (!process.env.API_URL) {
    logger.error("Missing API Url");
    process.exit(1);
  }
  if (!process.env.SENTRY_DSN) {
    logger.error("Missing Sentry DSN");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    logger.error("Missing MongoDB URI");
    process.exit(1);
  }
  if (!process.env.WH_URL) {
    logger.error("Missing Debug Webhook URL");
    process.exit(1);
  }

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    apiUrl: process.env.API_URL,
    whUrl: process.env.WH_URL,
  };
};
