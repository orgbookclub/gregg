import { PrismaClient } from "@prisma/client";

import { logger } from "../utils/logHandler";

/**
 * Connects Prisma and mounts it to the bot's instance.
 *
 * @returns The prisma client.
 */
export const connectPrisma = async (): Promise<PrismaClient> => {
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    return prisma;
  } catch (error) {
    logger.error(error, "Error connecting to prisma");
    process.exit(1);
  }
};
