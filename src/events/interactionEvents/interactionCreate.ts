import { Interaction } from 'discord.js';
import { Bot } from '../../interfaces/Bot';

export const interactionCreate = {
  name: 'interactionCreate',
  execute: async (bot: Bot, interaction: Interaction) => {
    try {
      console.log(
        `${interaction.user.tag} in #${interaction.channel} triggered an interaction.`,
      );
      if (!interaction.isChatInputCommand()) return;

      const command = bot.commands.find(
        (el) => el.data.name === interaction.commandName,
      );

      if (!command) return;

      try {
        await command.run(bot, interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    } catch (err) {}
  },
};
