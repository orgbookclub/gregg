import { ButtonInteraction } from "discord.js";

import { Bot } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getEventRequestEmbed,
} from "../../../utils/eventUtils";
import { participantToDto, upsertUser } from "../../../utils/userUtils";

/**
 * Handles the logic for button clicks.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const processButtonClick = async (bot: Bot, interaction: ButtonInteraction) => {
  try {
    if (interaction.customId === "bookmark-delete") {
      await handleBookmarkDelete(interaction);
    } else if (
      interaction.customId.startsWith("er-") ||
      interaction.customId.startsWith("ea-")
    ) {
      await handleEventActions(interaction, bot);
    } else if (interaction.customId.startsWith("qs-")) {
      await handleQotdSuggestionActions(interaction, bot);
    }
  } catch (error) {
    await errorHandler(
      bot,
      "interactionCreate > processButtonClick",
      error,
      interaction.guild?.name,
      interaction.message,
      undefined,
    );
  }
};

async function handleQotdSuggestionActions(
  interaction: ButtonInteraction,
  bot: Bot,
) {
  await interaction.deferReply();
  const [_, qotdId, action] = interaction.customId.split("-");

  if (action === "approve") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: { status: QotdSuggestionStatus.Approved, updatedOn: new Date() },
    });
    await interaction.message.edit({
      content: "Approved",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(`Approved QOTD \`${qotdId}\``);
  } else if (action === "reject") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: { status: QotdSuggestionStatus.Rejected, updatedOn: new Date() },
    });
    await interaction.message.edit({
      content: "Rejected",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply(`Rejected QOTD \`${qotdId}\``);
  }
}

async function handleEventActions(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ ephemeral: true });
  const [embedType, eventId, action] = interaction.customId.split("-");

  const userDoc = await upsertUser(
    bot.api,
    interaction.user.id,
    interaction.user.username,
  );

  const eventResponse = await bot.api.events.eventsControllerFindOne({
    id: eventId,
  });
  if (!eventResponse) {
    await interaction.editReply({
      content: "Invalid event ID! Please try again with a valid event ID.",
    });
    return;
  }
  const eventDoc = eventResponse.data;

  const isUserInterestedInEvent = eventDoc.interested.some(
    (x) => x.user.userId === interaction.user.id,
  );
  if (action === "interested" && isUserInterestedInEvent) {
    await interaction.editReply({
      content:
        "You are already marked as an interested participant of this event!",
    });
    return;
  } else if (action === "notInterested" && !isUserInterestedInEvent) {
    await interaction.editReply({
      content:
        "You were never marked as an interested participant of this event!",
    });
    return;
  }
  const participantDto = {
    points: 0,
    user: userDoc._id,
  };
  const updateEventDto = {
    interested:
      action === "interested"
        ? [
            ...eventDoc.interested.map((x) => participantToDto(x)),
            participantDto,
          ]
        : eventDoc.interested
            .filter((x) => x.user.userId !== interaction.user.id)
            .map((x) => participantToDto(x)),
  };
  const response = await bot.api.events.eventsControllerUpdate({
    id: eventId,
    updateEventDto: updateEventDto,
  });
  const updatedEventDoc = response.data;
  let updatedEmbed;

  if (embedType === "er") {
    updatedEmbed = getEventRequestEmbed(updatedEventDoc, interaction);
  } else if (embedType === "ea") {
    updatedEmbed = getEventInfoEmbed(updatedEventDoc, interaction);
  }
  if (!updatedEmbed) {
    await interaction.editReply(
      "Something went wrong while updating the embed",
    );
    return;
  }
  await interaction.message.edit({ embeds: [updatedEmbed] });
  await interaction.editReply({
    content:
      action === "interested"
        ? "You have been marked as an interested participant for this event!"
        : "You are no longer a participant of this event",
  });
}

async function handleBookmarkDelete(interaction: ButtonInteraction) {
  await interaction.message.delete();
}

export { processButtonClick };
