import { AuthorDto } from "../interfaces/dto/author.dto";

/**
 *
 * @param authors
 */
export const getAuthorString = (authors: AuthorDto[]) => {
  let authorString = "";
  authors.forEach(
    (author) =>
      (authorString =
        authorString === "" ? author.name : `${authorString}, ${author.name}`),
  );
  return authorString;
};
