import OpenAI from "openai";

/**
 * Configuration values needed to construct an OpenAI client pointed at
 * the Azure Foundry deployment.
 */
export interface AzureFoundryConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

/**
 * Builds an OpenAI SDK client configured for the project's Azure AI
 * Foundry deployment. The Foundry endpoint exposes an OpenAI-compatible
 * surface, so we use the upstream `openai` package with `baseURL` and
 * `apiKey` overridden — no Azure-specific SDK required.
 *
 * @param config The Foundry endpoint, key, and model deployment name.
 * @returns An OpenAI client instance ready to call Responses-API methods.
 */
export function createAzureFoundryClient(config: AzureFoundryConfig): OpenAI {
  return new OpenAI({
    baseURL: config.endpoint,
    apiKey: config.apiKey,
  });
}
