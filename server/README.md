# Backup service

A small service for the home server that stores the app's backups. The app uploads a backup with `PUT /backup` and fetches the newest with `GET /backup/latest`. Both need the header `Authorization: Bearer <token>`. Only the app's website may call it from a browser.

Each upload is saved as `backup-<time>.json` in the data folder, and only the newest few are kept.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_TOKEN` | (required) | The secret the app sends. At least 20 characters, e.g. from `openssl rand -base64 24`. |
| `PORT` | `8095` | Port to listen on. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in Docker) | Address to listen on. |
| `DATA_DIR` | `./data` (`/data` in Docker) | Folder for the backup files. |
| `KEEP` | `30` | How many backups to keep. |
| `MAX_BYTES` | `10000000` | Largest upload accepted. |
| `ALLOWED_ORIGIN` | `https://totalsinnlos.github.io` | The website allowed to call the service. |

## Running

- Tests: `npm test` in the project folder.
- Locally: `BACKUP_TOKEN=... node server/main.ts`
- Docker: `docker build -t gym-backup server`
