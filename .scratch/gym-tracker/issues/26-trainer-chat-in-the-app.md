# 26: Trainer chat in the app

**What to build:** The app side of the trainer chat, as described in the spec's "Trainer chat" section and screens. The core keeps the conversation (part of backups and restore), builds the chat brief, sends the most recent 40 messages with it to `POST /trainer/chat` (a thin network layer like `httpBackupServer.ts`), trims old sessions when the server calls it too large, and stores the reply. One message at a time; a failed message stays unanswered with "Try again", and a new message after it is sent together with it. On screen: a fifth "Trainer" area in the bottom navigation while the trainer is on, a chat button on the session screen (back arrow to the session), "Ask about this" on trainer summaries, times on each message and date lines between days, "Clear chat" with a confirmation, and the settings note mentioning chat messages.

**Blocked by:** 25 (the phone test also needs the home server updated: `docker compose up -d --build gym-backup`, as in ticket 23)

**Status:** ready-for-agent

- [x] Sending stores the message at once and the reply when it arrives, even after leaving the screen; one message at a time
- [x] The chat brief has all sessions and the session in progress, facts for every active exercise, the trainer summaries, the goals and notes and today's date
- [x] Only the most recent 40 messages are sent, and the chat brief says when some were left out; a too-large chat brief is trimmed, oldest sessions first
- [x] A failed message stays with its reason and "Try again"; a new message after it goes together with it
- [x] Nothing is sent with the trainer off; the chat is kept and hidden
- [x] "Clear chat" empties it after a confirmation, and a late reply is dropped
- [x] The chat survives backup and restore; older backups without a chat still restore
- [x] The Trainer area, the session screen's chat button and "Ask about this" open the chat as described
- [x] Core tests cover the trainer chat items in the spec's testing decisions
- [ ] The home server is updated, ticket 25's real-AI try is done, and the chat works from the user's phone, during a session too

## Comments

**2026-11-01, built test-first (screens not yet tried in a browser; phone test open):** Agreed seams: the core's commands and queries with stand-ins for storage and the home server (`src/core/trainer.test.ts`), and the network piece with a stand-in internet (`src/storage/httpBackupServer.test.ts`); screens are checked by hand. The core keeps the trainer chat in `AppData.trainerChat` (part of backups; older backups restore with an empty chat, a damaged one is rejected). `buildChatBrief` in `src/core/trainer.ts` builds the chat brief; the per-exercise facts now work as of one session (trainer briefs) or as of today (chat briefs). Commands in `core.ts` under "Trainer chat": `trainerChat`, `trainerChatBrief`, `sendTrainerMessage`, `answerTrainerChat`, `clearTrainerChat`. The "leave out a quarter more sessions" step is now shared by trainer briefs and chat briefs.

Things the slices showed: the archived-exercise test, the backup round trip and "gives up when even the shortest chat brief is too large" passed straight away (covered by earlier slices or by code that already existed); one expected value in the facts test was my own miscount (Dips below range in 2 of 2, not 1 of 2), corrected to what the rule says before writing the code.

Screens: `src/ui/trainerChat.tsx` (draft, "a reply is on its way" and the last error while the app is open), `TrainerScreen.tsx` (the Trainer area, or a page from the session screen with a back arrow), "Ask about this" in `TrainerCard.tsx`, a chat button in the session screen's header, a fifth bottom-bar button while the trainer is on, the settings note now mentions chat messages. The "AI failed" message now says "The AI couldn't answer" (shared with trainer summaries).

Checked: 21 new tests, 279 in total; typecheck and build clean. Not yet looked at in a browser: the Chrome extension wasn't connected.

**2026-11-01, tried in Chrome on the PC** (practice data, a stand-in for the home server's answers; no real server or AI): the fifth bottom-bar button; the empty chat; sending ("Thinking…", then the reply with its points as a list, times under each message, the date line); the chat brief that was sent read correctly, and included the session in progress when asked from the session screen; a "busy" answer leaving the message "Not answered" with its reason, and "Try again" getting the reply; "Ask about this" in History filling in "About my Full body session on Fri 30 Oct: "; the session screen's chat button opening the chat without the bottom bar and the back arrow returning to the session; "Clear chat" with its confirmation. Two fixes from this: the text box sat under the messages instead of at the bottom of the screen, and the newest message ended up behind the text box; both fixed and checked again.

**2026-11-01, home server updated:** With the user's go-ahead, the agent connected over SSH from the PC (`casadeltio@192.168.86.25`, key login) and ran `docker compose up -d --build gym-backup` in `~/mediaserver`; only that container was recreated, and the log said "Trainer on, using gemini model gemini-3.6-flash". `/trainer/chat` answered 404 before and works after (ticket 25's real-AI try). Nothing else on the server changed; `.env` wasn't opened beyond reading the token inside the test command. Still open: the phone test.
