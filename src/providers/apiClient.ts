/* eslint-disable camelcase */
import axios from "axios";
import { CronJob } from "cron";

import { BookDto } from "../interfaces/dto/book.dto";
import { GoodreadsBookDto } from "../interfaces/dto/goodreads-book.dto";
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
   * Gets info for books from GR.
   *
   * @param {string} query The query string.
   * @param {number} k The maximum number of search results.
   * @returns {Promise<BookDto[]>} An array of BookDto object.s.
   */
  async searchGoodreadsBooks(query: string, k = 5): Promise<BookDto[]> {
    const requestConfig = {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    };
    const response = await this.httpClient.get(
      `/api/goodreads/search?q=${query}&k=${k}`,
      requestConfig,
    );
    return response.data;
  }

  /**
   * Gets info for a GR book.
   *
   * @param {string} query The query string.
   * @returns {Promise<GoodreadsBookDto>} A GoodreadsBookDto object.
   */
  async getGoodreadsBook(query: string): Promise<GoodreadsBookDto> {
    const requestConfig = {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    };
    const response = await this.httpClient.get(
      `/api/goodreads/book?q=${query}`,
      requestConfig,
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
