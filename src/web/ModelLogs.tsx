import { useState } from "react";
import type { ModelLog } from "../shared/api.ts";
import { redactLogRequest } from "./names.ts";

export function ModelLogs({
  logs,
  hideNames,
  busy,
  onClear,
}: {
  logs: ModelLog[];
  hideNames: boolean;
  busy: boolean;
  onClear: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(logs[0]?.id ?? null);

  return (
    <div className="logs">
      <div className="section-head">
        <p className="muted meta-line">
          {logs.length === 0
            ? "No Jev calls yet. Score a chat line to see the request and response."
            : `${logs.length} call${logs.length === 1 ? "" : "s"} (newest first)`}
        </p>
        <button
          type="button"
          className="ghost"
          disabled={busy || logs.length === 0}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <ul className="log-list">
        {logs.map((log) => {
          const open = log.id === openId;
          return (
            <li key={log.id}>
              <button
                type="button"
                className={`log-item ${open ? "on" : ""} ${log.error ? "error" : ""}`}
                onClick={() => setOpenId(open ? null : log.id)}
              >
                <strong>{log.model || "failed"}</strong>
                <span>
                  {log.questionCount} questions · {log.latencyMs}ms
                  {log.error ? ` · ${log.error}` : ""}
                </span>
                <em>{new Date(log.at).toLocaleTimeString()}</em>
              </button>
              {open && (
                <div className="log-detail">
                  <h3>Request</h3>
                  <pre>{pretty(redactLogRequest(log.request, hideNames))}</pre>
                  <h3>Response</h3>
                  <pre>
                    {log.error
                      ? log.error
                      : pretty({
                          model: log.model,
                          usage: log.usage,
                          answers: log.response?.answers,
                        })}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
