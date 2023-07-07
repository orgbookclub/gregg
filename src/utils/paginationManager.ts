import { ButtonBuilder } from "@discordjs/builders";
import {
  ActionRowBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  Message,
  StringSelectMenuBuilder,
} from "discord.js";

import { Bot } from "../models";

import { logger } from "./logHandler";

/**
 * Handles all pagination related for a given array of data.
 * Creates embeds, action rows etc. And updates them through collectors.
 */
export class PaginationManager<T> {
  readonly backId = "back";
  readonly forwardId = "forward";
  readonly selectId = "selectPage";
  readonly pageSize: number;
  currPageNum: number;
  readonly totalPageNum: number;
  readonly data: T[];
  readonly bot: Bot;
  readonly embedTitle: string;
  readonly customEmbedBuilder: (
    title: string,
    values: T[],
    interaction: ChatInputCommandInteraction,
  ) => EmbedBuilder;

  /**
   * Initializes an instance of Pagination Manager.
   *
   * @param pageSize The max items on each page.
   * @param objectList An array of objects.
   * @param bot The Bot instance.
   * @param embedBuilderFunction A function which returns an embed for the given data type.
   * @param embedTitle The title of the embed.
   */
  constructor(
    pageSize: number,
    objectList: T[],
    bot: Bot,
    embedBuilderFunction: (
      title: string,
      values: T[],
      int: ChatInputCommandInteraction,
    ) => EmbedBuilder,
    embedTitle = "Events",
  ) {
    this.currPageNum = 1;
    this.pageSize = pageSize;
    this.bot = bot;
    this.data = objectList;
    this.customEmbedBuilder = embedBuilderFunction;
    this.totalPageNum = Math.ceil(objectList.length / pageSize);
    this.embedTitle = embedTitle;
  }

  /**
   * Creates the Button Action Row and SelectMenuAction Row for a page.
   *
   * @returns The Action rows.
   */
  createMessageComponentsForPage() {
    const backButton = new ButtonBuilder()
      .setEmoji({ name: "◀️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.backId)
      .setDisabled(this.currPageNum === 1);
    const forwardButton = new ButtonBuilder()
      .setEmoji({ name: "▶️" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(this.forwardId)
      .setDisabled(this.currPageNum === this.totalPageNum);
    const selectMenu = new StringSelectMenuBuilder()
      .setPlaceholder(`On Page ${this.currPageNum}`)
      .setCustomId(this.selectId);
    const pageGap = Math.ceil(this.totalPageNum / 10);

    for (let i = 1; i <= this.totalPageNum; i += pageGap) {
      selectMenu.addOptions({ label: `Page ${i}`, value: `${i}` });
    }

    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      backButton,
      forwardButton,
    );
    const selectMenuActionRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    return { selectMenuActionRow, buttonActionRow };
  }

  /**
   * Returns the page data.
   *
   * @returns An array of objects.
   */
  private getPageData() {
    return this.data.slice(
      (this.currPageNum - 1) * this.pageSize,
      this.currPageNum * this.pageSize,
    );
  }

  /**
   * Creates the message payload for a page.
   *
   * @param interaction The interaction instance.
   * @param disableComponents Boolean indicating if message components should be shown. Useful when collector has timed out.
   * @returns The message payload.
   */
  createMessagePayloadForPage(
    interaction: ChatInputCommandInteraction,
    disableComponents = false,
  ) {
    const { selectMenuActionRow, buttonActionRow } =
      this.createMessageComponentsForPage();
    const pageData = this.getPageData();
    const embed = this.customEmbedBuilder(
      this.embedTitle,
      pageData,
      interaction,
    );

    return {
      content: `Page ${this.currPageNum} out of ${this.totalPageNum}`,
      embeds: [embed],
      components: disableComponents
        ? []
        : [selectMenuActionRow, buttonActionRow],
    };
  }

  /**
   * Initializes the collectors for the message components.
   *
   * @param message The message instance.
   * @param interaction The interaction instance.
   * @param duration The duration for which the collector watches for interactions (in milliseconds).
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
      if (i.user.id === interaction.user.id) {
        if (i.customId === this.backId) {
          this.currPageNum -= 1;
        } else if (i.customId === this.forwardId) {
          this.currPageNum += 1;
        }
        await i.update(this.createMessagePayloadForPage(interaction));
      } else {
        await i.reply({
          content: `These buttons aren't for you!`,
          ephemeral: true,
        });
      }
    });

    buttonCollector.on("end", (collected) => {
      logger.debug(
        `Collected ${collected.size} interactions on button collector on message ${buttonCollector.messageId}`,
      );
      const payload = this.createMessagePayloadForPage(interaction, true);
      message.edit(payload);
    });

    const selectMenuCollector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      idle: duration,
    });

    selectMenuCollector.on("collect", async (i) => {
      if (i.user.id === interaction.user.id) {
        if (i.customId === this.selectId) {
          this.currPageNum = parseInt(i.values[0]);
        }
        await i.update(this.createMessagePayloadForPage(interaction));
      } else {
        await i.reply({
          content: `This menu isn't for you!`,
          ephemeral: true,
        });
      }
    });

    selectMenuCollector.on("end", (collected) => {
      logger.debug(
        `Collected ${collected.size} interactions on select menu collector on message ${selectMenuCollector.messageId}`,
      );
    });
  }
}
