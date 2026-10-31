# 22: Trainer endpoint on the server

**What to build:** The service in `server/` gets a `POST /trainer` endpoint. It takes a trainer brief from the app, adds the trainer instructions and asks the AI for a summary, which it returns as text. The instructions, as decided in the spec: English; a neutral, matter-of-fact tone with no persona, character or trainer clichés; about 100–150 words in a fixed layout (one line on how the session went, "Going well", "Keep an eye on", and a "Suggestion" part only when a change is really worth making); advice only; use only the numbers in the brief (the per-exercise facts are already worked out), never invent or recount them; take the user's goals and notes into account when there are any; follow up on earlier summaries rather than repeat them, weighing recent ones most (in ticket 21's test, both models ignored an earlier summary, so this needs to be explicit: say whether earlier advice seems to have been followed and how it went). It needs the same bearer token as the backup endpoints, has a size limit, and answers CORS like the rest of the service. The AI is reached through one small interface, so tests use a stand-in AI and switching from Gemini to another AI only changes that piece. The AI key, the choice of AI and the model come from environment variables (documented in `server/README.md`). A slow or failing AI gives a clear error to the app, never a hang (a timeout). An overloaded model (503) or a used-up free quota (429) counts as a temporary failure, so the app's retry catches up later; ticket 21 saw 503s often on the newest Flash models. With the free tier's 250,000 tokens per minute (ticket 21), a single brief can't be larger than that, so the size limit for `POST /trainer` is set below it (a server setting) and a larger brief gets the "too large" answer before the AI is called. No dependencies, as before: the AI is called with plain `fetch`.

**Blocked by:** 21

**Status:** done

- [x] A brief sent to `POST /trainer` comes back as a summary (tested with a stand-in AI)
- [x] The instructions and the brief both reach the AI
- [x] An AI answer that the request is too large is passed on to the app as "too large"
- [x] Requests without the right token are rejected, and the AI isn't called
- [x] Malformed briefs are rejected; briefs over the size limit get a distinct "too large" answer the app can act on
- [x] A failing or slow AI gives a clear error after a timeout
- [x] Tried from the PC against the real Gemini key with a few made-up briefs (a good session, a stalled exercise, an often skipped one, with and without goals): the summaries follow the layout and tone
- [x] Tests run with `npm test`, and the Docker image builds

## Comments

**2026-10-31, done:** `POST /trainer` takes `{ "brief": "<text>" }` and returns `{ "summary": "<text>" }`. The request handling is in `server/trainer.ts`, the instructions in `server/trainerInstructions.ts` and the only Gemini-specific code in `server/gemini.ts` (behind the `AiWriter` interface). Without `AI_API_KEY` the trainer answers 501 `not-set-up` and backups work as before. Refusals carry a `reason` the app can act on: `invalid` (400), `too-large` (413, from `TRAINER_MAX_CHARS`, default 600,000 characters, or from Gemini's "token count exceeds"), `busy` (503: Gemini's 503/429/500/504, no answer, or the 90-second timeout) and `failed` (502: wrong key, unknown model, no text; the details only go to the server's log). Settings are in `server/README.md`; the compose block now passes `GYM_AI_API_KEY` from `.env` (optional).

Checked:
- 17 new tests (the endpoint with a stand-in AI, the Gemini piece with a stand-in `fetch`), 226 in total; typecheck clean.
- No Docker on the PC, so the files the Dockerfile copies were put in an empty folder and the server started from there: it ran and `/trainer` answered `not-set-up`. CI builds the image.
- Against the real key from the PC, through the real `gemini.ts` and instructions, four made-up briefs: a good session without goals, a lat pulldown stalled for 9 weeks, a follow-up on earlier advice (grip change, shoulder press replaced) with an often skipped row, and a rough session after a two-week break. All followed the layout and tone and used only given numbers; the follow-up now works (it didn't in ticket 21). The first run padded "Going well" with weak points, so the instructions now rule out padding and repeating an exercise in both parts; the second run was better. One request got a 503 "high demand", answered as `busy`. Answers took 9-40 seconds.
- Remaining small quirks (numbers sometimes written as words, a line break after "Suggestion:") are left for tuning on real sessions in ticket 24.
