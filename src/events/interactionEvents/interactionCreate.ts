import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Interaction,
  Message,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

const interactionCreate: Event = {
  name: "interactionCreate",
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
    const command = bot.contexts.find(
      (el) => el.data.name === interaction.commandName,
    );

    if (!command) {
      await interaction.reply({
        content: `Something went wrong while trying to run context command ${interaction.commandName}`,
      });
      return;
    }

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
    const command = bot.commands.find(
      (el) => el.data.name === interaction.commandName,
    );

    if (!command) {
      await interaction.reply({
        content: `Something went wrong while trying to run command ${interaction.commandName}`,
      });
      return;
    }

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

async function processButtonClick(bot: Bot, interaction: ButtonInteraction) {
  try {
    if (interaction.customId === "delete-bookmark") {
      await (interaction.message as Message).delete();
    }

    // TODO: Other generic button actions can go here.
  } catch (error) {
    logger.error(
      error,
      `Error while processing button click from interactionCreate event`,
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
