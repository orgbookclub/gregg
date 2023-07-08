import { ContextMenuCommandInteraction } from "discord.js";

import { Bot } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Handles all context commands.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export async function processContextMenuCommand(
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
        interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
        return;
      }
    }
    timestamps[interaction.user.id] = now;
    setTimeout(() => delete timestamps[interaction.user.id], cooldownAmount);

    // TODO: Type guards
    // TODO: Can also get guild-specific config settings from here.
    await command.run(bot, interaction);
    // TODO: Usage logging
  } catch (error) {
    errorHandler(
      bot,
      "interactionCreate > processContextMenuCommand",
      error,
      interaction.guild?.id,
      undefined,
      interaction,
    );
  }
}
