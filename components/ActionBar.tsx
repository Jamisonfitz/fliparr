"use client";

/**
 * Buttons mirror the gestures, for desktop and for anyone who'd rather tap
 * than drag. Labels use the same words as the verdict bands so the two read as
 * one vocabulary.
 */

function Button({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "reject" | "undo" | "approve";
  children: React.ReactNode;
}) {
  const size = tone === "undo" ? "size-12" : "size-16";
  const color =
    tone === "reject"
      ? "text-restricted border-restricted/45 hover:bg-restricted/12"
      : tone === "approve"
        ? "text-approved border-approved/45 hover:bg-approved/12"
        : "text-muted border-edge hover:bg-white/5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${size} ${color} flex cursor-pointer items-center justify-center rounded-full border bg-surface/60 backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

export default function ActionBar({
  onReject,
  onApprove,
  onUndo,
  canUndo,
  disabled,
}: {
  onReject: () => void;
  onApprove: () => void;
  onUndo: () => void;
  canUndo: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-7 pt-5 pb-2">
      <Button label="Exclude" tone="reject" onClick={onReject} disabled={disabled}>
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Button>

      <Button label="Undo last swipe" tone="undo" onClick={onUndo} disabled={!canUndo || disabled}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9h11a5 5 0 010 10h-4" />
          <path d="M7 5L3 9l4 4" />
        </svg>
      </Button>

      <Button label="Add to library" tone="approve" onClick={onApprove} disabled={disabled}>
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 5.7a5 5 0 00-7.1 0L12 7.1l-1.4-1.4a5 5 0 10-7.1 7.1L12 21l8.5-8.2a5 5 0 000-7.1z" />
        </svg>
      </Button>
    </div>
  );
}
