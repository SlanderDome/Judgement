import { PlayerSeat } from "./PlayerSeat.jsx";
import { SEAT_COUNT, seatedPlayers } from "../lib/seats.js";

// Seat i sits on the table's perimeter, seat 0 at top-centre, going clockwise.
// We emit a unit vector; the CSS multiplies it by the table's --seat-radius-*,
// so the ring can be re-proportioned per breakpoint without touching JS.
function seatVars(index, total) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    "--seat-x": Math.cos(angle).toFixed(4),
    "--seat-y": Math.sin(angle).toFixed(4)
  };
}

export function CircularTable({
  roomState,
  clientPlayerId,
  canSit,
  isSeated,
  dealerPlayerId,
  currentTurnPlayerId,
  recentlyActedPlayerId,
  timerEndsAt,
  timerDurationMs,
  onTakeSeat,
  centerSlot
}) {
  const total = roomState.seatCount ?? SEAT_COUNT;
  const bySeat = new Map(seatedPlayers(roomState).map((player) => [player.seatIndex, player]));
  const seats = Array.from({ length: total }, (_value, index) => index);

  return (
    <div className="poker-table" role="group" aria-label="Table seats">
      <div className="poker-table__felt" aria-hidden="true" />
      <div className="poker-table__center">{centerSlot}</div>

      {seats.map((seatIndex) => {
        const occupant = bySeat.get(seatIndex);

        return (
          <div className="table-seat" key={seatIndex} style={seatVars(seatIndex, total)}>
            {occupant ? (
              <PlayerSeat
                player={occupant}
                isClient={occupant.playerId === clientPlayerId}
                isTurn={occupant.playerId === currentTurnPlayerId}
                isDealer={occupant.playerId === dealerPlayerId}
                isRecentlyActed={occupant.playerId === recentlyActedPlayerId}
                isDimmed={!occupant.isOnline}
                timerEndsAt={occupant.playerId === currentTurnPlayerId ? timerEndsAt : null}
                timerDurationMs={timerDurationMs}
              />
            ) : canSit ? (
              <button
                type="button"
                className={`seat-sit ${isSeated ? "seat-sit--move" : ""}`}
                onClick={() => onTakeSeat(seatIndex)}
                aria-label={isSeated ? `Move to seat ${seatIndex + 1}` : `Take seat ${seatIndex + 1}`}
              >
                <span className="seat-sit__label">SIT</span>
                <span className="seat-sit__num">{seatIndex + 1}</span>
              </button>
            ) : (
              <div className="seat-empty" aria-hidden="true">
                <span className="seat-empty__num">{seatIndex + 1}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
