export function ConnectionBadge({ isConnected }) {
  return (
    <div
      className={`connection-dot-badge ${isConnected ? "is-connected" : "is-disconnected"}`}
      title={isConnected ? "Server connected" : "Connecting to server"}
    >
      <span className="connection-dot" aria-hidden="true" />
      <span className="connection-text">{isConnected ? "Connected" : "Connecting"}</span>
    </div>
  );
}
