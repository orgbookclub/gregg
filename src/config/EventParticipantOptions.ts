export const EventParticipantOptions = [
  { name: "Reader", value: "readers" },
  { name: "Leader", value: "leaders" },
  { name: "Interested", value: "interested" },
] as const;

export type ParticipantType = (typeof EventParticipantOptions)[number]["value"];

/**
 * Type guard for participant type strings sourced from user input.
 *
 * @param value The candidate value to check.
 * @returns True if the value is a known participant type.
 */
export function isParticipantType(
  value: string | undefined,
): value is ParticipantType {
  return EventParticipantOptions.some((opt) => opt.value === value);
}
