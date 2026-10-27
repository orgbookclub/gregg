import { GuildsConfig } from "@prisma/client";
import {
  ButtonInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  ForumChannel,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors, templates, titles } from "../../../config/constants";
import { Bot } from "../../../models";
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import {
  configuredForum,
  createEngineForumThread,
  postEngineAnnouncement,
  withAnnouncementLock,
} from "../announcements";
import { EngineInstallationClient } from "../client";
import { engineThreadTitle } from "../embeds";
import { discordThreadIds } from "../links";
import { engineStatusLabel } from "../mappings";
import { canEditFromCard, planCardEdit } from "../staffActions";
import { EngineEventDetail } from "../types";

import {
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";
import { awaitModal, eventCard, failSubmit, setThreadLinks } from "./staff";

const STATUS_FIELD_ID = "status";
const START_FIELD_ID = "startDate";
const END_FIELD_ID = "endDate";
const THREADS_FIELD_ID = "threads";
const FORUM_FIELD_ID = "forum";
const TITLE_FIELD_ID = "title";
const CHANNEL_FIELD_ID = "channel";
const THREAD_STATUSES = ["approved", "announced", "ongoing"];

type CardAction = "edit" | "thread" | "announce";

interface CardContext {
  client: EngineInstallationClient;
  event: EngineEventDetail;
  guildConfig: GuildsConfig | null | undefined;
}

function modalId(action: CardAction): string {
  return `engineCard-${action}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Loads the event behind a card button as the clicking member. Replies and
 * returns null when the guild isn't linked or the engine refuses.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction.
 * @param prefix The button's custom-id prefix.
 * @returns The context, or null after replying.
 */
async function loadCard(
  bot: Bot,
  interaction: ButtonInteraction,
  prefix: string,
): Promise<CardContext | null> {
  if (!interaction.guildId) {
    await replyOrEdit(interaction, errors.GuildOnlyActionError);
    return null;
  }
  const client = await requireInstallation(bot, interaction);
  if (!client) return null;
  try {
    const [event, guildConfig] = await Promise.all([
      client.getEvent(
        interaction.customId.slice(prefix.length),
        interactionActor(interaction),
      ),
      getGuildConfigFromDb(bot, interaction.guildId),
    ]);
    return { client, event, guildConfig };
  } catch (error) {
    const message = engineErrorMessage(error);
    if (!message) throw error;
    await replyOrEdit(interaction, message);
    return null;
  }
}

async function resolvableThreadIds(
  bot: Bot,
  event: EngineEventDetail,
): Promise<string[]> {
  const ids = await Promise.all(
    discordThreadIds(event.externalLinks).map(async (id) =>
      (await bot.channels.fetch(id).catch(() => null)) ? id : null,
    ),
  );
  return ids.filter((id): id is string => id !== null);
}

function buildEditModal(
  customId: string,
  event: EngineEventDetail,
  shownThreadIds: string[],
) {
  const statuses = [
    event.status,
    ...event.allowedTransitions.filter((status) => status !== event.status),
  ];
  const statusSelect = new StringSelectMenuBuilder()
    .setCustomId(STATUS_FIELD_ID)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      statuses.map((status) => ({
        label: engineStatusLabel(status),
        value: status,
        default: status === event.status,
      })),
    );
  const dateInput = (id: string, value: string) =>
    new TextInputBuilder()
      .setCustomId(id)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("YYYY-MM-DD")
      .setMinLength(10)
      .setMaxLength(10)
      .setValue(value);
  const threadsSelect = new ChannelSelectMenuBuilder()
    .setCustomId(THREADS_FIELD_ID)
    .setChannelTypes(
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    )
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(10);
  if (shownThreadIds.length > 0) {
    threadsSelect.setDefaultChannels(...shownThreadIds);
  }
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(titles.EditEvent);
  const hidden =
    discordThreadIds(event.externalLinks).length - shownThreadIds.length;
  if (hidden > 0) {
    modal.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⚠️ ${hidden} linked thread(s) could not be found and aren't shown below. They are kept unless you change the thread selection.`,
      ),
    );
  }
  return modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Status")
      .setStringSelectMenuComponent(statusSelect),
    new LabelBuilder()
      .setLabel("Start date")
      .setTextInputComponent(dateInput(START_FIELD_ID, event.startDate)),
    new LabelBuilder()
      .setLabel("End date")
      .setTextInputComponent(dateInput(END_FIELD_ID, event.endDate)),
    new LabelBuilder()
      .setLabel("Threads")
      .setChannelSelectMenuComponent(threadsSelect),
  );
}

async function handleCardEdit(bot: Bot, interaction: ButtonInteraction) {
  const ctx = await loadCard(bot, interaction, "evt-edit-");
  if (!ctx) return;
  const { client, event } = ctx;
  if (!canEditFromCard(event)) {
    await replyOrEdit(interaction, errors.StaffRestrictionError);
    return;
  }
  const shownThreadIds = await resolvableThreadIds(bot, event);
  const customId = modalId("edit");
  await interaction.showModal(buildEditModal(customId, event, shownThreadIds));
  const submit = await awaitModal(interaction, customId);
  if (!submit) return;
  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const plan = planCardEdit(event, shownThreadIds, {
      status: submit.fields.getStringSelectValues(STATUS_FIELD_ID)[0] ?? "",
      startDate: submit.fields.getTextInputValue(START_FIELD_ID),
      endDate: submit.fields.getTextInputValue(END_FIELD_ID),
      threadIds:
        submit.fields
          .getSelectedChannels(THREADS_FIELD_ID, false)
          ?.map((channel) => channel.id) ?? [],
    });
    if (plan.kind === "error") {
      await submit.editReply(plan.message);
      return;
    }
    const actor = interactionActor(submit);
    const patched = plan.patch
      ? await client.updateEvent(event.id, plan.patch, actor)
      : event;
    if (plan.threadIds) {
      await setThreadLinks(bot, client, patched, plan.threadIds);
    }
    if (plan.transition) {
      await client.transition(
        event.id,
        plan.transition,
        actor,
        `Edited from Discord by ${submit.user.username}`,
      );
    }
    const card = await eventCard(
      client,
      event.id,
      actor,
      interaction.guild?.iconURL(),
    );
    await submit.editReply({
      content: templates.eventUpdated(event.id),
      embeds: card.embeds,
      components: card.components,
    });
  } catch (err) {
    await failSubmit(bot, submit, "events > edit (engine) > card", err);
  }
}

