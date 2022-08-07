import { Interaction } from "discord.js";

import { Bot } from "../../interfaces/Bot";
import { Event } from "../../interfaces/Event";
import { logger } from "../../utils/logHandler";

export const interactionCreate: Event = {
  name: "interactionCreate",
  run: async (bot: Bot, interaction: Interaction) => {
    try {
      console.log(
        `${interaction.user.tag} in #${interaction.channel?.id} triggered an interaction.`,
      );
      if (interaction.isChatInputCommand()) {
        const command = bot.commands.find(
          (el) => el.data.name === interaction.commandName,
        );

        if (!command) return;

        try {
          await command.run(bot, interaction);
        } catch (error) {
          console.error(error);
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        }
      } else if (interaction.isContextMenuCommand()) {
        const command = bot.contexts.find(
          (el) => el.data.name === interaction.commandName,
        );

        if (!command) return;

        try {
          await command.run(bot, interaction);
        } catch (error) {
          console.error(error);
          await interaction.reply({
            content: "There was an error while executing this context command!",
            ephemeral: true,
          });
        }
      }
    } catch (err) {
      logger.error(`Error in interactionCreate: ${err}`);
    }
  },
};
