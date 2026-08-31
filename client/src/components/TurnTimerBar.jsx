import { useCountdown } from "../lib/useCountdown.js";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TurnTimerBar({ endsAt, durationMs = 20000 }) {
  const remainingMs = useCountdown(endsAt);

  if (!endsAt) {
    return null;
  }

  const span = durationMs > 0 ? durationMs : 20000;
  const percentage = Math.max(0, Math.min(100, (remainingMs / span) * 100));
  const secondsRemaining = Math.ceil(remainingMs / 1000);
  const urgencyClass = secondsRemaining <= 1 ? "is-critical" : secondsRemaining <= 5 ? "is-urgent" : secondsRemaining <= 10 ? "is-warm" : "is-calm";

  return (
    <span
      className={`seat-timer ${urgencyClass}`}
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
      <span className="seat-timer-text">{secondsRemaining <= 1 ? "1s" : `${secondsRemaining}s`}</span>
    </span>
  );
}
