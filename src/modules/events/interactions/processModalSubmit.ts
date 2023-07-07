import { ModalSubmitInteraction } from "discord.js";

import { Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Handles modal submissions.
 *
 * @param _bot The bot instance.
 * @param _interaction The interaction.
 */
// eslint-disable-next-line require-await
export async function processModalSubmit(
  _bot: Bot,
  _interaction: ModalSubmitInteraction,
) {
  try {
    // TODO: ... figure out something to do here.
  } catch (error) {
    logger.error(
      error,
      `Error while processing modal submit from interactionCreate event`,
    );
  }
}
