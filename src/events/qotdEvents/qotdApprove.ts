import { Bot, Event } from "../../models";
import { logger } from "../../utils/logHandler";

interface QotdApproveEventDto {
  question: string;
  serverId: string;
  userId: string;
}

export const qotdApprove: Event = {
  name: "qotdApprove",
  run: async (bot: Bot, dto: QotdApproveEventDto) => {
    try {
      logger.debug(`qotdApprove event fired: ${JSON.stringify(dto)}`);
      await bot.db.qotds.create({
        data: {
          question: dto.question,
          status: "Approved",
          serverId: dto.serverId,
          userId: dto.userId,
          suggestedOn: new Date(),
        },
      });
    } catch (err) {
      logger.error(err, "Error while handling qotdApprove event");
    }
  },
};
