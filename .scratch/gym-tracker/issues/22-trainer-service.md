# 22: Trainer endpoint on the server

**What to build:** The service in `server/` gets a `POST /trainer` endpoint. It takes a trainer brief from the app, adds the trainer instructions and asks the AI for a summary, which it returns as text. The instructions, as decided in the spec: English; a neutral, matter-of-fact tone with no persona, character or trainer clichés; about 100–150 words in a fixed layout (one line on how the session went, "Going well", "Keep an eye on", and a "Suggestion" part only when a change is really worth making); advice only; use only the numbers in the brief (the per-exercise facts are already worked out), never invent or recount them; take the user's goals and notes into account when there are any; follow up on earlier summaries rather than repeat them, weighing recent ones most. It needs the same bearer token as the backup endpoints, has a size limit, and answers CORS like the rest of the service. The AI is reached through one small interface, so tests use a stand-in AI and switching from Gemini to another AI only changes that piece. The AI key, the choice of AI and the model come from environment variables (documented in `server/README.md`). A slow or failing AI gives a clear error to the app, never a hang (a timeout). No dependencies, as before: the AI is called with plain `fetch`.

**Blocked by:** 21

**Status:** ready-for-agent

- [ ] A brief sent to `POST /trainer` comes back as a summary (tested with a stand-in AI)
- [ ] The instructions and the brief both reach the AI
- [ ] An AI answer that the request is too large is passed on to the app as "too large"
- [ ] Requests without the right token are rejected, and the AI isn't called
- [ ] Malformed briefs are rejected; briefs over the size limit get a distinct "too large" answer the app can act on
- [ ] A failing or slow AI gives a clear error after a timeout
- [ ] Tried from the PC against the real Gemini key with a few made-up briefs (a good session, a stalled exercise, an often skipped one, with and without goals): the summaries follow the layout and tone
- [ ] Tests run with `npm test`, and the Docker image builds

## Comments
