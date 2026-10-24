## Project

Gym Tracker: an installable offline web app (PWA) for tracking gym exercises, built with TypeScript, React and Vite. Spec and tickets live in `.scratch/gym-tracker/`. All app rules belong in the core module (`src/core/`), tested through its commands and queries; screens only call into it.

The user is new to coding: explain choices in plain language.

## Commands

- `npm test`: run the tests once
- `npm run build`: typecheck and build into `dist/`
- `npm run dev`: local dev server

Pushing to `main` runs the tests and deploys to GitHub Pages (`https://totalsinnlos.github.io/gym-tracker/`) via `.github/workflows/deploy.yml`.

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
