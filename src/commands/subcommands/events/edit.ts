import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  UpdateEventDto,
} from "@orgbookclub/ows-client";
import { GuildMember } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { hasRole, getUserByDiscordId } from "../../../utils/userUtils";

/**
 * Gives ability to edit an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleEdit: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: errors.StaffRestrictionError,
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const value = interaction.options.getString("value", true);

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
      eventDoc = response.data;
    } catch (error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    const updateEventDto: UpdateEventDto = {};
    if (field === "status") {
      if (
        !Object.values(EventDtoStatusEnum).includes(
          value as keyof typeof EventDtoStatusEnum,
        )
      ) {
        await interaction.reply({ content: "Invalid event status!" });
        return;
      }
      const status = value as keyof typeof EventDtoStatusEnum;
      updateEventDto.status = status;
    }
    if (field === "type") {
      if (
        !Object.values(EventDtoTypeEnum).includes(
          value as keyof typeof EventDtoTypeEnum,
        )
      ) {
        await interaction.reply({ content: "Invalid event type!" });
        return;
      }
      const type = value as keyof typeof EventDtoTypeEnum;
      updateEventDto.type = type;
    }
    if (field === "dates.startDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.reply({ content: "Invalid date format!" });
        return;
      }
      const startDate = new Date(value);
      updateEventDto.dates = eventDoc.dates;
      updateEventDto.dates.startDate = startDate.toISOString();
    }
    if (field === "dates.endDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.reply({ content: "Invalid date format!" });
        return;
      }
      const endDate = new Date(value);
      updateEventDto.dates = eventDoc.dates;
      updateEventDto.dates.endDate = endDate.toISOString();
    }
    if (field === "book") {
      await interaction.reply({
        content: "Sorry, editing this field is currently not supported :(",
      });
      return;
    }
    if (field === "threads") {
      const threads = value.split(",").map((x) => x.trim());
      updateEventDto.threads = threads;
    }
    if (field === "requestedBy") {
      const userDoc = await getUserByDiscordId(bot.api, value);
      if (!userDoc) {
        await interaction.reply(`No user found with user Id: ${value}`);
        return;
      }
      updateEventDto.requestedBy = {
        user: userDoc._id,
        points: 0,
      };
    }
    if (field === "interested") {
      await interaction.reply({
        content: "Sorry, editing this field is currently not supported :(",
        ephemeral: true,
      });
      return;
    }
    if (field === "readers") {
      await interaction.reply({
        content: "Sorry, editing this field is currently not supported :(",
        ephemeral: true,
      });
      return;
    }
    if (field === "leaders") {
      await interaction.reply({
        content: "Sorry, editing this field is currently not supported :(",
        ephemeral: true,
      });
      return;
    }
    if (field === "description") {
      updateEventDto.description = value;
    }
    if (field === "name") {
      updateEventDto.name = value;
    }
    const editResponse = await bot.api.events.eventsControllerUpdate({
      id: id,
      updateEventDto: updateEventDto,
    });
    await interaction.editReply({
      content: "Event updated!",
      embeds: [getEventInfoEmbed(editResponse.data, interaction)],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > edit",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handleEdit };