async function handleCardThread(bot: Bot, interaction: ButtonInteraction) {
  const ctx = await loadCard(bot, interaction, "evt-thread-");
  if (!ctx) return;
  const { client, event, guildConfig } = ctx;
  if (!event.permissions.canSetLinks) {
    await replyOrEdit(interaction, errors.StaffRestrictionError);
    return;
  }
  if (!THREAD_STATUSES.includes(event.status)) {
    await replyOrEdit(
      interaction,
      "Threads can only be created for approved, announced or ongoing events.",
    );
    return;
  }
  const defaultForum = await configuredForum(bot, event.type.key, guildConfig);
  const forumSelect = new ChannelSelectMenuBuilder()
    .setCustomId(FORUM_FIELD_ID)
    .setChannelTypes(ChannelType.GuildForum)
    .setMinValues(1)
    .setMaxValues(1);
  if (defaultForum) forumSelect.setDefaultChannels(defaultForum.id);
  const customId = modalId("thread");
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(customId)
      .setTitle("Create Thread")
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Event ID:** \`${event.id}\``),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Forum")
          .setChannelSelectMenuComponent(forumSelect),
        new LabelBuilder()
          .setLabel("Thread title")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(TITLE_FIELD_ID)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(100)
              .setValue(engineThreadTitle(event).slice(0, 100)),
          ),
      ),
  );
  const submit = await awaitModal(interaction, customId);
  if (!submit) return;
  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const forum = submit.fields
      .getSelectedChannels(FORUM_FIELD_ID, false)
      ?.first();
    if (!forum || forum.type !== ChannelType.GuildForum) {
      await submit.editReply(errors.ChannelNotForumError);
      return;
    }
    const resolvedForum = await bot.channels.fetch(forum.id);
    if (resolvedForum?.type !== ChannelType.GuildForum) {
      await submit.editReply(errors.ChannelNotForumError);
      return;
    }
    const threadId = await createEngineForumThread(
      bot,
      client,
      event,
      resolvedForum as ForumChannel,
      submit.fields.getTextInputValue(TITLE_FIELD_ID).trim(),
    );
    await submit.editReply(templates.threadCreated(threadId, event.id));
  } catch (err) {
    await failSubmit(bot, submit, "events > createThread (engine) > card", err);
  }
}

async function handleCardAnnounce(bot: Bot, interaction: ButtonInteraction) {
  const ctx = await loadCard(bot, interaction, "evt-announce-");
  if (!ctx) return;
  const { client, event, guildConfig } = ctx;
  if (!event.allowedTransitions.includes("announced")) {
    await replyOrEdit(
      interaction,
      event.status === "approved"
        ? errors.StaffRestrictionError
        : templates.mustBeInState("Approved", "be announced"),
    );
    return;
  }
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(CHANNEL_FIELD_ID)
    .setChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);
  if (guildConfig?.eventAnnouncementChannel) {
    channelSelect.setDefaultChannels(guildConfig.eventAnnouncementChannel);
  }
  const customId = modalId("announce");
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(customId)
      .setTitle(titles.AnnounceEvent)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Event ID:** \`${event.id}\``),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Announcement channel")
          .setChannelSelectMenuComponent(channelSelect),
      ),
  );
  const submit = await awaitModal(interaction, customId);
  if (!submit) return;
  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const selected = submit.fields
      .getSelectedChannels(CHANNEL_FIELD_ID, false)
      ?.first();
    const channel = selected
      ? await bot.channels.fetch(selected.id).catch(() => null)
      : null;
    if (!channel?.isSendable()) {
      await submit.editReply(errors.AnnouncementChannelInvalidError);
      return;
    }
    const message = await withAnnouncementLock(event.id, async () => {
      const announced = await client.transition(
        event.id,
        "announced",
        interactionActor(submit),
      );
      return await postEngineAnnouncement(
        bot,
        client,
        announced,
        channel,
        guildConfig,
        interaction.guild?.iconURL(),
      );
    });
    await submit.editReply(
      `Announced event \`${event.id}\` in ${message.url} and marked it **Announced**.`,
    );
  } catch (err) {
    await failSubmit(bot, submit, "events > announce (engine) > card", err);
  }
}

/**
 * Handles the Edit, Create Thread and Announce buttons on an event card on
 * the engine backend. Permissions come from the engine (the clicking member
 * is the actor).
 *
 * @param bot The bot instance.
 * @param interaction The button interaction.
 * @returns True when the button was one of the card buttons.
 */
export async function handleEngineCardButton(
  bot: Bot,
  interaction: ButtonInteraction,
): Promise<boolean> {
  const id = interaction.customId;
  if (id.startsWith("evt-edit-")) {
    await handleCardEdit(bot, interaction);
  } else if (id.startsWith("evt-thread-")) {
    await handleCardThread(bot, interaction);
  } else if (id.startsWith("evt-announce-")) {
    await handleCardAnnounce(bot, interaction);
  } else {
    return false;
  }
  return true;
}
