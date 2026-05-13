<p align="center">
<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-develop-ci.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-develop-ci.yml/badge.svg">
</a>

<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-deploy-azure.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-deploy-azure.yml/badge.svg">
</a>

<a href="https://github.com/orgbookclub/gregg/actions/workflows/gregg-prod-deploy-azure.yml">
<img src="https://github.com/orgbookclub/gregg/actions/workflows/gregg-prod-deploy-azure.yml/badge.svg">
</a>
</p>

# Gregg

This is the repository for Gregg, a Discord bot for Book Clubs. Currently, Gregg is custom-tailored to the [Organized Book Club](https://discord.gg/BookClubs) server on Discord.

## Running the project

```bash
yarn install

# development
yarn start:dev

# prod
yarn start
```

## Test

Currently, there is no test suite for the project.

## OWS authentication

Gregg authenticates to the OWS backend using OAuth 2.0 client-credentials
(RFC 6749 §4.4) and an RS256 bearer token (1 h TTL by default). Three
env vars drive the flow:

- `API_URL` — base URL of the OWS deployment.
- `CLIENT_ID` — must match a client registered in the OWS deployment's
  client catalogue (`config/clients.json` by default; the file the
  deployment's `CLIENTS_FILE` env var points at otherwise).
- `CLIENT_SECRET` — the plaintext client secret whose argon2id hash is
  stored in that catalogue against the matching `clientId`.

The registered `gregg` client should be granted these scopes (covers
every endpoint Gregg currently calls plus the obvious near-term
additions):

```
events:read events:write
users:read users:write
books:read books:write
reviews:read reviews:write
```

The wrapper in `src/providers/owsClient.ts` requests a token at boot,
caches it until 5 minutes before the server-reported `expires_in`, and
single-flights refresh on demand. A response interceptor on the shared
axios instance retries any 401 once after a refresh, so brief outages
or key rotations don't bubble up to command handlers.

## License

This project is licensed under the GNU General Public License v3.0 or later.
See the [LICENSE](./LICENSE) file for the full license text.
