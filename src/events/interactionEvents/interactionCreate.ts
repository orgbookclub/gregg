import { Events, Interaction } from "discord.js";

import { Bot, Event } from "../../models";
import { processButtonClick } from "../../modules/events/interactions/processButtonClick";
import { processChatInputCommand } from "../../modules/events/interactions/processChatInputCommand";
import { processContextMenuCommand } from "../../modules/events/interactions/processContextMenuCommand";
import { processModalSubmit } from "../../modules/events/interactions/processModalSubmit";
import { processStringSelectMenu } from "../../modules/events/interactions/processStringSelectMenu";
import { logger } from "../../utils/logHandler";

const interactionCreate: Event = {
  name: Events.InteractionCreate,
  run: async (bot: Bot, interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await processChatInputCommand(bot, interaction);
      }
      if (interaction.isContextMenuCommand()) {
        await processContextMenuCommand(bot, interaction);
      }
      if (interaction.isButton()) {
        await processButtonClick(bot, interaction);
      }
      if (interaction.isStringSelectMenu()) {
        await processStringSelectMenu(bot, interaction);
      }
      if (interaction.isModalSubmit()) {
        await processModalSubmit(bot, interaction);
      }
    } catch (err) {
      logger.error(err, `Error while handling interactionCreate event`);
    }
  },
};

export { interactionCreate };
