import { BookDto } from "./book.dto";

interface QuestionAnswerDto {
  question: string;
  answer: string;
}

/**
 * Dto for a Storygraph Book.
 */
export interface StorygraphBookDto extends BookDto {
  series: string;
  coverUrl: string;
  avgRating: number;
  warnings: string;
  moods: string[];
  pace: string[];
  quesAns: QuestionAnswerDto[];
  description: string;
  genres: string[];
}
