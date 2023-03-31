import {
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  UpdateEventDto,
} from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

async function getValidUserById(
  bot: Bot,
  value: string,
  interaction: ChatInputCommandInteraction,
) {
  const userResponse = await bot.api.users.usersControllerFindOneByUserId({
    userid: value,
  });
  if (!userResponse) {
    await interaction.reply(`No user found with user ID: ${value}`);
  }
  const user = userResponse.data;
  return user;
}

/**
 * Gives ability to edit an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleEdit: CommandHandler = async (
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
      const status = value as keyof typeof EventDtoStatusEnum;
      updateEventDto.status = status;
    }
    if (field === "type") {
      const type = value as keyof typeof EventDtoTypeEnum;
      updateEventDto.type = type;
    }
    if (field === "dates.startDate") {
      const startDate = new Date(value);
      updateEventDto.dates = event.dates;
      updateEventDto.dates.startDate = startDate.toISOString();
    }
    if (field === "dates.endDate") {
      const startDate = new Date(value);
      updateEventDto.dates = event.dates;
      updateEventDto.dates.endDate = startDate.toISOString();
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
      const user = await getValidUserById(bot, value, interaction);
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
    logger.error(`Error in handleEdit ${err}`);
    await interaction.followUp({ content: `${err}`, ephemeral: true });
  }
};
