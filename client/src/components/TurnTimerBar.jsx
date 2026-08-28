import { useEffect, useState } from "react";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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
    <span
      className="seat-timer"
      role="timer"
      aria-label={`${secondsRemaining} seconds remaining`}
    >
      <svg className="seat-timer-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="seat-timer-track" cx="22" cy="22" r={RADIUS} />
        <circle
          className="seat-timer-fill"
          cx="22"
          cy="22"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - percentage / 100)}
        />
      </svg>
      <span className="seat-timer-text">{secondsRemaining}s</span>
    </span>
  );
}

