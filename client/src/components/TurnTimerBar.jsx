import { useEffect, useState } from "react";

export function TurnTimerBar({ endsAt }) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return undefined;
    }

    setRemainingMs(Math.max(0, endsAt - Date.now()));
    const intervalId = window.setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [endsAt]);

  if (!endsAt) {
    return null;
  }

  const percentage = Math.max(0, Math.min(100, (remainingMs / 20000) * 100));
  const secondsRemaining = Math.ceil(remainingMs / 1000);

  return (
    <div className="timer-wrap">
      <div className="timer-meta">
        <span>Turn timer</span>
        <strong>{secondsRemaining}s</strong>
      </div>
      <div className="timer-track" aria-hidden="true">
        <div className="timer-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
