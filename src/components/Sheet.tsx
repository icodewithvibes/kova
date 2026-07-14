import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import "./Sheet.css";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet (mobile) / centered dialog (desktop). Dark glass is allowed here. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="kv-sheet__root">
          <motion.button
            className="kv-sheet__backdrop"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          />
          <motion.div
            ref={panelRef}
            className="kv-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 48 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0.28, 1] }}
          >
            <header className="kv-sheet__header">
              <h2 className="kv-heading">{title}</h2>
              <button className="kv-btn kv-btn--ghost" onClick={onClose} aria-label="Close sheet">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="kv-sheet__body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
