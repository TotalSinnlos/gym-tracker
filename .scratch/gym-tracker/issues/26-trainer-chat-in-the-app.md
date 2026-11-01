# 26: Trainer chat in the app

**What to build:** The app side of the trainer chat, as described in the spec's "Trainer chat" section and screens. The core keeps the conversation (part of backups and restore), builds the chat brief, sends the most recent 40 messages with it to `POST /trainer/chat` (a thin network layer like `httpBackupServer.ts`), trims old sessions when the server calls it too large, and stores the reply. One message at a time; a failed message stays unanswered with "Try again", and a new message after it is sent together with it. On screen: a fifth "Trainer" area in the bottom navigation while the trainer is on, a chat button on the session screen (back arrow to the session), "Ask about this" on trainer summaries, times on each message and date lines between days, "Clear chat" with a confirmation, and the settings note mentioning chat messages.

**Blocked by:** 25 (the phone test also needs the home server updated: `docker compose up -d --build gym-backup`, as in ticket 23)

**Status:** ready-for-agent

- [ ] Sending stores the message at once and the reply when it arrives, even after leaving the screen; one message at a time
- [ ] The chat brief has all sessions and the session in progress, facts for every active exercise, the trainer summaries, the goals and notes and today's date
- [ ] Only the most recent 40 messages are sent, and the chat brief says when some were left out; a too-large chat brief is trimmed, oldest sessions first
- [ ] A failed message stays with its reason and "Try again"; a new message after it goes together with it
- [ ] Nothing is sent with the trainer off; the chat is kept and hidden
- [ ] "Clear chat" empties it after a confirmation, and a late reply is dropped
- [ ] The chat survives backup and restore; older backups without a chat still restore
- [ ] The Trainer area, the session screen's chat button and "Ask about this" open the chat as described
- [ ] Core tests cover the trainer chat items in the spec's testing decisions
- [ ] The home server is updated, ticket 25's real-AI try is done, and the chat works from the user's phone, during a session too
