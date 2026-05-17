import {
  ActionRowBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  EmbedBuilder,
  GuildMember,
  MessageActionRowComponentBuilder,
} from "discord.js";

/**
 * The provenance of an agent invocation. Mention is the @gregg listener
 * (multi-turn). Slash is a one-shot invocation from a slash command handler.
 */
export type AgentSource = "mention" | "slash";

/**
 * Identifying coordinates for a conversation session. Each unique key
 * maps to at most one active aiSessions row.
 */
export interface SessionKey {
  guildId: string;
  channelId: string;
  isThread: boolean;
  userId: string;
}

/**
 * Per-call context the caller hands to the agent. The agent never reads
 * Discord state directly — everything it needs about the surrounding
 * conversation comes through here.
 */
export interface AgentContext {
  source: AgentSource;
  sessionKey: SessionKey;
  member?: GuildMember;
  recentMessages?: { authorId: string; authorName: string; content: string }[];
}

/**
 * Audit record for a single tool call within a turn. Persisted as JSON
 * inside aiInteractions.toolCalls.
 */
export interface ToolCallLog {
  name: string;
  args?: unknown;
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
}

/**
 * Identifies the Discord-renderable artifact type a render tool emitted.
 * Used by the deliver layer to choose between embeds and IsComponentsV2.
 */
export type ArtifactKind = "embed" | "containerV2" | "actionRow" | "attachment";

/**
 * Why the agent loop stopped on a given turn. Mirrored into
 * aiInteractions.finishReason for analytics.
 */
export type AgentFinishReason =
  | "stop"
  | "length"
  | "tool_error"
  | "refused"
  | "budget"
  | "error";

/**
 * Structured result returned by AIAgent.run. The agent never posts to
 * Discord; the caller (mention listener or slash-command handler)
 * translates this into a Discord API call via deliver.ts. Components
 * are partitioned by deliver.ts at send time — ContainerBuilder
 * artifacts go in their own ComponentsV2 message, classic
 * ActionRowBuilder rows ride along with text/embeds in legacy messages.
 */
export interface AgentResult {
  text?: string;
  embeds?: EmbedBuilder[];
  components?: (
    | ActionRowBuilder<MessageActionRowComponentBuilder>
    | ContainerBuilder
  )[];
  attachments?: AttachmentBuilder[];
  ephemeralPreferred?: boolean;
  /**
   * The aiSessions row this turn belongs to, or null when the agent
   * declined to run (e.g. Budget refusal) and no session was opened.
   * Callers that want to surface "this came from session X" can rely
   * on a non-null value only for turns that actually invoked the
   * model.
   */
  session: {
    sessionId: string;
    openaiResponseId: string;
    turnIndex: number;
  } | null;
  meta: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens: number;
    toolCalls: ToolCallLog[];
    latencyMs: number;
    finishReason: AgentFinishReason;
    costUsdEstimate: number;
  };
}
