import {
  DiscordjsError,
  GuildMember,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors, messages } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { ConfigChange, logConfigChange } from "../../../utils/configLogger";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

const MODAL_ID = "configEditFeatures";
const MIN_PARTICIPANT_COUNT_FIELD_ID = "minParticipantCount";
const MODAL_TIMEOUT_MS = 14 * 60 * 1000;
const DEFAULT_MIN_PARTICIPANT_COUNT = 10;

function buildFeaturesModal(customId: string, currentMinParticipants: number) {
  const minParticipantsInput = new TextInputBuilder()
    .setCustomId(MIN_PARTICIPANT_COUNT_FIELD_ID)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("e.g. 10")
    .setMinLength(1)
    .setMaxLength(4)
    .setValue(String(currentMinParticipants));

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Edit Server Features")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Minimum participant count")
        .setDescription(
          "Threshold for the auto-approve / auto-reject Buddy Read jobs.",
        )
        .setTextInputComponent(minParticipantsInput),
    );
}

/**
 * Opens the features modal pre-filled with the guild's current values.
 * On submit, validates inputs, persists changes, and posts a diff to the
 * audit log webhook. Designed to be extended with additional fields
 * (toggles, numbers, URLs) over time.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleEditFeatures: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: errors.StaffRestrictionError,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.guild) {
      await interaction.reply({
        content: errors.SomethingWentWrongError,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    const currentMin =
      guildConfig?.minParticipantCount ?? DEFAULT_MIN_PARTICIPANT_COUNT;

    const salt = Math.floor(Math.random() * 1e6);
    const modalCustomId = `${MODAL_ID}-${salt}`;
    await interaction.showModal(buildFeaturesModal(modalCustomId, currentMin));

    const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId;
    let submit: ModalSubmitInteraction;
    try {
      submit = await interaction.awaitModalSubmit({
        filter,
        time: MODAL_TIMEOUT_MS,
      });
    } catch (err) {
      if (err instanceof DiscordjsError) return;
      throw err;
    }

    await submit.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const minRaw = submit.fields.getTextInputValue(
        MIN_PARTICIPANT_COUNT_FIELD_ID,
      );
      const newMin = Number.parseInt(minRaw, 10);
      if (!Number.isInteger(newMin) || newMin < 1) {
        await submit.editReply(
          "`Minimum participant count` must be a positive integer.",
        );
        return;
      }

      const changes: ConfigChange[] = [];
      if (newMin !== currentMin) {
        changes.push({
          field: "minParticipantCount",
          oldValue: String(currentMin),
          newValue: String(newMin),
        });
      }

      if (changes.length === 0) {
        await submit.editReply("No changes detected.");
        return;
      }

      await bot.db.guilds.upsert({
        where: { guildId: guild.id },
        update: {
          config: {
            ...guildConfig,
            minParticipantCount: newMin,
          },
        },
        create: {
          guildId: guild.id,
          name: guild.name,
          ownerId: guild.ownerId,
          region: guild.preferredLocale,
          createdAt: guild.createdAt,
          joinedAt: guild.joinedAt,
          config: { minParticipantCount: newMin },
        },
      });

      await logConfigChange(
        guildConfig?.logWebhookUrl ?? "",
        submit.user,
        changes,
      );

      await submit.editReply(messages.GuildConfigUpdated);
    } catch (err) {
      await submit.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > config > editFeatures > modal",
        err,
        interaction.guild?.name,
        undefined,
        submit,
      );
    }
  } catch (err) {
    await errorHandler(
      bot,
      "commands > config > editFeatures",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handleEditFeatures };
