# 21: Get an AI key and try it

**What to build:** Before anything real gets built, the user gets a Google Gemini API key on the free tier (Google AI Studio) and the agent checks it works with one test request, sent from the PC with a made-up session, never real data in this step. The agent walks the user through the sign-up one step at a time. The key goes into the user's password manager and is never pasted into the chat, the code or any committed file: the agent's test reads it from an environment variable the user sets in their own terminal. The ticket notes, in plain language, the free tier's limits and that Google may use what's sent on the free tier to improve its products, and records the user's decision on that. It also picks the Gemini model: the most capable one whose free-tier limits comfortably cover about one request per session, with a brief of the user's full history (roughly 200 tokens per past session plus the earlier summaries).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The user has a Gemini API key, stored in their password manager
- [ ] One test request with a made-up session returns a sensible summary
- [ ] The free tier's limits (requests per day/minute) and its data-use terms are written down in this ticket's comments
- [ ] The model is chosen, with its limits and how large a request it accepts
- [ ] Decision recorded: go ahead with Gemini's free tier, or pick another AI

## Comments
