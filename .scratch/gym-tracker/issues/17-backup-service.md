# 17: Backup service for the home server

**What to build:** A small service, kept in this repository under `server/`, that stores the app's backups. Written in TypeScript on Node with no dependencies, so `npm test` covers it like the rest of the project, and packaged as a Docker image the server can run. It has two endpoints: `PUT /backup` stores the uploaded backup as a dated file and keeps only the newest N, and `GET /backup/latest` returns the newest one. Every request needs a bearer token, compared in constant time. It answers CORS preflights for `https://totalsinnlos.github.io` only, plus whatever ticket 16 found was needed. Uploads have a size limit. Settings (token, port, how many to keep, data folder) come from environment variables. No server details or secrets go into the repository.

**Blocked by:** 16

**Status:** ready-for-agent

- [ ] Uploading a backup and then fetching the latest returns the same content
- [ ] Only the newest N backups are kept
- [ ] Requests without the right token are rejected, and nothing is stored
- [ ] Uploads over the size limit and uploads that aren't a valid backup are rejected
- [ ] CORS preflights from the app's origin succeed; other origins get no CORS headers
- [ ] Tests run with `npm test`, and the Docker image builds
