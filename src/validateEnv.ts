import { Bot } from './interfaces/Bot';
import { logger } from './utils/logHandler';

export const validateEnv = (bot: Bot): { valid: boolean; message: string } => {
  try {
    if (!process.env.BOT_TOKEN) {
      return { valid: false, message: 'Missing Discord token!' };
    }
    if (!process.env.CLIENT_ID) {
      return { valid: false, message: "Missing Bot's Client ID" };
    }
    if (!process.env.HOME_GUILD_ID) {
      return { valid: false, message: "Missing Bot's Home Guild ID" };
    }

    const configs: Bot['configs'] = {
      token: process.env.BOT_TOKEN,
      clientId: process.env.CLIENT_ID,
      homeGuildId: process.env.HOME_GUILD_ID,
    };

    bot.configs = configs;
    return { valid: true, message: 'Environment variables validated!' };
  } catch (err) {
    logger.error('Unknown error while validating environment')
    return {
      valid: false,
      message: 'Unknown error while validating environment',
    };
  }
};
