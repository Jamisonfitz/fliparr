"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import MovieCard from "./MovieCard";
import VerdictBand from "./VerdictBand";
import { actionCopy } from "@/lib/actions";
import type { DiscoverMovie, SwipeDirection } from "@/lib/types";

/**
 * The draggable top card. Each card owns its own x motion value, so the one
 * flying out animates from where the finger left it while the card behind
 * starts clean at zero.
 */

/** Past this many pixels, releasing commits the swipe. */
const COMMIT_PX = 110;

/** A fast flick commits early, even from a short drag. */
const COMMIT_VELOCITY = 550;

export default function SwipeCard({
  movie,
  exitDirection,
  onCommit,
  onPlayTrailer,
}: {
  movie: DiscoverMovie;
  exitDirection: SwipeDirection | null;
  onCommit: (direction: SwipeDirection) => void;
  onPlayTrailer: () => void;
}) {
  const copy = actionCopy(movie.source, movie.mediaType);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], reduceMotion ? [0, 0] : [-13, 13]);

  // Fully opaque by the time the drag reaches the commit threshold.
  const approve = useTransform(x, [30, COMMIT_PX], [0, 1]);
  const reject = useTransform(x, [-COMMIT_PX, -30], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0"
      custom={exitDirection}
      variants={{
        exit: (direction: SwipeDirection | null) => ({
          x: direction === "left" ? -700 : 700,
          opacity: 0,
          rotate: direction === "left" ? -22 : 22,
          transition: { duration: reduceMotion ? 0.01 : 0.32, ease: "easeOut" },
        }),
      }}
      exit="exit"
    >
      <motion.div
        className="absolute inset-0"
        style={{ x, rotate }}
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: -COMMIT_PX, right: COMMIT_PX }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const flicked = Math.abs(info.velocity.x) > COMMIT_VELOCITY;
          const dragged = Math.abs(info.offset.x) > COMMIT_PX;
          if (!flicked && !dragged) return;
          onCommit(info.offset.x > 0 ? "right" : "left");
        }}
      >
        <MovieCard movie={movie} onPlayTrailer={onPlayTrailer} />
      </motion.div>

      {/* Outside the dragged element on purpose: the band stays put and fills
          the frame while the card slides under it, so it never drifts
          off-centre or clips at the card's edge. */}
      <VerdictBand
        tone="approve"
        opacity={approve}
        lead={copy.lead}
        verdict={copy.approveVerdict}
        detail={copy.approveDetail}
      />
      <VerdictBand
        tone="reject"
        opacity={reject}
        lead={copy.lead}
        verdict={copy.rejectVerdict}
        detail={copy.rejectDetail}
      />
    </motion.div>
  );
}
