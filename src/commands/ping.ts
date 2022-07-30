import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../interfaces/Command';

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  run: async (bot, interaction) => {
    await interaction.reply('Pong!');
  },
};
