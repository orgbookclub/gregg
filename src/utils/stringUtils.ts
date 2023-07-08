/**
 * Determines if a string is longer than the given length, and if so
 * substrings it and appends an ellipsis.
 *
 * @param str The string to shorten.
 * @param len The maximum allowed length for the string.
 * @returns The potentially shortened string.
 */
export const customSubstring = (str: string, len: number) => {
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
};
