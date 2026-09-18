import type { Poll, SessionResponse } from "../shared/api.ts";
import { PollCard } from "./PollCard.tsx";

export function Polls({
  session,
  busy,
  onNew,
  onEdit,
  onResetTally,
}: {
  session: SessionResponse;
  busy: boolean;
  onNew: () => void;
  onEdit: (poll: Poll) => void;
  onResetTally: (id: string) => void;
}) {
  return (
    <section className="polls-col" aria-label="Polls">
      <div className="section-head">
        <h2>Polls</h2>
        <button className="ghost" disabled={busy} onClick={onNew}>
          New poll
        </button>
      </div>
      {session.polls.length === 0 && (
        <p className="muted">No polls yet. Create one to start scoring chat.</p>
      )}
      {session.polls.map((poll) => (
        <div key={poll.id} className={`poll-wrap ${poll.active ? "" : "off"}`}>
          <PollCard poll={poll} session={session} />
          <div className="poll-actions">
            <span className="muted">{poll.active ? "active" : "archived"}</span>
            <button
              type="button"
              className="ghost tiny"
              disabled={busy}
              onClick={() => onEdit(poll)}
            >
              Edit
            </button>
            <button
              type="button"
              className="ghost tiny"
              disabled={busy}
              onClick={() => onResetTally(poll.id)}
            >
              Reset tally
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
