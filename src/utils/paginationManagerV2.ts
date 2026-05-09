import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ContainerBuilder,
  Message,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";

import { Bot } from "../models";

/**
 * Builds the body components for a single page of paginated content (V2).
 * Implementations should return one or more top-level components (Section /
 * TextDisplay / Separator / MediaGallery / etc.) that will be inserted into
 * the page Container above the navigation row.
 *
 * The optional `pageInfo` lets the builder render its own footer (e.g.
 * Combine guild name with `Page X of Y`) instead of the manager appending it.
 */
export type V2PageBuilder<T> = (
  title: string,
  values: T[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
) => ContainerBuilder;

/**
 * Components V2 equivalent of @see PaginationManager. Wraps each page in a
 * single Container with the caller-supplied body, then appends pagination
 * controls (page select + prev/next buttons) inside the same container.
 */
export class PaginationManagerV2<T> {
  readonly backId = "v2back";
  readonly forwardId = "v2forward";
  readonly selectId = "v2selectPage";
  readonly pageSize: number;
  currPageNum: number;
  readonly totalPageNum: number;
  readonly data: T[];
  readonly bot: Bot;
  readonly title: string;
  readonly buildPage: V2PageBuilder<T>;

  /**
   * Initializes an instance of the V2 Pagination Manager.
   *
   * @param pageSize The max items on each page.
   * @param objectList An array of objects.
   * @param bot The Bot instance.
   * @param buildPage A function which returns a ContainerBuilder for the given page slice.
   * @param title The title of the page (rendered above the body).
   */
  constructor(
    pageSize: number,
    objectList: T[],
    bot: Bot,
    buildPage: V2PageBuilder<T>,
    title = "Items",
  ) {
    this.currPageNum = 1;
    this.pageSize = pageSize;
    this.bot = bot;
    this.data = objectList;
    this.buildPage = buildPage;
    this.totalPageNum = Math.max(1, Math.ceil(objectList.length / pageSize));
    this.title = title;
  }

  private getPageData() {
    return this.data.slice(
      (this.currPageNum - 1) * this.pageSize,
      this.currPageNum * this.pageSize,
    );
  }

  private buildNavRows(disableComponents: boolean) {
    const backButton = new ButtonBuilder()
      .setLabel("Previous")
      .setEmoji({ name: "◀️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.backId)
      .setDisabled(disableComponents || this.currPageNum === 1);
    const forwardButton = new ButtonBuilder()
      .setLabel("Next")
      .setEmoji({ name: "▶️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.forwardId)
      .setDisabled(disableComponents || this.currPageNum >= this.totalPageNum);
    const selectMenu = new StringSelectMenuBuilder()
      .setPlaceholder(`On Page ${this.currPageNum}`)
      .setCustomId(this.selectId)
      .setDisabled(disableComponents);
    const pageGap = Math.ceil(this.totalPageNum / 10);
    for (let i = 1; i <= this.totalPageNum; i += pageGap) {
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
   * Creates the message payload for a page.
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
      this.getPageData(),
      interaction,
      { current: this.currPageNum, total: this.totalPageNum },
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
          content: `These buttons aren't for you!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (i.customId === this.backId) {
        this.currPageNum = Math.max(1, this.currPageNum - 1);
      } else if (i.customId === this.forwardId) {
        this.currPageNum = Math.min(this.totalPageNum, this.currPageNum + 1);
      } else {
        return;
      }
      await i.update(this.createMessagePayloadForPage(interaction));
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
          content: `This menu isn't for you!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (i.customId === this.selectId) {
        const selectedPage = parseInt(i.values[0], 10);
        this.currPageNum = Math.min(
          this.totalPageNum,
          Math.max(1, selectedPage),
        );
        await i.update(this.createMessagePayloadForPage(interaction));
      }
    });
  }
}
