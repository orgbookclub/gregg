import { BookDto } from "./book.dto";

/**
 * Dto for a Goodreads Book.
 */
export interface GoodreadsBookDto extends BookDto {
  series: string;
  coverUrl: string;
  avgRating: number;
  numRatings: number;
  numReviews: number;
  description: string;
  numPages: number;
}
