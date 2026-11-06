export function ConnectionBadge({ status }) {
  const connected = status === "connected";
  const label = connected ? "Connected" : status === "conflict" ? "Session conflict" : "Reconnecting";
  return (
    <div
      className={`connection-dot-badge ${connected ? "is-connected" : "is-disconnected"}`}
      title={label}
      role="status"
      aria-live="polite"
    >
      <span className="connection-dot" aria-hidden="true" />
      <span className="connection-text">{label}</span>
    </div>
  );
}
