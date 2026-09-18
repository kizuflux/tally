import { useState } from "react";
import type { AlertFlag, Poll, PollOption } from "../shared/api.ts";
import { MAX_ACTIVE_POLLS } from "../tally/caps.ts";
import { newFlagId, newOptionId, newPollId } from "../tally/seed.ts";

export function PollForm({
  poll,
  polls,
  busy,
  onSave,
  onResetTally,
}: {
  poll: Poll;
  polls: Poll[];
  busy: boolean;
  onSave: (polls: Poll[]) => void;
  onResetTally: (id: string) => void;
}) {
  const [draft, setDraft] = useState(poll);
  const exists = polls.some((item) => item.id === poll.id);

  function commit(next: Poll[]) {
    onSave(next);
  }

  return (
    <div className="editor">
      <label>
        Name
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) =>
            setDraft({ ...draft, active: event.target.checked })
          }
        />
        Active ({polls.filter((item) => item.active).length}/{MAX_ACTIVE_POLLS})
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.requireOnTopic}
          onChange={(event) =>
            setDraft({ ...draft, requireOnTopic: event.target.checked })
          }
        />
        Only count on-topic chats
      </label>
      <label>
        Context
        <textarea
          value={draft.context}
          rows={4}
          onChange={(event) =>
            setDraft({ ...draft, context: event.target.value })
          }
        />
      </label>
      <h3>Options</h3>
      {draft.options.map((option, index) => (
        <fieldset key={option.id}>
          <input
            value={option.label}
            aria-label={`Option ${index + 1} label`}
            onChange={(event) =>
              setDraft({
                ...draft,
                options: patchAt(draft.options, index, {
                  ...option,
                  label: event.target.value,
                }),
              })
            }
          />
          <input
            value={option.criterion}
            aria-label={`Option ${index + 1} criterion`}
            onChange={(event) =>
              setDraft({
                ...draft,
                options: patchAt(draft.options, index, {
                  ...option,
                  criterion: event.target.value,
                }),
              })
            }
          />
          {draft.options.length > 2 && (
            <button
              type="button"
              className="ghost tiny"
              onClick={() =>
                setDraft({
                  ...draft,
                  options: draft.options.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        className="ghost"
        onClick={() =>
          setDraft({
            ...draft,
            options: [
              ...draft.options,
              {
                id: newOptionId(draft.options.map((option) => option.id)),
                label: "New option",
                criterion: "What this option means.",
              } satisfies PollOption,
            ],
          })
        }
      >
        Add option
      </button>
      <h3>Alert flags</h3>
      {draft.flags.map((flag, index) => (
        <fieldset key={flag.id}>
          <label className="check">
            <input
              type="checkbox"
              checked={flag.enabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  flags: patchAt(draft.flags, index, {
                    ...flag,
                    enabled: event.target.checked,
                  }),
                })
              }
            />
            Enabled
          </label>
          <input
            value={flag.label}
            aria-label={`${flag.label} name`}
            onChange={(event) =>
              setDraft({
                ...draft,
                flags: patchAt(draft.flags, index, {
                  ...flag,
                  label: event.target.value,
                }),
              })
            }
          />
          <input
            value={flag.criterion}
            aria-label={`${flag.label} criterion`}
            onChange={(event) =>
              setDraft({
                ...draft,
                flags: patchAt(draft.flags, index, {
                  ...flag,
                  criterion: event.target.value,
                }),
              })
            }
          />
          <label className="tiny-label">
            Alert at {flag.threshold.toFixed(2)}
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={flag.threshold}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  flags: patchAt(draft.flags, index, {
                    ...flag,
                    threshold: Number(event.target.value),
                  }),
                })
              }
            />
          </label>
        </fieldset>
      ))}
      <button
        type="button"
        className="ghost"
        onClick={() =>
          setDraft({
            ...draft,
            flags: [
              ...draft.flags,
              {
                id: newFlagId(draft.flags.map((flag) => flag.id)),
                label: "Custom alert",
                criterion: "What should light up this chip.",
                threshold: 0.78,
                enabled: true,
              } satisfies AlertFlag,
            ],
          })
        }
      >
        Add flag
      </button>
      <h3>Vote bars</h3>
      {draft.requireOnTopic && (
        <label className="tiny-label">
          On-topic {draft.thresholds.onTopic.toFixed(2)}
          <input
            type="range"
            min={0.3}
            max={0.9}
            step={0.01}
            value={draft.thresholds.onTopic}
            onChange={(event) =>
              setDraft({
                ...draft,
                thresholds: {
                  ...draft.thresholds,
                  onTopic: Number(event.target.value),
                },
              })
            }
          />
        </label>
      )}
      <label className="tiny-label">
        Counted confidence {draft.thresholds.countedConfidence.toFixed(2)}
        <input
          type="range"
          min={0.3}
          max={0.9}
          step={0.01}
          value={draft.thresholds.countedConfidence}
          onChange={(event) =>
            setDraft({
              ...draft,
              thresholds: {
                ...draft.thresholds,
                countedConfidence: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <div className="top-actions modal-actions">
        <button
          className="bar-btn"
          disabled={busy}
          onClick={() =>
            commit(
              exists
                ? polls.map((item) => (item.id === draft.id ? draft : item))
                : [...polls, draft],
            )
          }
        >
          Save
        </button>
        {exists && (
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => onResetTally(draft.id)}
          >
            Reset tally
          </button>
        )}
        {exists && (
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              const copy: Poll = {
                ...draft,
                id: newPollId(polls.map((item) => item.id)),
                name: `${draft.name} copy`,
                active: false,
              };
              commit([...polls, copy]);
            }}
          >
            Duplicate
          </button>
        )}
        {exists && draft.active && (
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() =>
              commit(
                polls.map((item) =>
                  item.id === draft.id ? { ...draft, active: false } : item,
                ),
              )
            }
          >
            Archive
          </button>
        )}
        {exists && (
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() =>
              commit(polls.filter((item) => item.id !== draft.id))
            }
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function patchAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item));
}
