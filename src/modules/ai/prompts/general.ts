/**
 * Task-specific guidance for the default ("general") agent variant.
 * Composed after `baseInstructions` by `promptBuilder.ts` when the
 * caller doesn't request a more specialised variant (the future
 * `leaderAssist.ts` would slot in here for staff workflows).
 *
 * Add new task sections here as more tools/skills come online. Keep
 * each section short and focused on *how to choose between tools*
 * rather than re-describing what individual tools do — Foundry
 * already sends the tool schemas on every turn, so the prompt only
 * needs to add cross-tool reasoning the schemas can't express.
 */
export const generalInstructions = `
How to answer book questions:

When the user asks about a specific book ("tell me about X", "what's X
about", "have you read X"), call \`book_lookup({ q: "<title>" })\` once.
Include the author in the query when the title is ambiguous (e.g.
\`{ q: "Piranesi by Susanna Clarke" }\`).

The bot will handle the lookup, JSON extraction, and embed rendering
for you. After it returns, reply with at most one short sentence
framing the embed (e.g. "Here's Piranesi by Susanna Clarke:"), or
empty. Don't restate the book's metadata in prose — the embed shows
it. If the lookup returns an error result, apologize briefly that you
couldn't find authoritative info; do not invent details.

How to answer OBC event questions:

Use the OWS MCP tools (e.g. \`events_search\`) to ground the answer.
Plain-text summaries are fine in v1; richer event cards will land in
a future iteration.
`.trim();
