import {
  ChatInputCommandInteraction,
  Events,
  TimestampStyles,
  time,
} from "discord.js";

import { Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Handles all slash commands.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
async function processChatInputCommand(
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  try {
    const { cooldowns } = bot;
    const command = bot.commands.find(
      (x) => x.data.name === interaction.commandName,
    );

    if (!command) {
      await interaction.reply({
        content: `Something went wrong while trying to run command ${interaction.commandName}`,
      });
      return;
    }

    if (!cooldowns[command.data.name]) {
      cooldowns[command.data.name] = {};
    }

    const now = Date.now();
    const timestamps = cooldowns[command.data.name];
    const defaultCooldownDuration = 0;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

    if (timestamps[interaction.user.id]) {
      const expirationTime = timestamps[interaction.user.id] + cooldownAmount;
      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        interaction.reply({
          content: `Please wait, you are on a cooldown for \`${
            command.data.name
          }\`. You can use it again ${time(
            expiredTimestamp,
            TimestampStyles.RelativeTime,
          )}.`,
          ephemeral: true,
        });
        return;
      }
    }
    timestamps[interaction.user.id] = now;
    setTimeout(() => delete timestamps[interaction.user.id], cooldownAmount);

    // TODO: Can add type guards here
    // TODO: Can also get guild-specific config settings from here.
    // e.g. does guild have certain features enabled etc.
    await command.run(bot, interaction);

    await upsertCommandUsageInDb(bot, interaction);
  } catch (error) {
    logger.error(error, `Error in ${Events.InteractionCreate}`);
  }
}

/**
 * For tracking command stats.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
async function upsertCommandUsageInDb(
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) {
  await bot.db.commandUsages.upsert({
    where: {
      // eslint-disable-next-line camelcase
      command_subcommand: {
        command: interaction.commandName,
        subcommand: interaction.options.getSubcommand(false) ?? "no subcommand",
      },
    },
    update: {
      uses: {
        increment: 1,
      },
      updatedOn: new Date(),
    },
    create: {
      command: interaction.commandName,
      subcommand: interaction.options.getSubcommand(false) ?? "no subcommand",
      uses: 1,
      createdOn: new Date(),
      updatedOn: new Date(),
    },
  });
}

export { processChatInputCommand };
