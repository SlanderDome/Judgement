import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function ConfirmLeaveModal({ open, onCancel, onConfirm }) {
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setLeaving(false);
      leavingRef.current = false;
      return undefined;
    }

    cancelRef.current?.focus();

    function handleKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  function handleConfirm() {
    // Synchronous guard — three rapid clicks in one tick must not fire onConfirm thrice.
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    onConfirm();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={(event) => {
            // Backdrop press closes the modal — it never leaves the game.
            if (event.target === event.currentTarget) {
              onCancel();
            }
          }}
        >
          <motion.div
            className="overlay-card confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-leave-title"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
          >
            <div className="overlay-head">
              <div>
                <h2 id="confirm-leave-title">Leave game?</h2>
                <p className="confirm-body">Are you sure you want to leave this game?</p>
              </div>
            </div>

            <div className="overlay-actions">
              <button
                type="button"
                className="btn-ghost"
                ref={cancelRef}
                onClick={onCancel}
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirm}
                disabled={leaving}
              >
                {leaving ? "Leaving…" : "Leave game"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
