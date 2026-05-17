import { GuildMember } from "discord.js";

/**
 * Configuration for the access guard. Identifies which member roles
 * grant the agent and lets dev environments fully bypass the gate.
 */
export interface GuardConfig {
  staffRoleId: string;
  betaRoleId?: string;
  devBypass: boolean;
}

/**
 * Returns true if the given guild member is permitted to invoke the AI
 * agent. Staff and the optional beta role both qualify; AI_DEV_BYPASS
 * lets local development sidestep the gate entirely. A missing member
 * (e.g. DM context) always denies.
 *
 * @param member The guild member to check, if any.
 * @param config The configured role IDs and bypass flag.
 * @returns Whether the member can use the agent.
 */
export function isAllowed(
  member: GuildMember | undefined,
  config: GuardConfig,
): boolean {
  if (config.devBypass) return true;
  if (!member) return false;
  if (config.staffRoleId && member.roles.cache.has(config.staffRoleId)) {
    return true;
  }
  if (config.betaRoleId && member.roles.cache.has(config.betaRoleId)) {
    return true;
  }
  return false;
}

/**
 * Strips mass-mention tokens from text the model will see. Prevents
 * prompt-injection attempts that try to get the bot to re-emit
 * everyone/here pings. Role mentions are also stripped because the
 * bot cannot meaningfully verify them in a stateless guard.
 *
 * @param text Raw user input.
 * @returns Sanitized text safe to send to the model.
 */
export function sanitizeInput(text: string): string {
  return text
    .replace(/@everyone/g, "[everyone]")
    .replace(/@here/g, "[here]")
    .replace(/<@&\d+>/g, "[role]");
}

/**
 * Strips mass-mention tokens from model output before posting to
 * Discord. Belt-and-braces over sanitizeInput in case the model echoes
 * a mention back from its own training data or the prompt slipped past
 * the input filter. Role mentions are stripped because the model can
 * fabricate plausible-looking role IDs that we have no way to validate
 * from this layer.
 *
 * @param text The model's reply text.
 * @returns Sanitized text safe to post.
 */
export function sanitizeOutput(text: string): string {
  return text
    .replace(/@everyone/g, "[everyone]")
    .replace(/@here/g, "[here]")
    .replace(/<@&\d+>/g, "[role]");
}
