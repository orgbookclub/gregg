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

  public authApi: AuthApi;
  public eventsApi!: EventsApi;
  public goodreadsApi!: GoodreadsApi;
  public storygraphApi!: StorygraphApi;
  public usersApi!: UsersApi;

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
    this.authApi = new AuthApi(new Configuration({ basePath: this.baseUrl }));
    this.initializeAPIs();

    // Start job
    if (!this.cronJob.running) {
      this.cronJob.start();
    }
  }

  /**
   *
   */
  private initializeAPIs() {
    this.eventsApi = new EventsApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.goodreadsApi = new GoodreadsApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.storygraphApi = new StorygraphApi(
      new Configuration({
        basePath: this.baseUrl,
        accessToken: this.accessToken,
      }),
    );
    this.usersApi = new UsersApi(
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
    const response = await this.authApi.authControllerGetAccessToken({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    this.accessToken = response.data.access_token;
  }

  // /**
  //  * Gets info for books from GR.
  //  *
  //  * @param {string} query The query string.
  //  * @param {number} k The maximum number of search results.
  //  * @returns {Promise<BookDto[]>} An array of BookDto object.s.
  //  */
  // async searchGoodreadsBooks(query: string, k = 5): Promise<BookDto[]> {
  //   const response = await this.httpClient.get(
  //     `/api/goodreads/search?q=${query}&k=${k}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Gets info for a GR book.
  //  *
  //  * @param {string} query The query string.
  //  * @returns {Promise<GoodreadsBookDto>} A GoodreadsBookDto object.
  //  */
  // async getGoodreadsBook(query: string): Promise<GoodreadsBookDto> {
  //   const response = await this.httpClient.get(
  //     `/api/goodreads/book?q=${query}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Returns a quote from GR.
  //  *
  //  * @param {string?} query The query string.
  //  * @returns {Promise<string>} The quote.
  //  */
  // async getGoodreadsQuote(query?: string): Promise<string> {
  //   const response = await this.httpClient.get(
  //     `/api/goodreads/quotes?k=1` + (query !== "" ? `&q=${query}` : ""),
  //     this.getRequestConfig(),
  //   );
  //   return response.data[0];
  // }

  // /**
  //  * Gets info for books from SG.
  //  *
  //  * @param {string} query The query string.
  //  * @param {number} k The maximum number of search results.
  //  * @returns {Promise<BookDto[]>} An array of BookDto object.s.
  //  */
  // async searchStorygraphBooks(query: string, k = 5): Promise<BookDto[]> {
  //   const response = await this.httpClient.get(
  //     `/api/storygraph/search?q=${query}&k=${k}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Gets info for a SG book.
  //  *
  //  * @param {string} query The query string.
  //  * @returns {Promise<StorygraphBookDto>} A GoodreadsBookDto object.
  //  */
  // async getStorygraphBook(query: string): Promise<StorygraphBookDto> {
  //   const response = await this.httpClient.get(
  //     `/api/storygraph/book?q=${query}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Gets a list of server events.
  //  *
  //  * @param {string} status The status of the event.
  //  * @param {string} type The type of the event.
  //  * @returns {Promise<EventDto[]>} A List of events.
  //  */
  // async getEventList(status: string, type?: string): Promise<EventDto[]> {
  //   let url = `/api/events?status=${status}`;
  //   if (type) url += `&type=${type}`;
  //   const response = await this.httpClient.get(url, this.getRequestConfig());
  //   return response.data;
  // }

  // /**
  //  * Gets a list of server events for a given user.
  //  *
  //  * @param {string} id The object id for the user.
  //  * @param {string?} type The type of the event.
  //  * @param {string?} status The status of the event.
  //  * @returns {Promise<EventDto[]>} A list of events.
  //  */
  // async getEventListForUser(
  //   id: string,
  //   type?: string,
  //   status?: string,
  // ): Promise<EventDto[]> {
  //   let url = `/api/events?participantIds=${id}`;
  //   if (type) url += `&type=${type}`;
  //   if (status) url += `&status=${status}`;
  //   const response = await this.httpClient.get(url, this.getRequestConfig());
  //   return response.data;
  // }
  // /**
  //  * Searches for a list of server events.
  //  *
  //  * @param {string} query The query string.
  //  * @param {string?} type The type of the event.
  //  * @param {string?} status The status of the event.
  //  * @returns {Promise<EventDto[]>} A List of events.
  //  */
  // async searchEvents(
  //   query: string,
  //   type?: string,
  //   status?: string,
  // ): Promise<EventDto[]> {
  //   const response = await this.httpClient.get(
  //     `/api/events?bookSearchQuery=${query}` +
  //       (type ? `&type=${type}` : "") +
  //       (status ? `&status=${status}` : ""),
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Returns detailed info for an event.
  //  *
  //  * @param {string} id The event ID.
  //  * @returns {Promise<EventDto>} The event.
  //  */
  // async getEventInfo(id: string): Promise<EventDto> {
  //   const response = await this.httpClient.get(
  //     `/api/events/${id}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Returns the user document for a given user id.
  //  *
  //  * @param {string} userId The discord user ID.
  //  */
  // async getUser(userId: string): Promise<UserDto> {
  //   const response = await this.httpClient.get(
  //     `/api/users/${userId}`,
  //     this.getRequestConfig(),
  //   );
  //   return response.data;
  // }

  // /**
  //  * Creates a JSON object for the request header.
  //  *
  //  * @returns {AxiosRequestConfig} Request config object.
  //  */
  // private getRequestConfig() {
  //   return {
  //     headers: { Authorization: `Bearer ${this.accessToken}` },
  //   };
  // }
}
