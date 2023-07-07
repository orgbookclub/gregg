import {
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  UpdateEventDto,
} from "@orgbookclub/ows-client";

import { Bot, CommandHandler } from "../../../models";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Gives ability to edit an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleEdit: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const value = interaction.options.getString("value", true);

    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.reply({
        content: "Invalid event ID! Please try again with a valid event ID.",
      });
      return;
    }
    const eventDoc = response.data;
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
    // if (field === "book") {
    //   await interaction.reply({content: "Sorry, editing this field is currently not supported :("
    //   });
    //   return;
    // }
    if (field === "threads") {
      const threads = value.split(",").map((x) => x.trim());
      updateEventDto.threads = threads;
    }
    if (field === "requestedBy") {
      const userDoc = await getUserByDiscordId(bot, value);
      if (!userDoc) {
        await interaction.reply(`No user found with user Id: ${value}`);
        return;
      }
      updateEventDto.requestedBy = {
        user: userDoc._id,
        points: 0,
      };
    }
    // if (field === "interested") {
    //   await interaction.reply({
    //     content: "Sorry, editing this field is currently not supported :(",
    //     ephemeral: true,
    //   });
    //   return;
    // }
    // if (field === "readers") {
    //   await interaction.reply({
    //     content: "Sorry, editing this field is currently not supported :(",
    //     ephemeral: true,
    //   });
    //   return;
    // }
    // if (field === "leaders") {
    //   await interaction.reply({
    //     content: "Sorry, editing this field is currently not supported :(",
    //     ephemeral: true,
    //   });
    //   return;
    // }
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
    if (!editResponse) {
      await interaction.editReply(
        "Something went wrong whiled updating the event :(",
      );
      return;
    }
    await interaction.editReply({
      content: "Event edit successful!",
      embeds: [getEventInfoEmbed(editResponse.data, interaction)],
    });
  } catch (err) {
    logger.error(err, `Error in handleEdit`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};

async function getUserByDiscordId(bot: Bot, id: string) {
  const userResponse = await bot.api.users.usersControllerFindOneByUserId({
    userid: id,
  });
  if (!userResponse?.data) {
    return undefined;
  }
  const user = userResponse.data;
  return user;
}

export { handleEdit };
