import type { Poll, SessionResponse } from "../shared/api.ts";

const COLORS = ["#7ec8c3", "#e2b441", "#c89be4", "#e07a5f", "#8ecf7a", "#9bb7ff"];

export function Overlay({ session }: { session: SessionResponse }) {
  const active = session.polls.filter((poll) => poll.active);
  return (
    <div className="overlay-page">
      {active.map((poll) => (
        <PollCard key={poll.id} poll={poll} session={session} />
      ))}
    </div>
  );
}

export function PollCard({
  poll,
  session,
}: {
  poll: Poll;
  session: SessionResponse;
}) {
  const tally = session.tallies[poll.id];
  const massTotal = poll.options.reduce(
    (sum, option) => sum + (tally?.mass[option.id] ?? 0),
    0,
  );
  return (
    <article className="poll-card">
      <h3>{poll.name}</h3>
      <p className="context">{poll.context}</p>
      {poll.options.map((option, index) => {
        const mass = tally?.mass[option.id] ?? 0;
        const hard = tally?.hard[option.id] ?? 0;
        const width = massTotal > 0 ? (mass / massTotal) * 100 : 0;
        return (
          <div className="option-bar" key={option.id}>
            <div className="option-meta">
              <strong style={{ color: COLORS[index % COLORS.length] }}>
                {option.label}
              </strong>
              <span>
                {hard} hard · {mass.toFixed(2)} mass
              </span>
            </div>
            <i>
              <b
                style={{
                  width: `${width}%`,
                  background: COLORS[index % COLORS.length],
                }}
              />
            </i>
          </div>
        );
      })}
    </article>
  );
}

export { COLORS };
