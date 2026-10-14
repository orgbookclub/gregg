const BACKENDS: Backend[] = ["ows", "engine"];

/**
 * Commands (or subcommands) that still read or write OWS directly and have
 * no engine implementation yet. On the engine backend they reply with a
 * notice instead of touching OWS.
 */
const ENGINE_UNSUPPORTED_COMMANDS: Record<string, "*" | string[]> = {
  book: "*",
  events: ["list", "search", "edit", "broadcast", "adduser", "removeuser"],
  user: ["info", "events"],
};

/**
 * Button custom-id prefixes that open OWS-only flows.
 */
const ENGINE_UNSUPPORTED_BUTTON_PREFIXES = [
  "evt-edit-",
  "evt-thread-",
  "evt-announce-",
  "evt-addpts-",
  "evt-rmpts-",
  "book-br-",
];

/**
 * Which backend Gregg talks to. `ows` is the legacy OWS API (Gregg runs the
 * lifecycle jobs and computes stats); `engine` is ows-next (the engine owns
 * those rules and Gregg is a thin client).
 */
export type Backend = "ows" | "engine";

/**
 * Commands and jobs may declare which backends they run on. Omitted means
 * both.
 */
export interface BackendScoped {
  backends?: Backend[];
}

/**
 * Parses the `BACKEND` setting. Empty means `ows`.
 *
 * @param raw The raw value.
 * @returns The backend, or null when the value is invalid.
 */
export function parseBackend(raw: string | undefined): Backend | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "ows";
  return (BACKENDS as string[]).includes(value) ? (value as Backend) : null;
}

/**
 * Whether a command or job runs on the given backend.
 *
 * @param item The command or job.
 * @param backend The active backend.
 * @returns True when it runs.
 */
export function runsOnBackend(item: BackendScoped, backend: Backend): boolean {
  return !item.backends || item.backends.includes(backend);
}

/**
 * Keeps the commands or jobs that run on the given backend.
 *
 * @param items The commands or jobs.
 * @param backend The active backend.
 * @returns The filtered list.
 */
export function filterForBackend<T extends BackendScoped>(
  items: T[],
  backend: Backend,
): T[] {
  return items.filter((item) => runsOnBackend(item, backend));
}

/**
 * Whether a slash (sub)command is available on the backend.
 *
 * @param backend The active backend.
 * @param command The command name.
 * @param subcommand The subcommand name, if any.
 * @returns True when available.
 */
export function isCommandAvailable(
  backend: Backend,
  command: string,
  subcommand?: string | null,
): boolean {
  if (backend === "ows") return true;
  const blocked = ENGINE_UNSUPPORTED_COMMANDS[command];
  if (!blocked) return true;
  if (blocked === "*") return false;
  return !subcommand || !blocked.includes(subcommand);
}

/**
 * Whether a button is available on the backend.
 *
 * @param backend The active backend.
 * @param customId The button custom id.
 * @returns True when available.
 */
export function isButtonAvailable(backend: Backend, customId: string): boolean {
  if (backend === "ows") return true;
  return !ENGINE_UNSUPPORTED_BUTTON_PREFIXES.some((prefix) =>
    customId.startsWith(prefix),
  );
}
