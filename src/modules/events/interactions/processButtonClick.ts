import { ParticipantDto, UpdateEventDto } from "@orgbookclub/ows-client";
import { ButtonInteraction, Message } from "discord.js";

import { Bot } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { participantToDto } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { upsertUser } from "../../../utils/userUtils";

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
    }
    if (
      interaction.customId.startsWith("er-") ||
      interaction.customId.startsWith("ea-")
    ) {
      await handleEventActions(interaction, bot);
    }
    if (interaction.customId.startsWith("qs-")) {
      await handleQotdSuggestionActions(interaction, bot);
    }
  } catch (error) {
    logger.error(
      error,
      `Error while processing button click from interactionCreate event`,
    );
  }
};

async function handleQotdSuggestionActions(
  interaction: ButtonInteraction,
  bot: Bot,
) {
  await interaction.deferReply();
  const parts = interaction.customId.split("-");
  const qotdId = parts[1];
  const action = parts[2];

  if (action === "approve") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: {
        status: QotdSuggestionStatus.Approved,
      },
    });
    await interaction.message.edit({
      content: "Approved",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply("Approved QOTD");
  } else if (action === "reject") {
    await bot.db.qotds.update({
      where: { id: qotdId },
      data: {
        status: QotdSuggestionStatus.Rejected,
      },
    });
    await interaction.message.edit({
      content: "Rejected",
      embeds: interaction.message.embeds,
      components: [],
    });
    await interaction.editReply("Rejected QOTD");
  }
}

async function handleEventActions(interaction: ButtonInteraction, bot: Bot) {
  await interaction.deferReply({ ephemeral: true });
  const parts = interaction.customId.split("-");
  const embedType = parts[0];
  const eventId = parts[1];
  const action = parts[2];

  const user = await upsertUser(bot, interaction.user);

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
        "You are already marked as an interested participant of the event!",
    });
    return;
  }
  if (action === "notInterested" && !isUserInterestedInEvent) {
    await interaction.editReply({
      content:
        "You were never marked as an interested participant of this event!",
    });
    return;
  }
  const participantDto: ParticipantDto = {
    points: 0,
    user: user._id,
  };
  const updateEventDto: UpdateEventDto = {
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

  bot.emit("eventEdit", {
    id: eventId,
    updateEventDto: updateEventDto,
    interaction: interaction,
    updateEmbedType: embedType,
  });
  await interaction.editReply({
    content:
      action === "interested"
        ? "You have been marked as an interested participant for this event!"
        : "You are no longer a participant of this event",
  });
}

async function handleBookmarkDelete(interaction: ButtonInteraction) {
  await (interaction.message as Message).delete();
}

export { processButtonClick };
