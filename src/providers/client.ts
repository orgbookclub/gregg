import axios from "axios";

import { logger } from "../utils/logHandler";
/**
 * Client for sending requests to OWS.
 */
export class Client {
  BASE_URL = "http://localhost:3000/api";
  /**
   * Fetches a list of books from GR.
   *
   * @param {string} query The query string.
   * @param {number} k Maximum number of search results.
   */
  async searchBooks(query: string, k: number) {
    const response = await axios.get(
      this.BASE_URL + `/goodreads/search?q=${query}`,
    );
    return response;
  }
}
