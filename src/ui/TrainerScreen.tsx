import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { type ChatMessage, localDate } from "../core";
import { MainArea } from "./BottomNav";
import { useCore } from "./CoreContext";
import { formatDay, formatTime } from "./format";
import { Icon } from "./icons";
import { TrainerText } from "./TrainerCard";
import { useTrainerChat } from "./trainerChat";

/**
 * The trainer chat: one ongoing conversation, newest at the bottom, with the text box under it. It's the
 * Trainer area, or with `onBack` a page opened from the session screen, with a back arrow to it.
 */
export function TrainerScreen({ onBack }: { onBack?: () => void }) {
  const core = useCore();
  const { messages, unanswered } = core.trainerChat();
  const { enabled } = core.trainer();
  const chat = useTrainerChat();
  const [clearing, setClearing] = useState(false);
  // Keep the newest message in view: on opening (after the app scrolls a new screen to the top) and on each
  // new one. Scrolling to the very bottom keeps it clear of the text box, which sticks to the bottom.
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, chat.sending]);

  async function clear() {
    await core.clearTrainerChat();
    setClearing(false);
  }

  const content = (
    <>
      <div className="page area chat-page">
        <div className="chat-head">
          <div>
            <h1 className="h1">Trainer</h1>
            <div className="page-sub">Knows your sessions, its summaries and your goals and notes.</div>
          </div>
          {messages.length > 0 && (
            <button className="btn sm txt" onClick={() => setClearing(true)} disabled={chat.sending}>
              Clear chat
            </button>
          )}
        </div>

        {!enabled ? (
          <p className="body mut">Turn on the trainer in settings to chat with it.</p>
        ) : messages.length === 0 && !chat.sending ? (
          <div className="nothing area-empty">
            <h2 className="nothing-t">Ask your trainer.</h2>
            <p className="body mut">
              For example why an exercise has stalled, whether to change a routine, or what to do when a machine is taken.
              Answers can take up to a minute.
            </p>
          </div>
        ) : (
          <div className="chat" aria-live="polite">
            {messages.map((message, i) => (
              <Message key={message.id} message={message} newDay={i === 0 || !sameDay(messages[i - 1].at, message.at)} />
            ))}
            {chat.sending ? (
              <div className="msg ai wait">
                Thinking…<span className="mut"> This can take up to a minute.</span>
              </div>
            ) : (
              unanswered && (
                <div className="chat-unanswered">
                  <p className="errmsg" role="alert">
                    <Icon name="error" />
                    {chat.error ? `Not answered: ${chat.error}.` : "Not answered."}
                  </p>
                  <button className="btn sm out" onClick={chat.retry}>
                    Try again
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {enabled && <Composer />}

      {clearing && (
        <>
          <div className="scrim" onClick={() => setClearing(false)} />
          <div className="dlg" role="alertdialog" aria-labelledby="clear-chat-title">
            <div className="dlg-t" id="clear-chat-title">
              Clear the chat?
            </div>
            <div className="dlg-b">The trainer forgets this conversation. Your sessions, summaries and goals and notes stay.</div>
            <button className="btn lg out" onClick={() => setClearing(false)}>
              Keep it
            </button>
            <button className="btn lg dng" onClick={clear}>
              Clear
            </button>
          </div>
        </>
      )}
    </>
  );

  if (!onBack) return <MainArea area="trainer">{content}</MainArea>;
  return <SubPage onBack={onBack}>{content}</SubPage>;
}

/** The chat opened from the session screen: no bottom navigation, a back arrow to the session. */
function SubPage({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="top">
        <button className="ib" aria-label="Back to your session" onClick={onBack}>
          <Icon name="back" />
        </button>
      </div>
      {children}
    </main>
  );
}

function Message({ message, newDay }: { message: ChatMessage; newDay: boolean }) {
  const mine = message.role === "user";
  return (
    <>
      {newDay && <div className="chat-day">{formatDay(message.at)}</div>}
      <div className={mine ? "msg me" : "msg ai"}>
        {mine ? message.text : <TrainerText text={message.text} />}
        <div className="msg-time num">{formatTime(message.at)}</div>
      </div>
    </>
  );
}

/** The text box and "Send", kept at the bottom. Enter makes a new line; "Send" (or Ctrl+Enter) sends. */
function Composer() {
  const chat = useTrainerChat();
  const { unanswered } = useCore().trainerChat();
  const canSend = chat.draft.trim() !== "" && !chat.sending;
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // "Ask about this" fills in the start of a message: put the cursor at its end, ready to type.
  useEffect(() => {
    const box = boxRef.current;
    if (box && chat.draft !== "") {
      box.focus({ preventScroll: true });
      box.setSelectionRange(chat.draft.length, chat.draft.length);
    }
  }, []); // Only when the chat opens.

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) void chat.send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event);
  }

  return (
    <form className="dock push-down chat-compose" onSubmit={submit}>
      {/* A failed reply shows with its message; here only a message that couldn't be sent at all. */}
      {chat.error && !chat.sending && !unanswered && (
        <p className="errmsg" role="alert">
          <Icon name="error" />
          {chat.error}
        </p>
      )}
      <div className="chat-row">
        <textarea
          ref={boxRef}
          className="in area chat-in"
          value={chat.draft}
          onChange={(e) => chat.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message your trainer"
          aria-label="Message your trainer"
          rows={1}
        />
        <button type="submit" className="btn pri chat-send" disabled={!canSend}>
          Send
        </button>
      </div>
    </form>
  );
}

const sameDay = (a: string, b: string) => localDate(a) === localDate(b);
