export function ConnectionBadge({ isConnected }) {
  return (
    <div className={`connection-badge ${isConnected ? "online" : "offline"}`}>
      <span className="connection-dot" />
      {isConnected ? "Connected" : "Disconnected"}
    </div>
  );
}
