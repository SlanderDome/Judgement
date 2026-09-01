import { useCountdown } from "../lib/useCountdown.js";

// Renders just the remaining whole seconds for a server `endsAt`, ticking on its
// own so the countdown never re-renders whatever parent it sits in.
export function Seconds({ endsAt }) {
  const ms = useCountdown(endsAt);
  return Math.max(0, Math.ceil(ms / 1000));
}
