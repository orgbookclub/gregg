import { CreateBookDto } from "@organizedbookclub/ows-client";
import { GuildMember, MessageFlags } from "discord.js";

import { errors, templates } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { isSupportedBookUrl } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

/**
 * Manually adds a book to the backend library. Staff-gated. Useful for
 * books that are not available on Open Library: once stored, members can
 * request the book with `/events request` using the same URL, and the
 * backend reuses the stored book instead of trying to scrape it.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleAdd: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      !guildConfig ||
      !interaction.member ||
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: errors.StaffRestrictionError,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const title = interaction.options.getString("title", true);
    const url = interaction.options.getString("url", true);
    const authorsInput = interaction.options.getString("authors", true);
    const coverUrl = interaction.options.getString("cover") ?? "";
    const numPages = interaction.options.getInteger("pages") ?? 0;
    const genresInput = interaction.options.getString("genres") ?? "";

    if (!isSupportedBookUrl(url)) {
      await interaction.editReply(errors.UnsupportedBookUrlError);
      return;
    }

    const authors = authorsInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => ({ name, url: "" }));
    const genres = genresInput
      .split(",")
      .map((genre) => genre.trim())
      .filter((genre) => genre.length > 0);

    const createBookDto: CreateBookDto = {
      title,
      authors,
      url,
      genres,
      coverUrl,
      numPages,
    };

    await bot.api.books.booksControllerCreateBookFromDto({ createBookDto });

    await interaction.editReply(templates.bookAdded(title, url));
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 403") {
      await interaction.editReply(errors.BookAlreadyExistsError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > book > add",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

export { handleAdd };
