import { useEffect } from "react";

const MOTES = [
  [12, 42, 15, -3, 2], [26, 67, 19, -11, 1], [40, 31, 13, -7, 2], [53, 52, 17, -2, 1],
  [67, 38, 21, -14, 2], [79, 61, 16, -9, 1], [33, 78, 18, -5, 2], [61, 22, 14, -12, 1]
];

export function RoomAtmosphere() {
  useEffect(() => {
    // Load after the room mounts; font families are scoped to the room, not the main menu.
    if (document.getElementById("room-concept-fonts")) return;
    const link = document.createElement("link");
    link.id = "room-concept-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap";
    document.head.append(link);
  }, []);

  return <div className="room-dust" aria-hidden="true">{MOTES.map(([x, y, duration, delay, size], index) => <i key={index} style={{ "--x": `${x}%`, "--y": `${y}%`, "--duration": `${duration}s`, "--delay": `${delay}s`, "--size": `${size}px` }} />)}</div>;
}
