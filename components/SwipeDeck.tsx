"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ActionBar from "./ActionBar";
import MovieCard from "./MovieCard";
import SwipeCard from "./SwipeCard";
import type { DiscoverMovie, SwipeDirection } from "@/lib/types";

/**
 * Owns the deck: loading, swiping, undo, and refill.
 *
 * Swipes are optimistic — the card leaves immediately and comes back if Radarr
 * rejects the write, because waiting on a round trip would kill the pace.
 */

/** Under this many cards left, quietly pull a fresh deck in the background. */
const REFILL_AT = 15;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

function fanartOf(movie?: DiscoverMovie) {
  return movie?.images.find((i) => i.coverType === "fanart")?.remoteUrl;
}

export default function SwipeDeck() {
  const [deck, setDeck] = useState<DiscoverMovie[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [undoing, setUndoing] = useState(false);
  const [notice, setNotice] = useState("");

  /** A ref, not state: the refill guard never affects what's rendered. */
  const refilling = useRef(false);

  // State lands in the promise callbacks rather than the function body, so the
  // mount effect below doesn't set state synchronously and cascade a render.
  const load = useCallback(
    (refresh = false) =>
      call<{ movies: DiscoverMovie[] }>(
        `/api/deck${refresh ? "?refresh=1" : ""}`,
      )
        .then(({ movies }) => {
          setDeck(movies);
          setStatus("ready");
        })
        .catch((err: Error) => {
          setError(err.message);
          setStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const commit = useCallback(
    async (direction: SwipeDirection) => {
      const movie = deck[0];
      if (!movie) return;

      setExitDirection(direction);
      setDeck((d) => d.slice(1));
      setUndoDepth((n) => n + 1);

      try {
        await call("/api/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId: movie.tmdbId, direction }),
        });
      } catch (err) {
        // Radarr refused, so put the card back rather than losing it silently.
        setDeck((d) => [movie, ...d]);
        setUndoDepth((n) => n - 1);
        setNotice((err as Error).message);
      }
    },
    [deck],
  );

  const undo = useCallback(async () => {
    if (undoDepth === 0 || undoing) return;
    setUndoing(true);
    try {
      const { movie, warning } = await call<{
        movie?: DiscoverMovie;
        warning?: string;
      }>("/api/undo", { method: "POST" });
      if (movie) setDeck((d) => [movie, ...d]);
      setUndoDepth((n) => Math.max(0, n - 1));
      if (warning) setNotice(warning);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setUndoing(false);
    }
  }, [undoDepth, undoing]);

  // Every swipe frees a slot in Radarr's top 100, so a refresh brings genuinely
  // new titles rather than the same list again.
  useEffect(() => {
    if (
      status !== "ready" ||
      refilling.current ||
      deck.length === 0 ||
      deck.length >= REFILL_AT
    ) {
      return;
    }
    refilling.current = true;
    call<{ movies: DiscoverMovie[] }>("/api/deck?refresh=1")
      .then(({ movies }) => {
        setDeck((current) => {
          const seen = new Set(current.map((m) => m.tmdbId));
          return [...current, ...movies.filter((m) => !seen.has(m.tmdbId))];
        });
      })
      .catch(() => {
        // A failed background refill isn't worth interrupting the user for.
      })
      .finally(() => {
        refilling.current = false;
      });
  }, [deck.length, status]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") void commit("left");
      else if (event.key === "ArrowRight") void commit("right");
      else if (event.key.toLowerCase() === "u") void undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo]);

  const top = deck[0];
  const backdrop = fanartOf(top);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Ambient glow from the current film's stills — atmosphere, not content. */}
      <AnimatePresence>
        {backdrop && (
          <motion.div
            key={backdrop}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center blur-[64px]"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-pit/40 via-pit/25 to-pit/85" />

      <header className="relative z-20 flex shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <span className="font-display text-sm tracking-[0.28em] uppercase">
          Fliparr
        </span>
        <div className="flex items-center gap-4">
          <span className="font-data text-[0.6rem] tracking-[0.2em] text-muted uppercase tabular-nums">
            {status === "ready" ? `${deck.length} to go` : " "}
          </span>
          <Link
            href="/settings"
            aria-label="Settings"
            className="text-muted transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9M18.7 18.7l-1.9-1.9M7.2 7.2L5.3 5.3" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4">
        <div className="relative min-h-0 flex-1">
          {status === "loading" && <Message title="Reading Radarr" body="Pulling your recommendations. The first load takes a moment." />}

          {status === "error" && (
            <Message title="Can't reach Radarr" body={error}>
              <Action
                onClick={() => {
                  setStatus("loading");
                  void load();
                }}
              >
                Try again
              </Action>
            </Message>
          )}

          {status === "ready" && deck.length === 0 && (
            <Message
              title="Deck clear"
              body="Nothing left to judge. Radarr suggests more as your library grows."
            >
              <Action
                onClick={() => {
                  setStatus("loading");
                  void load(true);
                }}
              >
                Check again
              </Action>
            </Message>
          )}

          {status === "ready" && deck.length > 0 && (
            <>
              {/* The next card sits behind: it reads as a stack, and its
                  poster is already decoded by the time it reaches the top. */}
              {deck[1] && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 scale-[0.93] opacity-25"
                >
                  <MovieCard movie={deck[1]} />
                </div>
              )}
              <AnimatePresence initial={false} custom={exitDirection}>
                <SwipeCard
                  key={top!.tmdbId}
                  movie={top!}
                  exitDirection={exitDirection}
                  onCommit={(direction) => void commit(direction)}
                />
              </AnimatePresence>
            </>
          )}
        </div>

        <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <ActionBar
            onReject={() => void commit("left")}
            onApprove={() => void commit("right")}
            onUndo={() => void undo()}
            canUndo={undoDepth > 0}
            disabled={status !== "ready" || deck.length === 0}
          />
        </div>
      </main>

      <AnimatePresence>
        {notice && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="font-data absolute inset-x-4 bottom-28 z-30 rounded-lg border border-edge bg-surface/95 px-4 py-3 text-center text-[0.7rem] leading-relaxed tracking-[0.08em] text-screen/90 backdrop-blur"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <h2 className="font-display text-xl tracking-[0.1em] uppercase">{title}</h2>
      <p className="font-body max-w-xs text-[0.95rem] leading-relaxed text-muted">
        {body}
      </p>
      {children}
    </div>
  );
}

function Action({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-data mt-2 cursor-pointer rounded-full border border-edge px-5 py-2 text-[0.62rem] tracking-[0.2em] text-screen uppercase transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
