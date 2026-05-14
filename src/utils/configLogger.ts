import { Colors, EmbedBuilder, User, userMention } from "discord.js";

import { titles } from "../config/constants";

import { logToWebhook } from "./logHandler";

/**
 * One field-level change to the guild config, formatted for the audit
 * log webhook. `oldValue` and `newValue` should be human-readable strings;
 * use sentinel values like `(none)` or `(removed)` for absent state.
 */
export type ConfigChange = {
  field: string;
  oldValue: string;
  newValue: string;
};

/**
 * Posts a guild-config change to the audit log webhook, if one is
 * configured. No-op when the webhook URL is empty or no changes were
 * made — callers don't need to guard.
 *
 * @param webhookUrl The guild's `logWebhookUrl` (may be empty).
 * @param changedBy The user who made the change.
 * @param changes The list of field-level diffs to record.
 */
export async function logConfigChange(
  webhookUrl: string,
  changedBy: User,
  changes: ConfigChange[],
): Promise<void> {
  if (!webhookUrl || changes.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(titles.GuildConfigUpdate)
    .setDescription(`${userMention(changedBy.id)} updated the guild config`)
    .addFields(
      changes.map((c) => ({
        name: c.field,
        value: `\`${c.oldValue}\` → \`${c.newValue}\``,
      })),
    )
    .setTimestamp();

  await logToWebhook({ embeds: [embed] }, webhookUrl);
}
