# 17: Backup service for the home server

**What to build:** A small service, kept in this repository under `server/`, that stores the app's backups. Written in TypeScript on Node with no dependencies, so `npm test` covers it like the rest of the project, and packaged as a Docker image the server can run. It has two endpoints: `PUT /backup` stores the uploaded backup as a dated file and keeps only the newest N, and `GET /backup/latest` returns the newest one. Every request needs a bearer token, compared in constant time. It answers CORS preflights for `https://totalsinnlos.github.io` only, plus whatever ticket 16 found was needed. Uploads have a size limit. Settings (token, port, how many to keep, data folder) come from environment variables. No server details or secrets go into the repository.

**Blocked by:** 16

**Status:** done

- [x] Uploading a backup and then fetching the latest returns the same content
- [x] Only the newest N backups are kept
- [x] Requests without the right token are rejected, and nothing is stored
- [x] Uploads over the size limit and uploads that aren't a valid backup are rejected
- [x] CORS preflights from the app's origin succeed; other origins get no CORS headers
- [x] Tests run with `npm test`, and the Docker image builds

## Comments

**2026-10-31, done:** The service is in `server/` (`app.ts` for requests, `backupStore.ts` for files, `main.ts` to start, settings in `server/README.md`). Node 24 runs the `.ts` files directly, so the image has no packages. `npm test` runs its 10 tests, `npm run typecheck` checks it, and CI builds the Docker image on every push. Tried for real on the PC: upload, download, wrong token and a too-short token all behave.
