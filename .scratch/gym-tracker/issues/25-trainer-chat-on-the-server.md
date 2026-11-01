# 25: Trainer chat on the home server

**What to build:** The service in `server/` gets a `POST /trainer/chat` endpoint for the trainer chat (spec: "Trainer chat"). It takes a chat brief and the recent conversation (the user's and the trainer's messages, ending with the user's), adds the chat instructions, asks the AI and returns the reply as text. The chat instructions follow the spec: neutral tone like trainer summaries, short answers unless asked for detail, plain text with "- " points, one question back when unclear, only the numbers in the chat brief, advice only, nothing medical beyond avoiding what hurts, English unless the user writes in another language, no topic limits, and pointing to the goals and notes for things that should last. It uses the same token, CORS, size limit, timeout and refusal reasons (`invalid`, `too-large`, `busy`, `failed`, `not-set-up`) as `POST /trainer`; the size limit counts the chat brief and the messages together. The AI stays behind one small swappable piece, which now takes a conversation instead of a single brief, so trainer summaries are a conversation of one message and only `gemini.ts` knows about Gemini.

**Blocked by:** none

**Status:** ready-for-agent

- [x] A chat request comes back as a reply (tested with a stand-in AI), with the chat instructions, the chat brief and the whole conversation reaching the AI
- [x] Trainer summaries work exactly as before
- [x] Malformed requests (no chat brief, no messages, an empty message, an unknown sender, the last message not the user's) are rejected without asking the AI
- [x] A chat brief and messages together over the size limit get "too large" without asking the AI
- [x] Wrong token, busy, failing and slow AI behave like `POST /trainer`
- [x] Gemini gets the conversation with the trainer's messages as its own turns
- [ ] Tried from the home server against the real Gemini key with a made-up chat brief and a short conversation (needs the server updated: done in ticket 26)
- [x] Tests run with `npm test`; `server/README.md` documents the endpoint

## Comments

**2026-11-01, built test-first (real-AI try still open):** Agreed seams: the service's web address with a stand-in AI (`server/trainer.test.ts`) and the Gemini piece with a stand-in internet (`server/gemini.test.ts`); the wording of the chat instructions is judged on real answers, not tested. Five red-green slices: a reply with the chat instructions, chat brief and whole conversation reaching the AI (this changed `AiWriter.write` to take `messages`, so a trainer summary is now a conversation of one message); Gemini getting the conversation with the trainer's messages as its "model" turns; malformed requests rejected; the size limit counting the chat brief and messages together; and not-set-up, busy, failed, too-large and a slow AI answered like trainer summaries (the wrong-token test passed straight away, since the token is checked before any trainer code). The AI-failure answers are now shared by both endpoints; the "failed" message says "The AI couldn't answer" instead of "couldn't write a summary". `POST /trainer/chat` is `handleTrainerChat` in `server/trainer.ts`; the instructions are `chatInstructions` in `server/trainerInstructions.ts` (no topic limits, per the grilling). 7 new tests, 258 in total; typecheck clean. The real-key try waits for the home server update in ticket 26.
