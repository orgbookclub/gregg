import { ChannelType, Message } from "discord.js";

import { Bot } from "../../models";
import { errorHandler } from "../../utils/errorHandler";
import { logger } from "../../utils/logHandler";

import { deliverToMessage } from "./deliver";
import { isAllowed } from "./guards";
import { AgentContext, SessionKey } from "./types";

const MAX_RECENT_MESSAGES = 5;
const TYPING_REFRESH_MS = 8_000;

function shouldHandle(bot: Bot, message: Message): boolean {
  if (process.env.AI_ENABLED !== "true") return false;
  if (!bot.ai) return false;
  if (message.author.bot) return false;
  if (!message.guild) return false;
  if (message.channel.type === ChannelType.DM) return false;
  if (!bot.user || !message.mentions.has(bot.user)) return false;
  return true;
}

function stripBotMention(message: Message, botUserId: string): string {
  return message.content
    .replace(new RegExp(`<@!?${botUserId}>`, "g"), "")
    .replace(/\s+/g, " ");
}

function buildSessionKey(message: Message): SessionKey {
  const isThread = message.channel.isThread();
  return {
    guildId: message.guild!.id,
    channelId: message.channel.id,
    isThread,
    userId: message.author.id,
  };
}

async function collectRecentMessages(
  message: Message,
): Promise<AgentContext["recentMessages"]> {
  if (!message.channel.isTextBased() || message.channel.isDMBased()) {
    return [];
  }
  try {
    const recent = await message.channel.messages.fetch({
      limit: MAX_RECENT_MESSAGES + 1,
      before: message.id,
    });
    return recent
      .filter((m) => !m.author.bot && m.content.length > 0)
      .first(MAX_RECENT_MESSAGES)
      .reverse()
      .map((m) => ({
        authorId: m.author.id,
        authorName: m.member?.displayName ?? m.author.username,
        content: m.content,
      }));
  } catch (err) {
    logger.debug(err, "aiMentionHandler: failed to fetch recent messages");
    return [];
  }
}

async function startTyping(message: Message): Promise<void> {
  if (!message.channel.isSendable()) return;
  try {
    await message.channel.sendTyping();
  } catch (err) {
    logger.debug(err, "aiMentionHandler: sendTyping failed (non-fatal)");
  }
}

/**
 * Discord listener handler invoked from the messageCreate event. Decides
 * whether the bot should respond to a given message via the AI agent and
 * — if so — collects context, calls bot.ai.run, and delivers the result.
 *
 * @param bot The bot instance.
 * @param message The triggering message.
 */
async function aiMentionHandler(bot: Bot, message: Message): Promise<void> {
  if (!shouldHandle(bot, message)) return;
  try {
    if (!message.guild || !bot.user) return;
    const member =
      message.member ?? (await message.guild.members.fetch(message.author.id));
    const guildConfig = await bot.db.guilds.findUnique({
      where: { guildId: message.guild.id },
    });
    if (
      !isAllowed(member, {
        staffRoleId: guildConfig?.config?.staffRole ?? "",
        betaRoleId: process.env.AI_BETA_ROLE_ID,
        devBypass: process.env.AI_DEV_BYPASS === "true",
      })
    ) {
      logger.debug(
        `aiMentionHandler: denied for user ${message.author.id} in guild ${message.guild.id}`,
      );
      return;
    }
    const cleanedText = stripBotMention(message, bot.user.id).trim();
    if (!cleanedText) {
      await message.reply(
        "Hi! Mention me with a question and I'll do my best to help.",
      );
      return;
    }
    if (!bot.ai) {
      logger.debug("aiMentionHandler: bot.ai not initialized; skipping");
      return;
    }
    const sessionKey = buildSessionKey(message);
    const context: AgentContext = {
      source: "mention",
      sessionKey,
      member,
      recentMessages: await collectRecentMessages(message),
    };
    await startTyping(message);
    const typingInterval = setInterval(() => {
      void startTyping(message);
    }, TYPING_REFRESH_MS);
    try {
      const result = await bot.ai.run(cleanedText, context);
      await deliverToMessage(message, result);
    } finally {
      clearInterval(typingInterval);
    }
  } catch (err) {
    await errorHandler(
      bot,
      "modules > ai > listener",
      err,
      message.guild?.name,
      message,
    );
  }
}

export { aiMentionHandler };
