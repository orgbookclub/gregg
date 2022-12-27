import { AuthorDto } from "../providers/ows/dto/author.dto";

/**
 * Processes a list of @see AuthorDto objects and returns a readable string.
 *
 * @param {AuthorDto[]} authors An array of @see AuthorDto objects.
 * @param {number} limit The maximum number of authors to display.
 * @returns {string} A comma-separated string of author names.
 */
export const getAuthorString = (authors: AuthorDto[], limit = 3): string => {
  const limitedAuthors = authors.slice(0, limit);
  let authorString = "";
  limitedAuthors.forEach(
    (author) =>
      (authorString =
        authorString === "" ? author.name : `${authorString}, ${author.name}`),
  );
  return authorString;
};
