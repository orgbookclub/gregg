import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
  MessageCreateOptions,
  MessageFlags,
} from "discord.js";

import { chunkForDiscordMessage } from "../../utils/discordChunking";

import { AgentResult } from "./types";

type LegacyRow = ActionRowBuilder<MessageActionRowComponentBuilder>;

function partitionComponents(result: AgentResult): {
  legacy: LegacyRow[];
  cv2: ContainerBuilder[];
} {
  const legacy: LegacyRow[] = [];
  const cv2: ContainerBuilder[] = [];
  for (const component of result.components ?? []) {
    if (component instanceof ContainerBuilder) {
      cv2.push(component);
    } else {
      legacy.push(component);
    }
  }
  return { legacy, cv2 };
}

function buildPayloads(result: AgentResult): MessageCreateOptions[] {
  const payloads: MessageCreateOptions[] = [];
  const { legacy, cv2 } = partitionComponents(result);
  const hasEmbeds = (result.embeds?.length ?? 0) > 0;
  const hasAttachments = (result.attachments?.length ?? 0) > 0;
  const hasLegacyArtifacts = hasEmbeds || legacy.length > 0 || hasAttachments;
  const textChunks = result.text ? chunkForDiscordMessage(result.text) : [];
  if (textChunks.length === 0 && hasLegacyArtifacts) {
    payloads.push({
      embeds: result.embeds,
      components: legacy.length > 0 ? legacy : undefined,
      files: result.attachments,
      allowedMentions: { parse: [] },
    });
  } else if (textChunks.length > 0) {
    const lastIdx = textChunks.length - 1;
    for (let i = 0; i < textChunks.length; i++) {
      const isLast = i === lastIdx;
      payloads.push({
        content: textChunks[i],
        embeds: isLast && hasEmbeds ? result.embeds : undefined,
        components: isLast && legacy.length > 0 ? legacy : undefined,
        files: isLast && hasAttachments ? result.attachments : undefined,
        allowedMentions: { parse: [] },
      });
    }
  }
  if (cv2.length > 0) {
    payloads.push({
      flags: MessageFlags.IsComponentsV2,
      components: cv2,
      allowedMentions: { parse: [] },
    });
  }
  if (payloads.length === 0) {
    payloads.push({
      content: "(Gregg returned an empty response.)",
      allowedMentions: { parse: [] },
    });
  }
  return payloads;
}

/**
 * Posts an AgentResult as one or more replies/follow-ups to the message
 * that triggered the agent. Splits the result into delivery payloads so
 * legacy artifacts (text, embeds, ActionRow components, attachments) are
 * sent first and any ComponentsV2 containers follow in their own
 * message — Discord rejects mixing IsComponentsV2 with content or
 * embeds in a single payload. Long text is chunked via
 * chunkForDiscordMessage. The first payload uses message.reply
 * (preserving the conversation thread); follow-ups use channel.send to
 * avoid spam-pinging the original author. Mass mentions are suppressed
 * at the API boundary regardless of what the agent emitted.
 *
 * @param message The triggering Discord message.
 * @param result The agent's result to deliver.
 */
async function deliverToMessage(
  message: Message,
  result: AgentResult,
): Promise<void> {
  if (!message.channel.isSendable()) return;
  const payloads = buildPayloads(result);
  for (let i = 0; i < payloads.length; i++) {
    if (i === 0) {
      await message.reply(payloads[i]);
      continue;
    }
    if (!message.channel.isSendable()) return;
    await message.channel.send(payloads[i]);
  }
}

/**
 * Posts an AgentResult to a deferred ChatInputCommandInteraction. The
 * first non-ComponentsV2 payload edits the deferred reply (replacing
 * the "Loading..." state); any additional payloads — including the
 * separate CV2 container — go out as follow-ups. If every payload is
 * CV2 (interaction.editReply can't carry the IsComponentsV2 flag),
 * the deferred reply is deleted and all payloads land as follow-ups.
 * The caller is responsible for having called interaction.deferReply
 * before invoking the agent.
 *
 * @param interaction The deferred slash command interaction.
 * @param result The agent's result to deliver.
 */
async function deliverToInteraction(
  interaction: ChatInputCommandInteraction,
  result: AgentResult,
): Promise<void> {
  const payloads = buildPayloads(result);
  let editedDeferred = false;
  for (const payload of payloads) {
    const isCv2 = ((payload.flags as number) ?? 0) !== 0;
    if (!editedDeferred && !isCv2) {
      const editable: InteractionEditReplyOptions = {
        content: payload.content ?? null,
        embeds: payload.embeds ?? [],
        components: payload.components ?? [],
        files: payload.files ?? [],
        allowedMentions: payload.allowedMentions,
      };
      await interaction.editReply(editable);
      editedDeferred = true;
      continue;
    }
    await interaction.followUp(payload as unknown as InteractionReplyOptions);
  }
  if (!editedDeferred) {
    await interaction.deleteReply().catch(() => undefined);
  }
}

export { deliverToInteraction, deliverToMessage };
