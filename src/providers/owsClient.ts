/* eslint-disable camelcase */
import {
  AuthApi,
  Configuration,
  EventsApi,
  GoodreadsApi,
  StorygraphApi,
  UsersApi,
} from "@orgbookclub/ows-client";
import { CronJob } from "cron";

import { logger } from "../utils/logHandler";

const CLIENT_ID = process.env.CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? "";

/**
 * The API Client for the backend service.
 * This client will be responsible for all interactions with the backend.
 */
export class OWSClient {
  private baseUrl: string;
  private accessToken: string;
  private auth: AuthApi;
  public events!: EventsApi;
  public goodreads!: GoodreadsApi;
  public storygraph!: StorygraphApi;
  public users!: UsersApi;

  /**
   * Initializes an instance of the API client.
   * Sets up a cron job to run every hour to refresh the access token.
   *
   * @param baseUrl The base url.
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.accessToken = "";
    this.auth = new AuthApi(new Configuration({ basePath: this.baseUrl }));
  }

  /**
   * Initializes the Sub modules with the baseURL and access Token.
   */
  private initializeAPIs() {
    const configuration = new Configuration({
      basePath: this.baseUrl,
      accessToken: this.accessToken,
    });
    this.events = new EventsApi(configuration);
    this.goodreads = new GoodreadsApi(configuration);
    this.storygraph = new StorygraphApi(configuration);
    this.users = new UsersApi(configuration);
  }

  /**
   * Initializes the API client.
   */
  async initialize() {
    await this.refreshAccessToken();
    this.initializeAPIs();
  }

  /**
   * Gets the access token from the /auth/token endpoint
   * and sets the class instance variable.
   */
  private async refreshAccessToken() {
    const response = await this.auth.authControllerGetAccessToken({
      clientCredentialsDto: {
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });
    this.accessToken = response.data.access_token;
  }
}
