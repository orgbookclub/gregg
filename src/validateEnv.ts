import { Bot } from "./models";
import { parseBackend } from "./modules/engine/backend";
import { logger } from "./utils/logHandler";

type EnvResult =
  | { ok: true; config: Bot["configs"] }
  | { ok: false; error: string };

const ALWAYS_REQUIRED: [string, string][] = [
  ["DISCORD_TOKEN", "Missing Discord token"],
  ["CLIENT_ID", "Missing Bot's Client ID"],
  ["SENTRY_DSN", "Missing Sentry DSN"],
  ["MONGODB_URI", "Missing MongoDB URI"],
  ["WH_URL", "Missing Debug Webhook URL"],
];

const OWS_REQUIRED: [string, string][] = [
  ["CLIENT_SECRET", "Missing Bot's Client secret"],
  ["API_URL", "Missing API Url"],
];

const ENGINE_REQUIRED: [string, string][] = [
  ["ENGINE_URL", "BACKEND=engine but missing ENGINE_URL"],
  ["ENGINE_CLIENT_ID", "BACKEND=engine but missing ENGINE_CLIENT_ID"],
  ["ENGINE_CLIENT_SECRET", "BACKEND=engine but missing ENGINE_CLIENT_SECRET"],
];

const AI_REQUIRED: [string, string][] = [
  [
    "AZURE_FOUNDRY_ENDPOINT",
    "AI_ENABLED=true but missing AZURE_FOUNDRY_ENDPOINT",
  ],
  [
    "AZURE_FOUNDRY_API_KEY",
    "AI_ENABLED=true but missing AZURE_FOUNDRY_API_KEY",
  ],
  ["AI_MODEL_GENERAL", "AI_ENABLED=true but missing AI_MODEL_GENERAL"],
];

/**
 * Builds the bot config from environment variables without side effects.
 * `BACKEND` (default `ows`) decides which backend credentials are required:
 * OWS needs `API_URL` + `CLIENT_SECRET`, the engine needs `ENGINE_URL`,
 * `ENGINE_CLIENT_ID` and `ENGINE_CLIENT_SECRET`.
 *
 * @param env The environment variables.
 * @returns The config, or the first validation error.
 */
export const parseEnv = (env: NodeJS.ProcessEnv): EnvResult => {
  const backend = parseBackend(env.BACKEND);
  if (!backend) {
    return {
      ok: false,
      error: `Invalid BACKEND "${env.BACKEND}" (expected "ows" or "engine")`,
    };
  }
  const required = [
    ...ALWAYS_REQUIRED,
    ...(backend === "ows" ? OWS_REQUIRED : ENGINE_REQUIRED),
    ...(env.AI_ENABLED === "true" ? AI_REQUIRED : []),
  ];
  for (const [name, error] of required) {
    if (!env[name]) return { ok: false, error };
  }
  return {
    ok: true,
    config: {
      token: env.DISCORD_TOKEN ?? "",
      clientId: env.CLIENT_ID ?? "",
      clientSecret: env.CLIENT_SECRET ?? "",
      apiUrl: env.API_URL ?? "",
      whUrl: env.WH_URL ?? "",
      backend,
      engine:
        backend === "engine"
          ? {
              url: env.ENGINE_URL ?? "",
              clientId: env.ENGINE_CLIENT_ID ?? "",
              clientSecret: env.ENGINE_CLIENT_SECRET ?? "",
            }
          : null,
    },
  };
};

/**
 * Validates that all expected environment variables are set with *some* value.
 * Does not validate that the values are valid. Constructs a config object and
 * attaches it to the bot instance. Terminates the process on missing values.
 *
 * @returns The bots config object.
 */
export const validateEnv = (): Bot["configs"] => {
  const result = parseEnv(process.env);
  if (!result.ok) {
    logger.error(result.error);
    process.exit(1);
  }
  return result.config;
};
