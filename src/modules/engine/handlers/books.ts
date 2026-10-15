import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  hideLinkEmbed,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

import { errors, labels } from "../../../config/constants";
import { Bot } from "../../../models";
import {
  buildOpenLibraryWorkUrl,
  getOpenLibraryWorkId,
  OPENLIBRARY_BR_BUTTON_PREFIX,
} from "../../../utils/bookUtils";
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import { EngineInstallationClient } from "../client";
import { EngineBookSearchResult } from "../types";

import { runEngineRequestFlow } from "./commands";
import {
  engineCommand,
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";

const ISBN_PATTERN = /^(?:\d[\d-]{8,15}[\dXx])$/;

function resultUrl(result: EngineBookSearchResult): string | null {
  return result.openLibraryWorkId
    ? buildOpenLibraryWorkUrl(result.openLibraryWorkId)
    : null;
}

function resultLine(result: EngineBookSearchResult, index: number): string {
  const url = resultUrl(result);
  const title = url ? `[${result.title}](${url})` : result.title;
  const authors = result.authors.slice(0, 3).join(", ");
  const year = result.publishedYear ? ` (${result.publishedYear})` : "";
  return `\`${index + 1}\` ${title}${year}${authors ? ` — *${authors}*` : ""}`;
}

async function firstResult(
  client: EngineInstallationClient,
  query: string,
): Promise<EngineBookSearchResult | null> {
  const workId = getOpenLibraryWorkId(query);
  const isbn = ISBN_PATTERN.test(query.trim())
    ? query.trim().replace(/-/g, "")
    : null;
  if (workId || isbn) {
    const book = await client.importBook(
      workId ? { openLibraryWorkId: workId } : { isbn: isbn ?? undefined },
    );
    return {
      bookId: book.id,
      source: "catalog",
      openLibraryWorkId: book.openLibraryWorkId,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      publishedYear: book.publishedYear,
      isbn13: book.isbn13,
    };
  }
  const [result] = await client.searchBooks(query, 1);
  return result ?? null;
}

const handleSearch = engineCommand(
  "book > search (engine)",
  async (_bot, interaction, client) => {
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply(
      ephemeral ? { flags: MessageFlags.Ephemeral } : {},
    );
    const query = interaction.options.getString("query", true);
    const limit = interaction.options.getInteger("limit") ?? 5;
    const results = await client.searchBooks(query, limit);
    if (results.length === 0) {
      await interaction.editReply(errors.NoBooksFoundError);
      return;
    }
    const lines = [
      `## Search results for "${query}"`,
      ...results.map(resultLine),
    ];
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join("\n").slice(0, 3900)),
        ),
      ],
    });
  },
);

const handleInfo = engineCommand(
  "book > info (engine)",
  async (_bot, interaction, client) => {
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply(
      ephemeral ? { flags: MessageFlags.Ephemeral } : {},
    );
    const result = await firstResult(
      client,
      interaction.options.getString("query", true),
    );
    if (!result) {
      await interaction.editReply(errors.NoBooksFoundError);
      return;
    }
    const pageCount = result.bookId
      ? (await client.getBook(result.bookId)).pageCount
      : null;
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: buildEngineBookComponents(result, pageCount),
    });
  },
);

const handleCover = engineCommand(
  "book > cover (engine)",
  async (_bot, interaction, client) => {
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply(
      ephemeral ? { flags: MessageFlags.Ephemeral } : {},
    );
    const result = await firstResult(
      client,
      interaction.options.getString("query", true),
    );
    await interaction.editReply(
      result?.coverUrl
        ? { content: result.coverUrl }
        : errors.NoBooksFoundError,
    );
  },
);

const handleLink = engineCommand(
  "book > link (engine)",
  async (_bot, interaction, client) => {
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply(
      ephemeral ? { flags: MessageFlags.Ephemeral } : {},
    );
    const result = await firstResult(
      client,
      interaction.options.getString("query", true),
    );
    const url = result ? resultUrl(result) : null;
    await interaction.editReply(
      url ? { content: hideLinkEmbed(url) } : errors.NoBooksFoundError,
    );
  },
);

const handleAdd = engineCommand(
  "book > add (engine)",
  async (_bot, interaction, client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const club = await client.getClub(interactionActor(interaction));
    if (!club.me?.permissions.includes("events:manage")) {
      await interaction.editReply(errors.StaffRestrictionError);
      return;
    }
    const authors = interaction.options
      .getString("authors", true)
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const cover = interaction.options.getString("cover");
    const pages = interaction.options.getInteger("pages");
    const book = await client.createBook({
      title: interaction.options.getString("title", true).trim(),
      authors,
      ...(cover ? { coverUrl: cover } : {}),
      ...(pages ? { pageCount: pages } : {}),
    });
    await interaction.editReply(
      `Added **${book.title}** to the library! Members can request it with \`/events request\` using the book ID \`${book.id}\`.`,
    );
  },
);

/**
 * Builds the `/book info` components for an engine search result: details
 * with the cover, plus a "Request Buddy Read" button for Open Library books.
 *
 * @param result The book.
 * @param pageCount The page count, when known.
 * @returns The message components.
 */
export function buildEngineBookComponents(
  result: EngineBookSearchResult,
  pageCount: number | null,
) {
  const url = resultUrl(result);
  const lines = [`### ${url ? `[${result.title}](${url})` : result.title}`];
  if (result.authors.length > 0) {
    lines.push(`-# by ${result.authors.slice(0, 3).join(", ")}`);
  }
  const meta = [
    pageCount ? `📄 ${pageCount}` : "",
    result.publishedYear ? `🗓️ ${result.publishedYear}` : "",
    result.isbn13 ? `ISBN ${result.isbn13}` : "",
  ].filter((part) => part.length > 0);
  if (meta.length > 0) lines.push(`-# ${meta.join("  •  ")}`);
  if (result.bookId) lines.push(`-# Book ID: \`${result.bookId}\``);
  const text = new TextDisplayBuilder().setContent(lines.join("\n"));
  const container = new ContainerBuilder();
  if (result.coverUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(result.coverUrl)),
    );
  } else {
    container.addTextDisplayComponents(text);
  }
  const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [
    container,
  ];
  if (result.openLibraryWorkId) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${OPENLIBRARY_BR_BUTTON_PREFIX}${result.openLibraryWorkId}`,
          )
          .setLabel(labels.RequestBuddyRead)
          .setEmoji({ name: "👥" })
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }
  return components;
}

/**
 * Handles the "Request Buddy Read" button on an engine `/book info` card.
 *
 * @param bot The bot instance.
 * @param interaction The button interaction.
 */
export async function handleEngineBookRequestButton(
  bot: Bot,
  interaction: ButtonInteraction,
) {
  const client = await requireInstallation(bot, interaction);
  if (!client || !interaction.guildId) return;
  try {
    const guildConfig = await getGuildConfigFromDb(bot, interaction.guildId);
    const workId = interaction.customId.slice(
      OPENLIBRARY_BR_BUTTON_PREFIX.length,
    );
    await runEngineRequestFlow(
      bot,
      interaction,
      client,
      guildConfig ?? undefined,
      "BuddyRead",
      buildOpenLibraryWorkUrl(workId),
    );
  } catch (err) {
    const message = engineErrorMessage(err);
    if (!message) throw err;
    await replyOrEdit(interaction, message);
  }
}

export const engineBookHandlers = {
  search: handleSearch,
  info: handleInfo,
  cover: handleCover,
  link: handleLink,
  add: handleAdd,
};
