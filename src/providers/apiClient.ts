/* eslint-disable camelcase */
import axios from "axios";
import { CronJob } from "cron";

import { logger } from "../utils/logHandler";

/**
 * The API Client for the backend service.
 * This client will be responsible for all interactions with the backend.
 */
export class APIClient {
  private baseUrl = process.env.OWS_URL;
  private httpClient;
  private accessToken: string;
  private cronJob: CronJob;

  /**
   * Initializes an instance of the API client.
   * Sets up a cron job to run every hour to refresh the access token.
   */
  constructor() {
    this.accessToken = "";
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
    });
    this.cronJob = new CronJob("0 * * * *", async () => {
      try {
        await this.refreshAccessToken();
      } catch (err) {
        logger.error(`Error refreshing access token with cron job: ${err}`);
      }
    });
    // Start job
    if (!this.cronJob.running) {
      this.cronJob.start();
    }
  }

  /**
   * Initializes the API client.
   */
  async initialize() {
    await this.refreshAccessToken();
  }

  /**
   * Gets info for a GR book.
   *
   * @param {string} query The query string.
   */
  async getGoodreadsBook(query: string) {
    const response = await this.httpClient.get(
      `/api/goodreads/book?q=${query}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    return response.data;
  }

  /**
   * Gets the access token from the /auth/token endpoint
   * and sets the class instance variable.
   */
  private async refreshAccessToken() {
    logger.debug("Refreshing api client access token...");

    const response = await this.httpClient.post("/auth/token", {
      grant_type: "client_credentials",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
    });
    this.accessToken = response.data.access_token;
  }
}
