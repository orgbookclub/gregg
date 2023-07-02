import { AuthorDto } from "@orgbookclub/ows-client";

/**
 * Processes a list of @see AuthorDto objects and returns a readable string.
 *
 * @param authors An array of @see AuthorDto objects.
 * @param limit The maximum number of authors to display.
 * @returns A comma-separated string of author names.
 */
export const getAuthorString = (authors: AuthorDto[], limit = 3) => {
  const limitedAuthors = authors.slice(0, limit);
  let authorString = "";
  limitedAuthors.forEach(
    (author) =>
      (authorString =
        authorString === "" ? author.name : `${authorString}, ${author.name}`),
  );
  return authorString;
};
