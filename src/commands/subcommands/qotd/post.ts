import { qotds, GuildsConfig } from "@prisma/client";
import {
  ButtonInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  DiscordjsError,
  Guild,
  GuildMember,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  roleMention,
} from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

const QOTD_POST_MODAL_ID = "qotdPostModal";
const CHANNEL_FIELD_ID = "channel";
const QUESTION_FIELD_ID = "question";
const MODAL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Posts the QOTD message + thread in the given channel and marks the QOTD as
 * Posted in the DB. The DB question text is left untouched.
 *
 * @param bot The bot instance.
 * @param channel The channel to post in.
 * @param qotd The QOTD doc to mark as Posted.
 * @param question The question text to actually post (may differ from `qotd.question`).
 * @param pingRoleId The role to ping in the QOTD message.
 * @returns The posted message.
 */
async function postQotd(
  bot: Bot,
  channel: TextChannel,
  qotd: qotds,
  question: string,
  pingRoleId: string,
) {
  const message = await channel.send(`${roleMention(pingRoleId)} ${question}`);
  await message.startThread({
    name: `QOTD: ${new Date().toDateString()}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  });
  await bot.db.qotds.update({
    where: { id: qotd.id },
    data: { status: QotdSuggestionStatus.Posted, updatedOn: new Date() },
  });
  return message;
}

/**
 * Builds the confirmation modal shown before a QOTD is posted. The channel
 * select is pre-selected to `defaultChannelId` (if any) and the question
 * paragraph is pre-filled with the stored question (editable).
 *
 * @param customId The modal customId.
 * @param qotd The QOTD doc whose values pre-fill the modal.
 * @param defaultChannelId Channel to pre-select (typically the configured QOTD channel).
 * @returns The modal builder.
 */
function getQotdPostModal(
  customId: string,
  qotd: qotds,
  defaultChannelId: string | null,
) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(CHANNEL_FIELD_ID)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);
  if (defaultChannelId) {
    channelSelect.setDefaultChannels(defaultChannelId);
  }

  const questionInput = new TextInputBuilder()
    .setCustomId(QUESTION_FIELD_ID)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(qotd.question)
    .setMaxLength(1500);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Post QOTD")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**QOTD ID:** \`${qotd.id}\``),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Channel")
        .setChannelSelectMenuComponent(channelSelect),
      new LabelBuilder()
        .setLabel("Question (edit before posting if needed)")
        .setTextInputComponent(questionInput),
    );
}

/**
 * Resolves a random Approved QOTD if no id is provided, otherwise loads the
 * given QOTD by id.
 *
 * @param bot The bot instance.
 * @param id Optional QOTD id.
 * @returns The QOTD doc, or null if none could be found.
 */
async function resolveQotd(bot: Bot, id: string | null) {
  if (id) {
    return bot.db.qotds.findUnique({ where: { id } });
  }
  const all = await bot.db.qotds.findMany({
    where: { status: QotdSuggestionStatus.Approved },
  });
  if (all.length === 0) return null;
  return all[Math.floor(Math.random() * all.length)];
}

/**
 * Shared post-QOTD flow: shows the confirmation modal pre-filled with the
 * QOTD's question and the configured (or overridden) channel, then posts on
 * submit. Used by both the `/qotd post` slash command and the Post button on
 * `/qotd list`.
 *
 * @param bot The bot instance.
 * @param interaction The originating interaction (slash command or button).
 * @param guild The guild.
 * @param guildConfig The guild config.
 * @param qotd The QOTD doc to post.
 * @param channelOverrideId Optional channel id to pre-select instead of the configured one.
 */
async function showQotdPostModalAndPost(
  bot: Bot,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guild: Guild,
  guildConfig: GuildsConfig,
  qotd: qotds,
  channelOverrideId: string | null,
) {
  const defaultChannelId = channelOverrideId ?? guildConfig.qotdChannel ?? null;

  const salt = Math.floor(Math.random() * 1e6);
  const modalCustomId = QOTD_POST_MODAL_ID + salt;
  await interaction.showModal(
    getQotdPostModal(modalCustomId, qotd, defaultChannelId),
  );

  const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId;
  let submit: ModalSubmitInteraction;
  try {
    submit = await interaction.awaitModalSubmit({
      filter,
      time: MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) {
      return;
    }
    throw err;
  }

  await submit.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const selectedChannelId = submit.fields
      .getSelectedChannels(CHANNEL_FIELD_ID, true)
      .map((c) => c.id)[0];
    const editedQuestion = submit.fields.getTextInputValue(QUESTION_FIELD_ID);

    const fetchedChannel = await bot.channels.fetch(selectedChannelId);
    if (
      !fetchedChannel ||
      fetchedChannel.isDMBased() ||
      !fetchedChannel.isTextBased()
    ) {
      await submit.editReply("Selected channel is not a postable text channel.");
      return;
    }

    const pingRoleId = guildConfig.qotdPingRole ?? "Not set";
    const message = await postQotd(
      bot,
      fetchedChannel as TextChannel,
      qotd,
      editedQuestion,
      pingRoleId,
    );

    const questionEdited = editedQuestion.trim() !== qotd.question.trim();
    const channelChanged =
      !!guildConfig.qotdChannel && selectedChannelId !== guildConfig.qotdChannel;
    const notes: string[] = [];
    if (questionEdited) notes.push("question was edited");
    if (channelChanged) notes.push("channel differs from default");
    const noteSuffix = notes.length > 0 ? ` *(${notes.join("; ")})*` : "";

    await submit.editReply(`QOTD posted: ${message.url}${noteSuffix}`);
  } catch (err) {
    await submit.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > qotd > post > modal",
      err,
      interaction.guild?.name,
      undefined,
      submit,
    );
  }
  void guild;
}

/**
 * Posts a QOTD with the given ID, in the given channel.
 * If the ID is not given, selects a random QOTD to post.
 * Always opens a confirmation modal pre-filled with the question + channel.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handlePost: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: "Sorry, this command is restricted for staff use only!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.guild || !guildConfig) return;

    const id = interaction.options.getString("id", false);
    const channelOverride =
      interaction.options.getChannel<ChannelType.GuildText>("channel");

    const qotd = await resolveQotd(bot, id);
    if (!qotd) {
      await interaction.reply({
        content: id
          ? "No QOTD available with given ID!"
          : "There are no available QOTDs to post!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await showQotdPostModalAndPost(
      bot,
      interaction,
      interaction.guild,
      guildConfig,
      qotd,
      channelOverride?.id ?? null,
    );
  } catch (err) {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Something went wrong! Please try again later",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "Something went wrong! Please try again later",
        flags: MessageFlags.Ephemeral,
      });
    }
    await errorHandler(
      bot,
      "commands > qotd > post",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handlePost, resolveQotd, showQotdPostModalAndPost };
