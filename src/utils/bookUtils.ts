import { AuthorDto } from "../providers/ows/dto/author.dto";

/**
 * Processes a list of @see AuthorDto objects and returns a readable string.
 *
 * @param {AuthorDto[]} authors An array of @see AuthorDto objects.
 * @returns {string} A comma-separated string of author names.
 */
export const getAuthorString = (authors: AuthorDto[]): string => {
  let authorString = "";
  authors.forEach(
    (author) =>
      (authorString =
        authorString === "" ? author.name : `${authorString}, ${author.name}`),
  );
  return authorString;
};
