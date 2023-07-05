import {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Events,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { Bot, Event } from "../../models";
import { processButtonClick } from "../../modules/events/interactions/processButtonClick";
import { logger } from "../../utils/logHandler";

const interactionCreate: Event = {
  name: Events.InteractionCreate,
  run: async (bot: Bot, interaction: Interaction) => {
    try {
      logger.debug(
        `${interaction.user.username} in #${interaction.channel?.id} triggered an interaction.`,
      );
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

async function processContextMenuCommand(
  bot: Bot,
  interaction: ContextMenuCommandInteraction,
) {
  try {
    const { cooldowns } = bot;
    const command = bot.contexts.find(
      (x) => x.data.name === interaction.commandName,
    );

    if (!command) {
      await interaction.reply({
        content: `Something went wrong while trying to run context command ${interaction.commandName}`,
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
        return interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }
    timestamps[interaction.user.id] = now;
    setTimeout(() => delete timestamps[interaction.user.id], cooldownAmount);

    // TODO: Type guards

    // TODO: Can also get guild-specific config settings from here.

    await command.run(bot, interaction);

    // TODO: Usage logging
  } catch (error) {
    logger.error(
      error,
      `Error while executing context command from interactionCreate event`,
    );
  }
}

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
        return interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }
    timestamps[interaction.user.id] = now;
    setTimeout(() => delete timestamps[interaction.user.id], cooldownAmount);

    // TODO: Can add type guards here
    // e.g. isGuildOnly command, isDMOnly command etc.

    // TODO: Can also get guild-specific config settings from here.
    // e.g. does guild have certain features enabled etc.

    await command.run(bot, interaction);

    // TODO: Also track usages here for analytics.
  } catch (error) {
    logger.error(
      error,
      `Error while executing command from interactionCreate event`,
    );
  }
}

// eslint-disable-next-line require-await
async function processStringSelectMenu(
  _bot: Bot,
  _interaction: StringSelectMenuInteraction,
) {
  try {
    // TODO: ... okay nothing to do here.
  } catch (error) {
    logger.error(
      error,
      `Error while processing string select menu from interactionCreate event`,
    );
  }
}

// eslint-disable-next-line require-await
async function processModalSubmit(
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

export { interactionCreate };
