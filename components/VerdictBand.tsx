"use client";

import { motion, type MotionValue } from "motion/react";

/**
 * The verdict overlay, styled after the band cards that open theatrical
 * trailers — the green "approved for all audiences" card and its red
 * counterpart. Same centred, letterspaced, double-ruled treatment, saying
 * exactly what the swipe is about to do.
 */

const COPY = {
  approve: {
    lead: "This film has been",
    verdict: "Approved",
    detail: "For your Radarr library",
    color: "var(--color-approved)",
  },
  reject: {
    lead: "This film has been",
    verdict: "Excluded",
    detail: "From discover — it won't come back",
    color: "var(--color-restricted)",
  },
} as const;

export default function VerdictBand({
  tone,
  opacity,
}: {
  tone: keyof typeof COPY;
  opacity: MotionValue<number>;
}) {
  const { lead, verdict, detail, color } = COPY[tone];

  return (
    <motion.div
      aria-hidden
      style={{ opacity, backgroundColor: color }}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl px-6"
    >
      <div className="w-full max-w-[17rem] border-y-2 border-white/90 py-5 text-center">
        <div className="border-y border-white/60 py-6">
          <p className="font-data text-[0.58rem] tracking-[0.34em] text-white/85 uppercase">
            {lead}
          </p>
          <p className="font-display mt-2 text-[2rem] tracking-[0.04em] text-white uppercase">
            {verdict}
          </p>
          <p className="font-data mt-3 text-[0.55rem] leading-relaxed tracking-[0.24em] text-white/85 uppercase">
            {detail}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
