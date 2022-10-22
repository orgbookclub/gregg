/* eslint-disable camelcase */
import axios, { AxiosRequestConfig } from "axios";
import { CronJob } from "cron";

import { logger } from "../../utils/logHandler";

import { BookDto } from "./dto/book.dto";
import { EventDto } from "./dto/event.dto";
import { GoodreadsBookDto } from "./dto/goodreads-book.dto";
import { StorygraphBookDto } from "./dto/storygraph-book.dto";

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
    const response = await this.httpClient.get(
      `/api/goodreads/search?q=${query}&k=${k}`,
      this.getRequestConfig(),
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
    const response = await this.httpClient.get(
      `/api/goodreads/book?q=${query}`,
      this.getRequestConfig(),
    );
    return response.data;
  }

  /**
   * Returns a quote from GR.
   *
   * @param {string?} query The query string.
   * @returns {Promise<string>} The quote.
   */
  async getGoodreadsQuote(query?: string): Promise<string> {
    const response = await this.httpClient.get(
      `/api/goodreads/quotes?k=1` + (query !== "" ? `&q=${query}` : ""),
      this.getRequestConfig(),
    );
    return response.data[0];
  }

  /**
   * Gets info for books from SG.
   *
   * @param {string} query The query string.
   * @param {number} k The maximum number of search results.
   * @returns {Promise<BookDto[]>} An array of BookDto object.s.
   */
  async searchStorygraphBooks(query: string, k = 5): Promise<BookDto[]> {
    const response = await this.httpClient.get(
      `/api/storygraph/search?q=${query}&k=${k}`,
      this.getRequestConfig(),
    );
    return response.data;
  }

  /**
   * Gets info for a SG book.
   *
   * @param {string} query The query string.
   * @returns {Promise<StorygraphBookDto>} A GoodreadsBookDto object.
   */
  async getStorygraphBook(query: string): Promise<StorygraphBookDto> {
    const response = await this.httpClient.get(
      `/api/storygraph/book?q=${query}`,
      this.getRequestConfig(),
    );
    return response.data;
  }

  /**
   * Gets a list of server events.
   *
   * @param {string} type The type of the event.
   * @param {string} status The status of the event.
   * @returns {Promise<EventDto[]>} A List of events.
   */
  async getEventList(type: string, status: string): Promise<EventDto[]> {
    const response = await this.httpClient.get(
      `/api/events?type=${type}&status=${status}`,
      this.getRequestConfig(),
    );
    return response.data;
  }

  /**
   * Returns detailed info for an event.
   *
   * @param {string} id The event ID.
   * @returns {Promise<EventDto>} The event.
   */
  async getEventInfo(id: string): Promise<EventDto> {
    const response = await this.httpClient.get(
      `/api/events/${id}`,
      this.getRequestConfig(),
    );
    return response.data;
  }
  /**
   * Creates a JSON object for the request header.
   *
   * @returns {AxiosRequestConfig} Request config object.
   */
  private getRequestConfig() {
    return {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    };
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
