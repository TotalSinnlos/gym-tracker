// The trainer chat's state while the app is open: the message being written, whether a reply is on its
// way and why the last try failed. It sits above the screens, so a reply keeps coming while the user is
// elsewhere, and "Ask about this" on a trainer summary can start a message before opening the chat.

import { type ReactNode, createContext, useContext, useState } from "react";
import type { Core } from "../core";

interface TrainerChatState {
  /** The message being written. Kept when leaving the chat. */
  draft: string;
  setDraft: (text: string) => void;
  /** A reply is on its way: Send waits, typing doesn't. */
  sending: boolean;
  /** Why the last message wasn't sent or answered, until the next try. */
  error: string | null;
  /** Sends the draft. It's cleared straight away, and put back if the message couldn't even be stored. */
  send: () => Promise<void>;
  /** Asks again for a reply to the last, unanswered message. */
  retry: () => Promise<void>;
}

const TrainerChatContext = createContext<TrainerChatState | null>(null);

export function useTrainerChat(): TrainerChatState {
  const state = useContext(TrainerChatContext);
  if (!state) throw new Error("useTrainerChat must be used inside TrainerChat");
  return state;
}

export function TrainerChat({ core, children }: { core: Core; children: ReactNode }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(action: () => Promise<void>) {
    setSending(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const text = draft;
    const before = core.trainerChat().messages.length;
    setDraft("");
    await attempt(() => core.sendTrainerMessage(text));
    // Refused before it was stored (the trainer off...): give the text back, unless something new was typed.
    if (core.trainerChat().messages.length === before) setDraft((current) => (current === "" ? text : current));
  }

  const retry = () => attempt(() => core.answerTrainerChat());

  return (
    <TrainerChatContext.Provider value={{ draft, setDraft, sending, error, send, retry }}>{children}</TrainerChatContext.Provider>
  );
}
