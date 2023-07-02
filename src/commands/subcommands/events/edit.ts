import {
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  UpdateEventDto,
} from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Gives ability to edit an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleEdit: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const value = interaction.options.getString("value", true);

    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.reply({
        content: "Invalid event ID! Please try again with a valid event ID.",
        ephemeral: true,
      });
      return;
    }
    const event = response.data;
    const updateEventDto: UpdateEventDto = {};
    if (field === "status") {
      if (
        !Object.values(EventDtoStatusEnum).includes(
          value as keyof typeof EventDtoStatusEnum,
        )
      ) {
        await interaction.reply({
          content: "Invalid event status!",
          ephemeral: true,
        });
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
        await interaction.reply({
          content: "Invalid event type!",
          ephemeral: true,
        });
        return;
      }
      const type = value as keyof typeof EventDtoTypeEnum;
      updateEventDto.type = type;
    }
    if (field === "dates.startDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.reply({
          content: "Invalid date format!",
          ephemeral: true,
        });
        return;
      }
      const startDate = new Date(value);
      updateEventDto.dates = event.dates;
      updateEventDto.dates.startDate = startDate.toISOString();
    }
    if (field === "dates.endDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.reply({
          content: "Invalid date format!",
          ephemeral: true,
        });
        return;
      }
      const endDate = new Date(value);
      updateEventDto.dates = event.dates;
      updateEventDto.dates.endDate = endDate.toISOString();
    }
    if (field === "book") {
      await interaction.reply({
        content: "Sorry, editing this field is currently not supported :(",
        ephemeral: true,
      });
      return;
    }
    if (field === "threads") {
      const threads = value.split(",");
      updateEventDto.threads = threads;
    }
    if (field === "requestedBy") {
      const user = await getValidUserById(bot, value);
      if (user === undefined) {
        await interaction.reply(`No user found with user ID: ${value}`);
        return;
      }
      updateEventDto.requestedBy = { ...event.requestedBy, user: user._id };
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
    bot.emit("eventEdit", { id: id, updateEventDto: updateEventDto });
    await interaction.reply({
      content: "Your event edit request has been submitted!",
      ephemeral: true,
    });
  } catch (err) {
    logger.error(err, `Error in handleEdit`);
    await interaction.followUp({ content: `${err}`, ephemeral: true });
  }
};

async function getValidUserById(bot: Bot, value: string) {
  const userResponse = await bot.api.users.usersControllerFindOneByUserId({
    userid: value,
  });
  if (!userResponse || !userResponse.data) {
    return undefined;
  }
  const user = userResponse.data;
  return user;
}

export { handleEdit };
