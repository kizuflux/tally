import type { SessionResponse } from "../shared/api.ts";
import type { ScoredLine } from "../tally/types.ts";
import { displayAuthor, displayText } from "./names.ts";

export function Watch({
  session,
  selectedId,
  onSelect,
  busy,
  author,
  hideNames,
  text,
  channel,
  onAuthor,
  onText,
  onSend,
  onPlay,
  onPlayRest,
  onConnect,
  onDisconnect,
  onChannel,
}: {
  session: SessionResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
  busy: boolean;
  author: string;
  hideNames: boolean;
  text: string;
  channel: string;
  onAuthor: (value: string) => void;
  onText: (value: string) => void;
  onSend: () => void;
  onPlay: () => void;
  onPlayRest: () => void;
  onConnect: (eventsub: boolean) => void;
  onDisconnect: () => void;
  onChannel: (value: string) => void;
}) {
  const selected =
    session.lines.find((line) => line.id === selectedId) ?? session.lines[0] ?? null;
  const popout = session.twitch.channel
    ? `https://www.twitch.tv/popout/${session.twitch.channel}/chat`
    : null;

  return (
    <div className="watch-col">
      <section className="chat" aria-label="Chat">
        <div className="section-head">
          <h2>Live chat</h2>
          <div className="top-actions">
            <button
              className="ghost"
              disabled={busy || session.seedRemaining === 0}
              onClick={onPlay}
            >
              Play next
            </button>
            <button
              className="ghost"
              disabled={busy || session.seedRemaining === 0}
              onClick={onPlayRest}
            >
              Play rest ({session.seedRemaining})
            </button>
          </div>
        </div>
        <form
          className="twitch-bar"
          onSubmit={(event) => {
            event.preventDefault();
            onConnect(session.twitch.oauthReady);
          }}
        >
          <input
            value={channel}
            onChange={(event) => onChannel(event.target.value)}
            placeholder="twitch channel"
            aria-label="Twitch channel"
          />
          <button type="submit" className="ghost" disabled={busy || !channel.trim()}>
            {session.twitch.oauthReady ? "Connect EventSub" : "Connect IRC"}
          </button>
          {session.twitch.connected && (
            <button type="button" className="ghost" onClick={onDisconnect}>
              Disconnect
            </button>
          )}
          {session.twitch.oauthConfigured ? (
            session.twitch.oauthReady ? (
              <span className="muted">Twitch signed in</span>
            ) : (
              <a className="ghost linkish" href="/api/twitch/login">
                Sign in with Twitch
              </a>
            )
          ) : null}
          {popout && (
            <a className="ghost linkish" href={popout} target="_blank" rel="noreferrer">
              Chat popout
            </a>
          )}
        </form>
        <p className="muted meta-line">
          {session.twitch.connected
            ? `${session.twitch.transport} · #${session.twitch.channel}`
            : "IRC reads public chat without login. EventSub needs Sign in."}
          {session.twitch.message ? ` · ${session.twitch.message}` : ""}
          {` · queue ${session.queue.waiting}/${session.queue.inFlight} wait/flight`}
          {session.queue.dropped ? ` · dropped ${session.queue.dropped}` : ""}
          {session.queue.lagging ? " · lagging" : ""}
        </p>
        <ul>
          {session.lines.length === 0 && (
            <li className="muted empty">Waiting for chat. Connect Twitch or play the seed.</li>
          )}
          {session.lines.map((line) => (
            <li key={line.id}>
              <button
                className={`line ${line.id === selected?.id ? "on" : ""} ${line.status}`}
                onClick={() => onSelect(line.id)}
              >
                <span className="who">{displayAuthor(line.author, hideNames)}</span>
                <span className="said">{displayText(line.text, hideNames)}</span>
                <span className="tags">{chips(line, session)}</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className={`composer${hideNames ? " names-hidden" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          {!hideNames && (
            <input
              value={author}
              onChange={(event) => onAuthor(event.target.value)}
              aria-label="Author"
              placeholder="author"
            />
          )}
          <input
            value={text}
            onChange={(event) => onText(event.target.value)}
            aria-label="Chat line"
            placeholder="type a chat line"
          />
          <button type="submit" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      </section>

      <section className="inspector">
        <h2>Last judgment</h2>
        {selected ? (
          <JudgmentDetail line={selected} session={session} hideNames={hideNames} />
        ) : (
          <p className="muted">Score a line to inspect answers.</p>
        )}
        {session.last && (
          <p className="muted meta-line">
            {session.last.model} · {session.last.questionCount} questions ·{" "}
            {session.last.latencyMs}ms · {session.last.usage.input_tokens} in
          </p>
        )}
      </section>
    </div>
  );
}

function chips(line: ScoredLine, session: SessionResponse) {
  if (line.status === "pending") return <em className="tag leaning">pending</em>;
  if (line.status === "error") return <em className="tag alert">error</em>;
  return (
    <>
      {session.polls
        .filter((poll) => poll.active)
        .map((poll) => {
          const judgment = line.byPoll[poll.id];
          if (!judgment) return null;
          const label =
            judgment.bucket === "not_a_vote"
              ? `${poll.name}: —`
              : `${poll.name}: ${optionLabel(session, poll.id, judgment.pick)}`;
          return (
            <em className={`tag ${judgment.bucket}`} key={poll.id}>
              {label}
            </em>
          );
        })}
      {Object.values(line.byPoll)
        .flatMap((judgment) => judgment.flags)
        .filter((flag) => flag.alert)
        .map((flag, index) => (
          <em className="tag alert" key={`${flag.id}-${index}`}>
            {flag.label}
          </em>
        ))}
    </>
  );
}

function JudgmentDetail({
  line,
  session,
  hideNames,
}: {
  line: ScoredLine;
  session: SessionResponse;
  hideNames: boolean;
}) {
  return (
    <>
      <p className="said">
        <strong>{displayAuthor(line.author, hideNames)}</strong>{" "}
        {displayText(line.text, hideNames)}
      </p>
      {line.status === "error" && <p className="banner error">{line.error}</p>}
      {session.polls
        .filter((poll) => line.byPoll[poll.id])
        .map((poll) => {
          const judgment = line.byPoll[poll.id]!;
          return (
            <div key={poll.id} className="judgment-block">
              <h3>{poll.name}</h3>
              <p className="muted">
                {judgment.bucket} · on-topic {judgment.onTopic.toFixed(2)} · conf{" "}
                {judgment.pickConfidence.toFixed(2)}
              </p>
              <div className="mass-list">
                {poll.options.map((option) => (
                  <div className="bar-row" key={option.id}>
                    <span>{option.label}</span>
                    <i>
                      <b
                        style={{
                          width: `${(judgment.mass[option.id] ?? 0) * 100}%`,
                        }}
                      />
                    </i>
                    <em>{(judgment.mass[option.id] ?? 0).toFixed(2)}</em>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}

function optionLabel(session: SessionResponse, pollId: string, optionId: string) {
  if (optionId === "none") return "none";
  return (
    session.polls.find((poll) => poll.id === pollId)?.options.find((option) => option.id === optionId)
      ?.label ?? optionId
  );
}
