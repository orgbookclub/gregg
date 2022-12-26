/* eslint-disable jsdoc/no-undefined-types */
import { ButtonBuilder } from "@discordjs/builders";
import {
  ActionRowBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  Message,
  StringSelectMenuBuilder,
  WebhookEditMessageOptions,
} from "discord.js";

import { Bot } from "../interfaces/Bot";

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
  readonly customEmbedBuilder: (
    values: T[],
    bot: Bot,
    interaction: ChatInputCommandInteraction,
  ) => EmbedBuilder;

  /**
   * Initializes an instance of Pagination Manager.
   *
   * @param {number} pageSize The max items on each page.
   * @param {T} data An array of objects.
   * @param {Bot} bot The Bot instance.
   * @param {(values: T[], bot: Bot, interaction: ChatInputCommandInteraction) => EmbedBuilder} embedBuilder A function which returns an embed for the given data type.
   */
  constructor(
    pageSize: number,
    data: T[],
    bot: Bot,
    embedBuilder: (
      values: T[],
      b: Bot,
      int: ChatInputCommandInteraction,
    ) => EmbedBuilder,
  ) {
    this.currPageNum = 1;
    this.pageSize = pageSize;
    this.bot = bot;
    this.data = data;
    this.customEmbedBuilder = embedBuilder;
    this.totalPageNum = Math.ceil(data.length / pageSize);
  }

  /**
   * Creates the Button Action Row and SelectMenuAction Row for a page.
   *
   * @returns {{selectMenuActionRow: ActionRowBuilder<StringSelectMenuBuilder>, buttonActionRow: ActionRowBuilder<ButtonBuilder>}} The Action rows.
   */
  createMessageComponentsForPage(): {
    selectMenuActionRow: ActionRowBuilder<StringSelectMenuBuilder>;
    buttonActionRow: ActionRowBuilder<ButtonBuilder>;
  } {
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
   * @returns {T[]} An array of objects.
   */
  private getPageData(): T[] {
    return this.data.slice(
      (this.currPageNum - 1) * this.pageSize,
      this.currPageNum * this.pageSize,
    );
  }

  /**
   * Creates the message payload for a page.
   *
   * @param {ChatInputCommandInteraction} interaction The interaction instance.
   * @returns {WebhookEditMessageOptions} The message payload.
   */
  createMessagePayloadForPage(
    interaction: ChatInputCommandInteraction,
  ): WebhookEditMessageOptions {
    const { selectMenuActionRow, buttonActionRow } =
      this.createMessageComponentsForPage();
    const pageData = this.getPageData();
    const embed = this.customEmbedBuilder(pageData, this.bot, interaction);
    return {
      content: `Page ${this.currPageNum} out of ${this.totalPageNum}`,
      embeds: [embed],
      components: [selectMenuActionRow, buttonActionRow],
    };
  }

  /**
   * Initializes the collectors for the message components.
   *
   * @param {Message} message The message instance.
   * @param {ChatInputCommandInteraction} interaction The interaction instance.
   * @param {number} duration The duration for which the collector watches for interactions (in milliseconds).
   */
  createCollectors(
    message: Message,
    interaction: ChatInputCommandInteraction,
    duration: number,
  ) {
    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: duration,
    });
    const selectMenuCollector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: duration,
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
      console.log(`Collected ${collected.size} interactions.`);
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
      console.log(`Collected ${collected.size} interactions.`);
    });
  }
}
