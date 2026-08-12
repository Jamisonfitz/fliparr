"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SwipeRecord } from "@/lib/types";

/**
 * Every swipe on record, newest first, each reversible on its own — so a
 * mistake twenty cards back doesn't mean pressing undo twenty times.
 */

function when(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function HistoryList() {
  const [history, setHistory] = useState<SwipeRecord[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setHistory(body.history);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function reverse(record: SwipeRecord) {
    setBusy(record.tmdbId);
    setError("");
    try {
      const res = await fetch("/api/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: record.tmdbId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't reverse that.");
      setHistory((h) => h?.filter((r) => r.tmdbId !== record.tmdbId) ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-edge px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <span className="font-display text-sm tracking-[0.28em] uppercase">
          History
        </span>
        <Link
          href="/"
          className="font-data text-[0.62rem] tracking-[0.2em] text-muted uppercase transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
        >
          Back to deck
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {error && (
          <p className="font-body mb-4 text-[0.9rem] text-restricted">{error}</p>
        )}

        {history?.length === 0 && (
          <p className="font-body text-[0.95rem] leading-relaxed text-muted">
            No swipes yet. Everything you decide shows up here.
          </p>
        )}

        <ul className="flex flex-col">
          {history?.map((record) => (
            <li
              key={`${record.tmdbId}-${record.at}`}
              className="flex items-center gap-4 border-b border-edge py-3.5 last:border-0"
            >
              <span
                aria-hidden
                className={`h-9 w-1 shrink-0 rounded-full ${
                  record.direction === "right" ? "bg-approved" : "bg-restricted"
                }`}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[0.95rem] text-screen">
                  {record.title}{" "}
                  <span className="text-muted">{record.year}</span>
                </span>
                <span className="font-data text-[0.58rem] tracking-[0.18em] text-muted uppercase">
                  {record.direction === "right" ? "Added" : "Excluded"} ·{" "}
                  {when(record.at)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void reverse(record)}
                disabled={busy !== null}
                className="font-data shrink-0 cursor-pointer rounded-full border border-edge px-3.5 py-1.5 text-[0.55rem] tracking-[0.18em] text-screen uppercase transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy === record.tmdbId ? "…" : "Reverse"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
