import { useEffect, useState } from "react";

// Ticks down to an absolute server timestamp (`endsAt`, epoch ms). The interval
// only drives the display — game correctness lives on the server. Because every
// tick recomputes from `Date.now()`, a reconnect / tab-wake resumes from the
// real remaining time instead of restarting.
export function useCountdown(endsAt) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return undefined;
    }

    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [endsAt]);

  return remainingMs;
}
