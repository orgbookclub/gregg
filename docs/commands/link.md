# Link (Server admins, engine backend only)

Links this Discord server to a club on the ows-next engine. Only available when Gregg runs with `BACKEND=engine`.

## Commands

| Command        | Description                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| link \<code\> | Claims a link code that a club admin created in the web app (club settings → integrations → Discord). The code is single use and expires after 15 minutes. On success the server is bound to the club and Gregg sends the server's role list to the engine so admins can map Discord roles to club roles |

?> Requires the *Manage Server* permission. A server can be linked to one club at a time; unlink it from the club's integration settings in the web app.

## After linking

- Map Discord roles (for example *Event Staff* → moderator) in the web app. Gregg acts for each member with their Discord roles, so the engine decides who can request, approve, announce or create threads.
- Reader roles follow the club's reader tiers. A Discord role whose name matches a tier name (for example *Bookworm*) is kept in sync automatically.
- Event embeds refresh on their own when events change, including changes made on the web.
