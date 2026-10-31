# 21: Get an AI key and try it

**What to build:** Before anything real gets built, the user gets a Google Gemini API key on the free tier (Google AI Studio) and the agent checks it works with one test request, sent from the PC with a made-up session, never real data in this step. The agent walks the user through the sign-up one step at a time. The key goes into the user's password manager and is never pasted into the chat, the code or any committed file: the agent's test reads it from an environment variable the user sets in their own terminal. The ticket notes, in plain language, the free tier's limits and that Google may use what's sent on the free tier to improve its products, and records the user's decision on that. It also picks the Gemini model: the most capable one whose free-tier limits comfortably cover about one request per session, with a brief of the user's full history (roughly 200 tokens per past session plus the earlier summaries).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The user has a Gemini API key, stored in their password manager
- [x] One test request with a made-up session returns a sensible summary
- [x] The free tier's limits (requests per day/minute) and its data-use terms are written down in this ticket's comments
- [x] The model is chosen, with its limits and how large a request it accepts
- [x] Decision recorded: go ahead with Gemini's free tier, or pick another AI

## Comments

**2026-10-31, in progress:** The user created a key in Google AI Studio and keeps it in their password manager. It was never pasted into the chat: a throwaway script (outside the repository) read it from an environment variable set in the user's own PowerShell window and sent a made-up session.

Models tried with the same made-up brief:
- `gemini-4-argon`: no free tier (Google answers 429 with "limit: 0").
- `gemini-3.8-flash` and `gemini-3.7-flash`: answered 503 "high demand" on every try that day.
- `gemini-3.5-flash`: worked. Right layout and tone, used the goals (sore shoulder) sensibly.
- `gemini-3.6-flash`: worked, and more specific than 3.5: it quoted the worked-out facts ("seven weeks without an increase", "four of the last six sessions"). One grammar slip ("will safer support").
- Both ignored the earlier summary about the lat pulldown instead of following up on it. That's the instructions' fault, not the model's: ticket 22 makes it explicit.

A request was about 500 tokens of brief and instructions, plus about 1,200-1,400 tokens of the model "thinking" before answering, which also count towards the limits.

**Chosen model:** `gemini-3.6-flash`. The model is a server setting, so switching later (for example to 3.8 once it's less busy) needs no new code. No backup model for now.

**Data use:** the user lives in Switzerland. Google's terms apply the paid-tier data terms to users in the EEA, Switzerland and the UK even on the free tier: content isn't used to improve Google's products, only kept for a limited time to detect abuse. So the free tier's "may be used to improve products, human reviewers may read it" doesn't apply.

**2026-10-31, done:** Free-tier limits for `gemini-3.6-flash` (from the user's AI Studio rate-limit page): 5 requests per minute, 250,000 tokens per minute, 20 requests per day. About one request per session plus the odd "Write again" is far below 20 a day. When several summaries are due (after a few offline sessions), the app sends them one at a time, which keeps well under 5 a minute. The real ceiling for one request is the 250,000 tokens per minute, not the model's 1 million: at roughly 200 tokens per past session plus the earlier summaries, that's several years of history before trimming starts (ticket 22 notes it).
