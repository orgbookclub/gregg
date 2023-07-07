import { Events, MessageReaction, PartialMessageReaction } from "discord.js";

import { Bot, Event } from "../../models";

export const reactionAdd: Event = {
  name: Events.MessageReactionAdd,
  // eslint-disable-next-line require-await
  run: async (
    _bot: Bot,
    _reaction: MessageReaction | PartialMessageReaction,
  ) => {
    // const { emoji, message, count } = reaction;
    // const { guild } = message;
    // const { name, identifier, id } = emoji;
    // if (!guild) {
    //   return;
    // }
    // TODO: Here we can watch for reactions in the BR Request channel,
    // and take action on requests accordingly
    // e.g. approve a BR if it has required number of votes
  },
};
