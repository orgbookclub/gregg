import { baseInstructions } from "./base";
import { generalInstructions } from "./general";

/**
 * Identifies which task-specific prompt variant the agent should
 * load on top of the base persona. Today only "general" exists; the
 * leader-assist follow-up will add a "leaderAssist" variant that
 * swaps in a different task section. Callers (mention listener,
 * slash command handlers) pick the variant per call.
 */
export type PromptVariant = "general";

/**
 * Composes the instructions field sent to the Responses API. Base
 * persona/policy first, then the requested task variant. Foundry
 * requires the field to be present on every call that uses hosted
 * tools — see the Phase 0 spike findings — so the caller never
 * passes an empty string. The variant→prompt table is exhaustive
 * over `PromptVariant`, so adding a variant to the union forces a
 * compile-time addition here.
 *
 * @param variant Which task-specific prompt section to append. Defaults to "general".
 * @returns The composed instructions string.
 */
export function buildInstructions(variant: PromptVariant = "general"): string {
  const variantPrompts = {
    general: generalInstructions,
  } satisfies Record<PromptVariant, string>;
  return `${baseInstructions}\n\n${variantPrompts[variant]}`;
}
