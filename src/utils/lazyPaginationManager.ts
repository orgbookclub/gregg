import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  Message,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

import { errors, labels } from "../config/constants";
import { Bot } from "../models";

import { errorHandler } from "./errorHandler";
import { PageBuilder } from "./paginationManager";

/**
 * Lazy variant of {@link import("./paginationManager").PaginationManager}
 * that fetches data from the backend on demand and caches it page-by-page.
 *
 * Decouples the **API page size** (the chunk we fetch per HTTP call) from
 * the **UI page size** (the slice we render per Discord message). Each
 * fetched API page serves multiple consecutive UI pages, dramatically
 * reducing call count: with `apiPageSize=20` and `uiPageSize=4`, paging
 * through 60 events makes 3 API calls instead of 15.
 *
 * The first API chunk must be supplied to the constructor so the initial
 * render needs no extra round-trip. Subsequent chunks are fetched lazily
 * via `pageProvider` when the user navigates into them.
 */
export class LazyPaginationManager<T> {
  readonly backId = "lazypgback";
  readonly forwardId = "lazypgforward";
  readonly selectId = "lazypgselectPage";
  readonly uiPageSize: number;
  readonly apiPageSize: number;
  readonly uiPagesPerChunk: number;
  readonly total: number;
  readonly totalUiPages: number;
  readonly bot: Bot;
  readonly title: string;
  readonly buildPage: PageBuilder<T>;
  readonly pageProvider: (apiPage: number) => Promise<T[]>;
  currUiPage: number;
  /**
   * Cache of fetched API chunks, keyed by 1-based API page number. Each
   * entry holds an entire API page (up to `apiPageSize` items) which serves
   * `uiPagesPerChunk` consecutive UI pages. Populated by `ensureChunkLoaded`
   * and read by `getUiPageData` to slice the right UI window out of a chunk.
   */
  private readonly chunks: Map<number, T[]>;

  /**
   * Initializes an instance of the lazy Pagination Manager.
   *
   * Throws if `apiPageSize` is not a positive multiple of `uiPageSize`,
   * which would let a UI page span two API chunks.
   *
   * @param uiPageSize The number of items rendered per Discord message.
   * @param apiPageSize The number of items fetched per HTTP call.
   * @param total The total number of items across all pages.
   * @param firstChunk The already-fetched first API page; serves UI pages 1..uiPagesPerChunk.
   * @param bot The Bot instance.
   * @param buildPage A function which returns a ContainerBuilder for the given page slice.
   * @param pageProvider A function which fetches the API chunk for the given 1-based API page number.
   * @param title The title of the page (rendered above the body).
   */
  constructor(
    uiPageSize: number,
    apiPageSize: number,
    total: number,
    firstChunk: T[],
    bot: Bot,
    buildPage: PageBuilder<T>,
    pageProvider: (apiPage: number) => Promise<T[]>,
    title = "Items",
  ) {
    if (uiPageSize <= 0 || apiPageSize <= 0) {
      throw new Error(
        "uiPageSize and apiPageSize must both be positive integers",
      );
    }
    if (apiPageSize % uiPageSize !== 0) {
      throw new Error(
        `apiPageSize (${apiPageSize}) must be a multiple of uiPageSize (${uiPageSize})`,
      );
    }
    this.uiPageSize = uiPageSize;
    this.apiPageSize = apiPageSize;
    this.uiPagesPerChunk = apiPageSize / uiPageSize;
    this.total = total;
    this.bot = bot;
    this.title = title;
    this.buildPage = buildPage;
    this.pageProvider = pageProvider;
    this.totalUiPages = Math.max(1, Math.ceil(total / uiPageSize));
    this.currUiPage = 1;
    this.chunks = new Map([[1, firstChunk]]);
  }

  private getApiPageForUiPage(uiPage: number) {
    return Math.floor((uiPage - 1) / this.uiPagesPerChunk) + 1;
  }

  private getUiPageData(uiPage: number): T[] {
    const apiPage = this.getApiPageForUiPage(uiPage);
    const chunk = this.chunks.get(apiPage) ?? [];
    const offset = ((uiPage - 1) % this.uiPagesPerChunk) * this.uiPageSize;
    return chunk.slice(offset, offset + this.uiPageSize);
  }

