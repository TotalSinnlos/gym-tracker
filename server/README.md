# Backup service and AI trainer

A small service for the home server that stores the app's backups and asks an AI for session summaries. The app uploads a backup with `PUT /backup`, fetches the newest with `GET /backup/latest`, and sends a trainer brief with `POST /trainer`. All need the header `Authorization: Bearer <token>`. Only the app's website may call it from a browser.

Each upload is saved as `backup-<time>.json` in the data folder, and only the newest few are kept.

## Trainer

`POST /trainer` takes `{ "brief": "<text>" }`, adds the instructions in `trainerInstructions.ts` and returns `{ "summary": "<text>" }`. Without `AI_API_KEY` the trainer is off and answers 501; backups work either way. When there's no summary, the answer has a `reason` that tells the app what to do:

| Status | `reason` | Meaning |
|---|---|---|
| 400 | `invalid` | Not a trainer brief. |
| 413 | `too-large` | The brief is too long: send it again with less history. |
| 501 | `not-set-up` | No AI key on the server. |
| 502 | `failed` | The AI refused (wrong key, unknown model, …): needs fixing on the server. The details are in the server's log. |
| 503 | `busy` | The AI is overloaded, out of free requests or too slow: try again later. |

Only `gemini.ts` knows about Gemini. Another AI needs another file like it, plus a new `AI_PROVIDER` value in `main.ts`.

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
| `AI_API_KEY` | (none: trainer off) | The AI's secret key. |
| `AI_PROVIDER` | `gemini` | Which AI to use. Only `gemini` so far. |
| `AI_MODEL` | `gemini-3.6-flash` | Which model of that AI. |
| `TRAINER_MAX_CHARS` | `600000` | Longest brief sent to the AI; longer ones get `too-large`. Kept below the free tier's 250,000 tokens per minute (a token is 3-4 characters). |
| `TRAINER_TIMEOUT_MS` | `90000` | How long to wait for the AI. |

## Running

- Tests: `npm test` in the project folder.
- Locally: `BACKUP_TOKEN=... node server/main.ts`
- Docker: `docker build -t gym-backup server`
- Home server: `compose-service.yml` is the block added to the end of the server's `docker-compose.yml`.
