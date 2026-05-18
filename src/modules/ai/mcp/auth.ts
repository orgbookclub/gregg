const HTTP_UNAUTHORIZED = 401;

function withBearer(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers ?? undefined);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Token-providing surface required by the MCP auth-fetch wrapper. Kept
 * narrow so the MCP layer doesn't reach into the broader `OWSClient`
 * surface; any object that can mint and invalidate an OWS bearer token
 * satisfies the contract.
 */
export interface IOwsTokenProvider {
  getValidToken(): Promise<string>;
  invalidateToken(): void;
}

/**
 * Wraps the global fetch implementation to inject an OWS bearer token
 * on every request and transparently retry once after invalidating the
 * token cache when the server responds with 401. The MCP transport
 * doesn't sit behind the OWSClient axios interceptor, so this is its
 * equivalent of the auto-retry behaviour the REST clients enjoy.
 *
 * @param tokenProvider The token source (typically the bot's OWSClient).
 * @returns A fetch-compatible function suitable for passing to the MCP
 *   StreamableHTTPClientTransport.
 */
export function createAuthFetch(
  tokenProvider: IOwsTokenProvider,
): typeof fetch {
  return async (input, init) => {
    const requestInit: RequestInit = init ?? {};
    const firstToken = await tokenProvider.getValidToken();
    const firstResponse = await fetch(
      input,
      withBearer(requestInit, firstToken),
    );
    if (firstResponse.status !== HTTP_UNAUTHORIZED) {
      return firstResponse;
    }
    tokenProvider.invalidateToken();
    const retryToken = await tokenProvider.getValidToken();
    return fetch(input, withBearer(requestInit, retryToken));
  };
}
