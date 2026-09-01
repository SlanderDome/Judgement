import { useEffect, useRef, useState } from "react";

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path (older / non-secure contexts)
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function RoomCodeButton({ roomId }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  async function handleCopy() {
    const text = String(roomId ?? "").trim();
    if (!text) {
      return;
    }
    const ok = await copyText(text);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={`gh-item gh-room room-code-btn ${copied ? "is-copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy room code"}
      aria-label={copied ? "Room code copied to clipboard" : `Copy room code ${roomId}`}
    >
      <span className="gh-room-label">Room</span>
      <strong className="room-code">{roomId}</strong>
      <span className="room-code-tag" aria-hidden="true">
        {copied ? (
          <>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            Copied
          </>
        ) : (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
            <path d="M10.5 3.5H4a1.5 1.5 0 0 0-1.5 1.5v6.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
