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
import { getGuildConfigFromDb } from "../../../utils/dbUtils";
import {
  bookAsSearchResult,
  bookRequestButtonId,
  bookRequestPrefill,
  bookSourceLabel,
  parseBookReference,
} from "../books";
import { EngineInstallationClient } from "../client";
import { EngineBook, EngineBookSearchResult } from "../types";

import { runEngineRequestFlow } from "./commands";
import {
  engineCommand,
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";

function resultLine(result: EngineBookSearchResult, index: number): string {
  const title = result.url ? `[${result.title}](${result.url})` : result.title;
  const authors = result.authors.slice(0, 3).join(", ");
  const year = result.publishedYear ? ` (${result.publishedYear})` : "";
  const where = result.bookId
    ? ` · \`${result.bookId}\``
    : result.source !== "catalog"
      ? ` · ${bookSourceLabel(result.source)}`
      : "";
  return `\`${index + 1}\` ${title}${year}${authors ? ` — *${authors}*` : ""}${where}`;
}

interface ResolvedBook {
  result: EngineBookSearchResult;
  book: EngineBook | null;
}

/**
 * Resolves a `/book` query: a catalogue id, ISBN or book page URL is looked
 * up (imported when new); anything else is the top search hit. Catalogue
 * books carry their full details.
 *
 * @param client The installation client.
 * @param query The query.
 * @returns The book, or null when nothing matches.
 */
async function resolveBook(
  client: EngineInstallationClient,
  query: string,
): Promise<ResolvedBook | null> {
  const reference = parseBookReference(query);
  if (reference) {
    const book =
      reference.kind === "catalog"
        ? await client.getBook(reference.bookId)
        : await client.importBook(reference.ref);
    return { result: bookAsSearchResult(book), book };
  }
  const [result] = await client.searchBooks(query, 1);
  if (!result) return null;
  const book = result.bookId ? await client.getBook(result.bookId) : null;
  return { result: book ? bookAsSearchResult(book) : result, book };
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
    const resolved = await resolveBook(
      client,
      interaction.options.getString("query", true),
    );
    if (!resolved) {
      await interaction.editReply(errors.NoBooksFoundError);
      return;
    }
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: buildEngineBookComponents(resolved.result, resolved.book),
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
    const resolved = await resolveBook(
      client,
      interaction.options.getString("query", true),
    );
    await interaction.editReply(
      resolved?.result.coverUrl
        ? { content: resolved.result.coverUrl }
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
    const resolved = await resolveBook(
      client,
      interaction.options.getString("query", true),
    );
    const url = resolved?.result.url ?? null;
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
 * Builds the `/book info` components for an engine book: details with the
 * cover, plus a "Request Buddy Read" button for catalogue books and books
 * found at a book source.
 *
 * @param result The book.
 * @param book The catalogue book's details, when it is in the catalogue.
 * @returns The message components.
 */
export function buildEngineBookComponents(
  result: EngineBookSearchResult,
  book: EngineBook | null,
) {
  const url = result.url;
  const lines = [`### ${url ? `[${result.title}](${url})` : result.title}`];
  if (result.authors.length > 0) {
    lines.push(`-# by ${result.authors.slice(0, 3).join(", ")}`);
  }
  if (book?.series) {
    lines.push(
      `-# ${book.series.name}${book.series.position ? ` #${book.series.position}` : ""}`,
    );
  }
  const pageCount = book?.pageCount ?? result.pageCount;
  const meta = [
    pageCount ? `📄 ${pageCount}` : "",
    result.publishedYear ? `🗓️ ${result.publishedYear}` : "",
    result.isbn13 ? `ISBN ${result.isbn13}` : "",
  ].filter((part) => part.length > 0);
  if (meta.length > 0) lines.push(`-# ${meta.join("  •  ")}`);
  if (book && book.genres.length > 0) {
    lines.push(`-# ${book.genres.slice(0, 5).join(", ")}`);
  }
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
  const requestId = bookRequestButtonId(result);
  if (requestId) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(requestId)
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
    const prefill = bookRequestPrefill(interaction.customId);
    await runEngineRequestFlow(
      bot,
      interaction,
      client,
      guildConfig ?? undefined,
      "BuddyRead",
      prefill ?? undefined,
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
