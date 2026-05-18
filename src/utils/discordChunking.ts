const DISCORD_CONTENT_LIMIT = 2000;
const DEFAULT_SAFETY_MARGIN = 10;

function splitByLength(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}

function packPieces(
  pieces: string[],
  joiner: string,
  maxLen: number,
): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (piece.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitByLength(piece, maxLen));
      continue;
    }
    const candidate = current ? `${current}${joiner}${piece}` : piece;
    if (candidate.length > maxLen) {
      chunks.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLongParagraph(paragraph: string, maxLen: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const sentenceChunks = packPieces(sentences, " ", maxLen);
  const result: string[] = [];
  for (const chunk of sentenceChunks) {
    if (chunk.length <= maxLen) {
      result.push(chunk);
      continue;
    }
    const words = chunk.split(/(\s+)/);
    result.push(...packPieces(words, "", maxLen));
  }
  return result;
}

/**
 * The default per-chunk limit used by chunkForDiscordMessage. Equal to
 * Discord's 2000-character message-content cap minus a small safety
 * margin to absorb emoji surrogate-pair counting differences.
 */
const DEFAULT_DISCORD_MESSAGE_MAX_LEN =
  DISCORD_CONTENT_LIMIT - DEFAULT_SAFETY_MARGIN;

/**
 * Splits a string into chunks suitable for posting as Discord message
 * content. Prefers natural break points: blank-line paragraph
 * boundaries, then sentence terminators, then whitespace-delimited
 * words, then a hard slice as the final fallback. Returns the input
 * unchanged (in a single-element array) when it already fits.
 *
 * Useful anywhere the bot may emit long bot-authored text — agent
 * replies, broadcasts, summaries — without truncation. Long-form text
 * should be passed through this once and the resulting chunks sent
 * sequentially as separate messages.
 *
 * @param text The text to chunk.
 * @param maxLen Maximum characters per chunk; defaults to Discord's
 *   2000-character limit minus a 10-char safety margin.
 * @returns An ordered list of chunks, each within `maxLen`.
 */
function chunkForDiscordMessage(
  text: string,
  maxLen: number = DEFAULT_DISCORD_MESSAGE_MAX_LEN,
): string[] {
  if (text.length <= maxLen) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongParagraph(paragraph, maxLen));
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxLen) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export { DEFAULT_DISCORD_MESSAGE_MAX_LEN, chunkForDiscordMessage };
