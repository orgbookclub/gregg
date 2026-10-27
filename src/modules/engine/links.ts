import { EngineExternalLink, EngineExternalLinkInput } from "./types";

/**
 * Builds the external link for a Discord thread.
 *
 * @param guildId The guild id.
 * @param thread The thread.
 * @param thread.id The thread id.
 * @param thread.name The thread name.
 * @returns The link input.
 */
export function discordThreadLink(
  guildId: string,
  thread: { id: string; name: string },
): EngineExternalLinkInput {
  return {
    platform: "discord",
    kind: "thread",
    url: `https://discord.com/channels/${guildId}/${thread.id}`,
    externalId: thread.id,
    label: `#${thread.name}`.slice(0, 100),
  };
}

/**
 * Computes the full set of Discord links to PUT after adding a link. The
 * engine replaces only the installation platform's links, so the existing
 * Discord links must be resent. A link with the same `externalId` (or URL)
 * is replaced in place.
 *
 * @param existing The event's current links (all platforms).
 * @param link The Discord link to add.
 * @returns The Discord links to send.
 */
export function withDiscordLink(
  existing: EngineExternalLink[],
  link: EngineExternalLinkInput,
): EngineExternalLinkInput[] {
  const discordLinks: EngineExternalLinkInput[] = existing
    .filter((item) => item.platform === "discord")
    .map((item) => ({
      platform: item.platform,
      kind: item.kind,
      url: item.url,
      externalId: item.externalId,
      label: item.label,
    }));
  const index = discordLinks.findIndex(
    (item) =>
      (link.externalId && item.externalId === link.externalId) ||
      item.url === link.url,
  );
  if (index === -1) {
    discordLinks.push(link);
  } else {
    discordLinks[index] = link;
  }
  return discordLinks;
}

/**
 * Computes the Discord links to PUT when replacing an event's threads. The
 * event's other Discord links (channels, messages, meetings) are kept.
 *
 * @param existing The event's current links (all platforms).
 * @param threads The new thread links.
 * @returns The Discord links to send.
 */
export function replaceDiscordThreads(
  existing: EngineExternalLink[],
  threads: EngineExternalLinkInput[],
): EngineExternalLinkInput[] {
  const kept: EngineExternalLinkInput[] = existing
    .filter((item) => item.platform === "discord" && item.kind !== "thread")
    .map((item) => ({
      platform: item.platform,
      kind: item.kind,
      url: item.url,
      externalId: item.externalId,
      label: item.label,
    }));
  return [...kept, ...threads];
}

/**
 * Returns the Discord thread ids linked to an event.
 *
 * @param links The event's links.
 * @returns The thread ids.
 */
export function discordThreadIds(links: EngineExternalLink[]): string[] {
  return links
    .filter(
      (link) =>
        link.platform === "discord" &&
        link.kind === "thread" &&
        !!link.externalId,
    )
    .map((link) => link.externalId as string);
}