  private async ensureChunkLoaded(apiPage: number): Promise<void> {
    if (this.chunks.has(apiPage)) return;
    const data = await this.pageProvider(apiPage);
    this.chunks.set(apiPage, data);
  }

  private buildNavRows(disableComponents: boolean) {
    const backButton = new ButtonBuilder()
      .setLabel(labels.Previous)
      .setEmoji({ name: "◀️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.backId)
      .setDisabled(disableComponents || this.currUiPage === 1);
    const forwardButton = new ButtonBuilder()
      .setLabel(labels.Next)
      .setEmoji({ name: "▶️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.forwardId)
      .setDisabled(disableComponents || this.currUiPage >= this.totalUiPages);
    const selectMenu = new StringSelectMenuBuilder()
      .setPlaceholder(`On Page ${this.currUiPage}`)
      .setCustomId(this.selectId)
      .setDisabled(disableComponents);
    const pageGap = Math.ceil(this.totalUiPages / 10);
    for (let i = 1; i <= this.totalUiPages; i += pageGap) {
      selectMenu.addOptions({ label: `Page ${i}`, value: `${i}` });
    }
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      backButton,
      forwardButton,
    );
    const selectRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    return { buttonRow, selectRow };
  }

  /**
   * Creates the message payload for the current page.
   *
   * @param interaction The interaction instance.
   * @param disableComponents Disables nav components (used when collector ends).
   * @returns The message payload.
   */
  createMessagePayloadForPage(
    interaction: ChatInputCommandInteraction,
    disableComponents = false,
  ) {
    const container = this.buildPage(
      this.title,
      this.getUiPageData(this.currUiPage),
      interaction,
      { current: this.currUiPage, total: this.totalUiPages },
    );

    const { buttonRow, selectRow } = this.buildNavRows(disableComponents);

    return {
      components: [container, selectRow, buttonRow],
      flags: MessageFlags.IsComponentsV2 as const,
    };
  }

  /**
   * Initializes the collectors for the message components.
   *
   * @param message The message instance.
   * @param interaction The interaction instance.
   * @param duration Idle duration in milliseconds.
   */
  createCollectors(
    message: Message,
    interaction: ChatInputCommandInteraction,
    duration: number,
  ) {
    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: duration,
    });

    buttonCollector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: errors.ButtonsNotForYouError,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      let next: number;
      if (i.customId === this.backId) {
        next = Math.max(1, this.currUiPage - 1);
      } else if (i.customId === this.forwardId) {
        next = Math.min(this.totalUiPages, this.currUiPage + 1);
      } else {
        return;
      }
      if (next === this.currUiPage) return;
      await this.navigateTo(next, i, interaction, "buttonClick");
    });

    buttonCollector.on("end", async (_) => {
      const payload = this.createMessagePayloadForPage(interaction, true);
      try {
        await message.edit(payload);
      } catch {
        // Message may have been deleted; ignore.
      }
    });

    const selectCollector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      idle: duration,
    });

    selectCollector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: errors.MenuNotForYouError,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (i.customId !== this.selectId) return;
      const selectedPage = parseInt(i.values[0], 10);
      const next = Math.min(
        this.totalUiPages,
        Math.max(1, Number.isFinite(selectedPage) ? selectedPage : 1),
      );
      if (next === this.currUiPage) {
        await i.deferUpdate();
        return;
      }
      await this.navigateTo(next, i, interaction, "selectMenu");
    });
  }

  private async navigateTo(
    next: number,
    componentInteraction: ButtonInteraction | StringSelectMenuInteraction,
    interaction: ChatInputCommandInteraction,
    source: "buttonClick" | "selectMenu",
  ) {
    const apiPage = this.getApiPageForUiPage(next);
    const cached = this.chunks.has(apiPage);
    try {
      if (cached) {
        this.currUiPage = next;
        await componentInteraction.update(
          this.createMessagePayloadForPage(interaction),
        );
        return;
      }
      await componentInteraction.deferUpdate();
      await this.ensureChunkLoaded(apiPage);
      this.currUiPage = next;
      await componentInteraction.editReply(
        this.createMessagePayloadForPage(interaction),
      );
    } catch (err) {
      await errorHandler(
        this.bot,
        `pagination > ${source}`,
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
      try {
        await interaction.followUp({
          content: errors.SomethingWentWrongError,
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // Best-effort; the original interaction may have already failed.
      }
    }
  }
}
