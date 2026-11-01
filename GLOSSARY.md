# Gym Tracker

An offline phone app for logging gym sessions and following a simple progression rule, with an optional AI trainer reached through the user's own home server.

## AI trainer

**Trainer**:
The optional AI that looks at the user's training and gives advice, as trainer summaries and in the trainer chat. It only advises; it never changes anything in the app.
_Avoid_: coach, AI coach, assistant

**Trainer summary**:
The trainer's short written review of one finished session, kept with that session.
_Avoid_: summary (on its own), review, AI summary

**Trainer chat**:
The one ongoing conversation between the user and the trainer.
_Avoid_: conversation, thread, chats (there is only one)

**Trainer brief**:
Everything the trainer is given to write one session's trainer summary: the training up to and including that session, earlier trainer summaries and the goals and notes.
_Avoid_: prompt, context

**Chat brief**:
Everything the trainer is given with each message in the trainer chat: the training as of now (including a session in progress), all trainer summaries, the goals and notes and today's date.
_Avoid_: prompt, context, trainer brief (that one is about a single session)

**Goals and notes**:
What the user tells the trainer about themselves, such as goals and injuries. Both trainer briefs and chat briefs include it.
_Avoid_: goals (on its own), profile

**Home server**:
The user's own computer that stores server backups and passes the trainer's requests on to the AI, which keeps the AI key off the phone.
_Avoid_: backend, cloud, backup server

## Sessions

**End-of-session summary**:
The screen shown after ending a session, listing what was done, skipped and earned, before any trainer summary arrives.
_Avoid_: summary (on its own), results
