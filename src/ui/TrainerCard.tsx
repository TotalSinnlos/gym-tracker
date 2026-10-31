import { useState } from "react";
import { useAutoTrainer } from "./autoTrainer";
import { useCore } from "./CoreContext";
import { formatDateTime } from "./format";
import { Icon } from "./icons";

/**
 * A session's trainer summary: being written, written, or waiting after a failure. In History it also
 * has "Write again" ("Write summary" when there's none). Null when there's nothing to show.
 */
export function TrainerCard({ sessionId, inHistory = false }: { sessionId: string; inHistory?: boolean }) {
  const core = useCore();
  const { writingId, write } = useAutoTrainer();
  const [error, setError] = useState<string | null>(null);
  const status = core.trainerSummaryStatus(sessionId);
  const { enabled } = core.trainer();
  const writing = writingId === sessionId;

  async function writeNow() {
    setError(await write(sessionId));
  }

  let body;
  let action: { label: string; run: () => void } | null = null;
  if (writing) {
    body = (
      <p className="trainer-wait">
        Writing your summary…<span className="mut"> This can take up to a minute.</span>
      </p>
    );
  } else if (status.state === "written") {
    body = (
      <>
        <SummaryText text={status.summary.text} />
        {inHistory && <div className="li-s">Written {formatDateTime(status.summary.writtenAt)}</div>}
      </>
    );
    if (inHistory && enabled) action = { label: "Write again", run: writeNow };
  } else if (status.state === "due") {
    body = (
      <p className="trainer-wait">
        {status.lastError === null
          ? "Waiting to write your summary…"
          : status.temporary
            ? "Your summary will arrive once you're online and the AI has time."
            : `No summary yet: ${status.lastError}.`}
      </p>
    );
    if (status.lastError !== null) action = { label: "Try again", run: writeNow };
  } else {
    // No summary and none on the way: only History offers to write one.
    if (!inHistory || !enabled) return null;
    body = <p className="trainer-wait mut">This session has no trainer summary.</p>;
    action = { label: "Write summary", run: writeNow };
  }

  return (
    <section className="card trainer" aria-live="polite">
      <div className="trainer-h">Trainer</div>
      {body}
      {action && !writing && (
        <button className="btn sm out" onClick={action.run} disabled={writingId !== null}>
          {action.label}
        </button>
      )}
      {error && !writing && (
        <p className="errmsg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
    </section>
  );
}

const LABEL = /^(Going well|Keep an eye on|Suggestion):\s*(.*)$/;

/** The summary as written, with its "- " points as a list and its part names in bold. */
function SummaryText({ text }: { text: string }) {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: string[] })[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const point = /^[-*•]\s+(.*)$/.exec(line);
    if (point) {
      const last = blocks.at(-1);
      if (last?.kind === "ul") last.items.push(point[1]);
      else blocks.push({ kind: "ul", items: [point[1]] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return (
    <div className="trainer-text">
      {blocks.map((block, i) =>
        block.kind === "ul" ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <Paragraph key={i} text={block.text} />
        ),
      )}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  const label = LABEL.exec(text);
  if (!label) return <p>{text}</p>;
  return (
    <p>
      <b>{label[1]}:</b>
      {label[2] && ` ${label[2]}`}
    </p>
  );
}
