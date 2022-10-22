import { AuthorDto } from "./author.dto";

/**
 * Dto for a Book.
 * This is further extended by @see StorygraphBookDto and @see GoodreadsBookDto .
 */
export interface BookDto {
  _id: string | undefined;
  title: string;
  authors: Array<AuthorDto>;
  url: string;
  genres: Array<string>;
}
