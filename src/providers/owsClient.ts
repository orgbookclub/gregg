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
  private baseUrl = process.env.OWS_URL;
  private accessToken: string;
  private cronJob: CronJob;

  public auth: AuthApi;
  public events!: EventsApi;
  public goodreads!: GoodreadsApi;
  public storygraph!: StorygraphApi;
  public users!: UsersApi;

  /**
   * Initializes an instance of the API client.
   * Sets up a cron job to run every hour to refresh the access token.
   */
  constructor() {
    this.accessToken = "";
    this.cronJob = new CronJob("0 * * * *", async () => {
      try {
        await this.refreshAccessToken();
        this.initializeAPIs();
      } catch (err) {
        logger.error(`Error refreshing access token with cron job: ${err}`);
      }
    });
    this.auth = new AuthApi(new Configuration({ basePath: this.baseUrl }));
    this.initializeAPIs();

    // Start job
    if (!this.cronJob.running) {
      this.cronJob.start();
    }
  }

  /**
   * Initializes the Sub modules with the baseURL and access Token.
   */
  private initializeAPIs() {
    this.events = new EventsApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.goodreads = new GoodreadsApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.storygraph = new StorygraphApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.users = new UsersApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
  }

  /**
   * Initializes the API client.
   */
  async initialize() {
    await this.refreshAccessToken();
  }

  /**
   * Gets the access token from the /auth/token endpoint
   * and sets the class instance variable.
   */
  private async refreshAccessToken() {
    logger.debug("Refreshing api client access token...");
    const response = await this.auth.authControllerGetAccessToken({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    this.accessToken = response.data.access_token;
  }
}
