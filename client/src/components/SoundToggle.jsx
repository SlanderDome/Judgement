import { useState } from "react";
import { isSfxEnabled, playSfx, setSfxEnabled } from "../lib/sfx.js";

function SpeakerOn() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5h3l4-3v11l-4-3H4z" fill="currentColor" stroke="none" />
      <path d="M13.5 7.2a4 4 0 0 1 0 5.6" />
      <path d="M15.8 5.2a7 7 0 0 1 0 9.6" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5h3l4-3v11l-4-3H4z" fill="currentColor" stroke="none" />
      <path d="M14 8l4 4M18 8l-4 4" />
    </svg>
  );
}

export function SoundToggle() {
  const [enabled, setEnabled] = useState(() => isSfxEnabled());

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSfxEnabled(next);
    if (next) {
      playSfx("select");
    }
  }

  return (
    <button
      type="button"
      className={`gh-item sound-toggle ${enabled ? "" : "is-muted"}`}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute sound effects" : "Unmute sound effects"}
      title={enabled ? "Mute sound" : "Unmute sound"}
    >
      {enabled ? <SpeakerOn /> : <SpeakerOff />}
    </button>
  );
}
