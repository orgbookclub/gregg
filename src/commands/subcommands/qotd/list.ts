import { qotds } from "@prisma/client";
import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  GuildMember,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  time,
  userMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { errorHandler } from "../../../utils/errorHandler";
import { PaginationManagerV2 } from "../../../utils/paginationManagerV2";
import { hasRole } from "../../../utils/userUtils";

/**
 * Lists the available qotds.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleList: CommandHandler = async (bot, interaction, guildConfig) => {
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

    await interaction.deferReply();
    const approvedQotdList: qotds[] = await bot.db.qotds.findMany({
      where: {
        status: QotdSuggestionStatus.Approved,
      },
    });
    if (approvedQotdList.length === 0) {
      await interaction.editReply(errors.NoQotdsAvailableError);
      return;
    }
    const pageSize = 7;
    const pagedContentManager = new PaginationManagerV2<qotds>(
      pageSize,
      approvedQotdList,
      bot,
      getQotdListContainer,
      `Available QOTDs`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > qotd > list",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function getQotdListContainer(
  title: string,
  qotdList: qotds[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
) {
  const container = new ContainerBuilder().setAccentColor(Colors.Blurple);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  qotdList.forEach((doc) => {
    const lines = [
      `### ${doc.question}`,
      `> by ${userMention(doc.userId)} · ${time(doc.createdOn)}`,
      `> ID: \`${doc.id}\``,
    ];

    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join("\n")),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`qotd-post-${doc.id}`)
          .setLabel("Post")
          .setEmoji({ name: "📢" })
          .setStyle(ButtonStyle.Primary),
      );

    container.addSectionComponents(section);
  });

  const guildName = interaction.inGuild()
    ? (interaction.guild?.name ?? "Unknown Guild")
    : "";
  const pageStr = `Page ${pageInfo.current} of ${pageInfo.total}`;
  const footerParts = [guildName, pageStr].filter((s) => s.length > 0);
  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footerParts.join(" · ")}`),
    );

  return container;
}

export { handleList };
