"use client";

import { motion, type MotionValue } from "motion/react";

/**
 * The verdict overlay, styled after the band cards that open theatrical
 * trailers — the green "approved for all audiences" card and its red
 * counterpart. Same centred, letterspaced, double-ruled treatment. The words
 * come from the card's origin (see lib/actions) so it says exactly what the
 * swipe will do — add vs request, exclude vs skip.
 */

const TONE_COLOR = {
  approve: "var(--color-approved)",
  reject: "var(--color-restricted)",
} as const;

export default function VerdictBand({
  tone,
  opacity,
  lead,
  verdict,
  detail,
}: {
  tone: keyof typeof TONE_COLOR;
  opacity: MotionValue<number>;
  lead: string;
  verdict: string;
  detail: string;
}) {
  const color = TONE_COLOR[tone];

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
