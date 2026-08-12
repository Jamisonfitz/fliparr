"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AboutSheet from "./AboutSheet";
import ActionBar from "./ActionBar";
import GenreSheet from "./GenreSheet";
import MovieCard from "./MovieCard";
import SwipeCard from "./SwipeCard";
import TrailerSheet from "./TrailerSheet";
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
  const [genres, setGenres] = useState<string[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [trailer, setTrailer] = useState<DiscoverMovie | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** A ref, not state: the refill guard never affects what's rendered. */
  const refilling = useRef(false);

  /**
   * What's actually on screen. `deck` stays whole so the filter is reversible
   * and the refill below can key off the real card count — filtering to a thin
   * genre shouldn't trigger a refetch on every swipe.
   */
  const visible = useMemo(
    () =>
      genres.length === 0
        ? deck
        : deck.filter((m) => m.genres.some((g) => genres.includes(g))),
    [deck, genres],
  );

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
      // The top of what's on screen, which the filter may have narrowed.
      const movie = visible[0];
      if (!movie) return;

      setExitDirection(direction);
      setDeck((d) => d.filter((m) => m.tmdbId !== movie.tmdbId));
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
    [visible],
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

  /** Appends only titles the deck hasn't seen, so a refetch can't duplicate cards. */
  const mergeNew = useCallback((movies: DiscoverMovie[]) => {
    setDeck((current) => {
      const seen = new Set(current.map((m) => m.tmdbId));
      return [...current, ...movies.filter((m) => !seen.has(m.tmdbId))];
    });
  }, []);

  /** The header button. Same refetch as the automatic refill, asked for by hand. */
  const loadMore = useCallback(async () => {
    if (refilling.current) return;
    refilling.current = true;
    setLoadingMore(true);
    try {
      const { movies } = await call<{ movies: DiscoverMovie[] }>(
        "/api/deck?refresh=1",
      );
      const known = new Set(deck.map((m) => m.tmdbId));
      const fresh = movies.filter((m) => !known.has(m.tmdbId));
      mergeNew(movies);
      // Say so rather than leaving the button looking broken. Radarr only
      // promotes new candidates once swipes free up slots in its top 100.
      setNotice(
        fresh.length
          ? `Added ${fresh.length} more.`
          : "Nothing new yet — Radarr suggests more as you keep swiping.",
      );
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      refilling.current = false;
      setLoadingMore(false);
    }
  }, [deck, mergeNew]);

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
      .then(({ movies }) => mergeNew(movies))
      .catch(() => {
        // A failed background refill isn't worth interrupting the user for.
      })
      .finally(() => {
        refilling.current = false;
      });
  }, [deck.length, status, mergeNew]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // A sheet is a modal: arrows shouldn't swipe the deck behind it.
      if (genreOpen || aboutOpen || trailer) return;
      if (event.key === "ArrowLeft") void commit("left");
      else if (event.key === "ArrowRight") void commit("right");
      else if (event.key.toLowerCase() === "u") void undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo, genreOpen, aboutOpen, trailer]);

  const top = visible[0];
  const backdrop = fanartOf(top);
  const filtered = genres.length > 0;

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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={status !== "ready" || loadingMore}
            className="font-data mr-1 cursor-pointer rounded-full border border-edge px-3 py-1.5 text-[0.55rem] tracking-[0.18em] text-muted uppercase transition-colors hover:border-muted hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingMore ? "Loading" : "Load more"}
          </button>
          <button
            type="button"
            onClick={() => setGenreOpen(true)}
            aria-label="Filter by genre"
            className={`cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none ${
              filtered ? "text-screen" : "text-muted hover:text-screen"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M3 6h18M6.5 12h11M10 18h4" />
            </svg>
          </button>

          <Link
            href="/history"
            aria-label="Swipe history"
            className="text-muted transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.8" />
              <path d="M12 7.4V12l3.1 1.9" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About Fliparr"
            className="cursor-pointer text-muted transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <circle cx="12" cy="12" r="8.8" />
              <path d="M12 10.8v5.4" />
              <circle cx="12" cy="7.9" r="0.5" fill="currentColor" />
            </svg>
          </button>

          <Link
            href="/settings"
            aria-label="Settings"
            className="text-muted transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

          {status === "ready" && visible.length === 0 && filtered && (
            <Message
              title="Nothing in that genre"
              body={`No ${genres.join(" or ").toLowerCase()} left in the deck. ${deck.length} other cards are waiting.`}
            >
              <Action onClick={() => setGenres([])}>Clear filter</Action>
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

          {status === "ready" && visible.length > 0 && (
            <>
              {/* The next card sits behind: it reads as a stack, and its
                  poster is already decoded by the time it reaches the top. */}
              {visible[1] && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 scale-[0.93] opacity-25"
                >
                  <MovieCard movie={visible[1]} />
                </div>
              )}
              <AnimatePresence initial={false} custom={exitDirection}>
                <SwipeCard
                  key={top!.tmdbId}
                  movie={top!}
                  exitDirection={exitDirection}
                  onCommit={(direction) => void commit(direction)}
                  onPlayTrailer={() => setTrailer(top!)}
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
            disabled={status !== "ready" || visible.length === 0}
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

      <GenreSheet
        open={genreOpen}
        onClose={() => setGenreOpen(false)}
        deck={deck}
        selected={genres}
        onChange={setGenres}
      />

      <TrailerSheet movie={trailer} onClose={() => setTrailer(null)} />

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
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
