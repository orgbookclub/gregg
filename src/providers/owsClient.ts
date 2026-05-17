/* eslint-disable camelcase, import/no-named-as-default-member */
import {
  AccessTokenDto,
  Configuration,
  EventsApi,
  GoodreadsApi,
  StorygraphApi,
  UsersApi,
} from "@organizedbookclub/ows-client";
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

import { logger } from "../utils/logHandler";

/**
 * Number of seconds before the OWS-reported token expiry at which the
 * client should proactively refresh. Five minutes leaves enough headroom
 * for clock drift and slow networks at the typical 1-hour server TTL.
 */
const REFRESH_SKEW_SECONDS = 300;

/**
 * Internal axios request config marker used to ensure the 401 response
 * interceptor only retries a given request once. Avoids infinite loops
 * when the refreshed token is still rejected.
 */
interface RetriableConfig extends InternalAxiosRequestConfig {
  __owsRefreshRetried?: boolean;
}

/**
 * The API Client for the backend service.
 * This client will be responsible for all interactions with the backend.
 */
export class OWSClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private expiresAt: number;
  private refreshPromise: Promise<void> | null;
  private apiAxios: AxiosInstance;
  public events: EventsApi;
  public goodreads: GoodreadsApi;
  public storygraph: StorygraphApi;
  public users: UsersApi;

  /**
   * Initializes an instance of the API client. The generated `*Api`
   * instances share a single axios instance so a 401 response on any
   * request triggers a single-flight token refresh and one retry.
   *
   * @param baseUrl The base URL of the OWS deployment.
   * @param clientId The OAuth2 client ID, registered in the OWS
   *   `config/clients.json` (or the file `CLIENTS_FILE` points at).
   * @param clientSecret The plaintext client secret matching the
   *   argon2id hash in the OWS client registry.
   */
  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = "";
    this.expiresAt = 0;
    this.refreshPromise = null;

    this.apiAxios = axios.create();
    this.apiAxios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleResponseError(error),
    );

    const configuration = new Configuration({
      basePath: this.baseUrl,
      accessToken: () => this.getValidToken(),
    });
    this.events = new EventsApi(configuration, undefined, this.apiAxios);
    this.goodreads = new GoodreadsApi(configuration, undefined, this.apiAxios);
    this.storygraph = new StorygraphApi(
      configuration,
      undefined,
      this.apiAxios,
    );
    this.users = new UsersApi(configuration, undefined, this.apiAxios);
  }

  /**
   * Eagerly fetches an initial access token so misconfigured credentials
   * surface during boot rather than on the first user interaction.
   */
  async initialize() {
    await this.getValidToken();
  }

  /**
   * Returns a non-expired access token, refreshing if the cached one is
   * absent or within {@link REFRESH_SKEW_SECONDS} of its expiry. Public
   * because secondary OWS surfaces (e.g. The MCP transport in the AI
   * module) need to share the same single-flight refresh and cache as
   * the generated `*Api` clients..
   *
   * @returns The current access token.
   */
  async getValidToken(): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !this.accessToken ||
      nowSeconds >= this.expiresAt - REFRESH_SKEW_SECONDS
    ) {
      await this.refresh();
    }
    return this.accessToken;
  }

  /**
   * Drops the cached access token so the next {@link getValidToken}
   * call forces a fresh fetch. Used by 401 retry paths in transports
   * (e.g. The MCP client) that don't sit behind the axios response
   * interceptor and therefore can't piggy-back on its automatic retry.
   */
  invalidateToken(): void {
    this.accessToken = "";
    this.expiresAt = 0;
  }

  /**
   * Single-flight wrapper around {@link fetchToken}. Concurrent callers
   * await the same in-flight refresh instead of triggering parallel
   * `/auth/token` requests.
   *
   * @returns A promise that resolves when the refresh completes.
   */
  private refresh(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.fetchToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  /**
   * Fetches a new access token from `/auth/token` using the OAuth2
   * client-credentials grant with HTTP Basic auth (RFC 6749 §2.3.1)
   * and a form-urlencoded body. Updates {@link accessToken} and
   * {@link expiresAt} on success.
   */
  private async fetchToken(): Promise<void> {
    const response = await axios.post<AccessTokenDto>(
      `${this.baseUrl}/auth/token`,
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    const issuedAt = Math.floor(Date.now() / 1000);
    this.accessToken = response.data.access_token;
    this.expiresAt = issuedAt + response.data.expires_in;
    logger.debug(
      `OWS access token refreshed; expires in ${response.data.expires_in}s, scope: ${response.data.scope}`,
    );
  }

  /**
   * Handles axios response errors: on a 401 from a non-`/auth/token`
   * request that hasn't already been retried, single-flight refreshes
   * the token and re-issues the original request once. All other errors
   * (including 401s from `/auth/token` itself or a second 401 after
   * refresh) propagate unchanged.
   *
   * @param error The axios error to handle.
   * @returns The retried response, or a rejected promise.
   */
  private async handleResponseError(error: AxiosError) {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    if (
      status !== 401 ||
      !config ||
      config.__owsRefreshRetried ||
      this.isAuthTokenRequest(config)
    ) {
      return Promise.reject(error);
    }
    config.__owsRefreshRetried = true;
    try {
      await this.refresh();
    } catch (refreshErr) {
      logger.error(refreshErr, "OWS token refresh failed during 401 retry");
      return Promise.reject(error);
    }
    if (config.headers) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }
    return this.apiAxios.request(config);
  }

  /**
   * Identifies requests targeting `/auth/token` so the 401 interceptor
   * can skip them (a 401 there means bad credentials, not an expired
   * token, and a refresh would loop).
   *
   * @param config The axios request config to inspect.
   * @returns Whether the request is the `/auth/token` call.
   */
  private isAuthTokenRequest(config: InternalAxiosRequestConfig): boolean {
    const url = config.url ?? "";
    return url.endsWith("/auth/token");
  }
}
