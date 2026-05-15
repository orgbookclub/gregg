import { baseInstructions } from "./base";

/**
 * Composes the instructions field sent to the Responses API. In v1 this
 * is just the base persona/policy prompt; later phases will append a
 * task-specific variant (general / leader-assist) and an
 * auto-generated tools.md.
 *
 * @returns The composed instructions string.
 */
export function buildInstructions(): string {
  return baseInstructions;
}
