"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/**
 * Bottom sheet used for the trailer and the genre filter. Slides up over the
 * deck rather than navigating away, so you never lose your place.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Hidden from assistive tech: it duplicates the close button below,
              and Escape already covers keyboard users. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="relative max-h-[85%] overflow-y-auto rounded-t-2xl border-t border-edge bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-edge bg-surface px-5 py-4">
              <h2 className="font-data text-[0.62rem] tracking-[0.24em] text-muted uppercase">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()}`}
                className="cursor-pointer text-muted transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="px-5 pt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
