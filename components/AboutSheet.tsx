"use client";

import Sheet from "./Sheet";

/**
 * What changed, in plain terms. Newest first — anyone opening this wants to
 * know what's new since they last looked, not the full history of the code.
 */
const RELEASES = [
  {
    version: "1.1",
    notes: [
      "Watch a film's trailer without leaving the deck.",
      "History screen: every swipe you've made, each one reversible on its own.",
      "Optional genre filter, so you can swipe only what you're in the mood for.",
    ],
  },
  {
    version: "1.0",
    notes: [
      "Swipe through Radarr's recommendations one film at a time.",
      "Right adds it to your library and starts the search. Left excludes it for good.",
      "Undo any swipe, including the exclusion.",
      "Pick the quality profile, root folder, and monitoring that new adds use.",
    ],
  },
];

export default function AboutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="About Fliparr">
      <p className="font-body text-[0.95rem] leading-relaxed text-screen/80">
        A faster way through Radarr&apos;s Discover list. One film at a time,
        decided with a swipe.
      </p>

      <div className="mt-7 flex flex-col gap-6">
        {RELEASES.map((release) => (
          <div key={release.version}>
            <h3 className="font-data mb-2.5 text-[0.6rem] tracking-[0.24em] text-muted uppercase">
              Version {release.version}
            </h3>
            <ul className="flex flex-col gap-2">
              {release.notes.map((note) => (
                <li
                  key={note}
                  className="font-body flex gap-3 text-[0.92rem] leading-relaxed text-screen/75"
                >
                  <span aria-hidden className="text-muted">
                    —
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-edge pt-6 pb-2">
        <p className="font-data text-[0.6rem] tracking-[0.2em] text-muted uppercase">
          Built by{" "}
          <a
            href="https://github.com/Jamisonfitz"
            target="_blank"
            rel="noreferrer"
            className="text-screen underline underline-offset-4 hover:text-screen/80 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            jamisonf
          </a>
        </p>

        <a
          href="https://buymeacoffee.com/jamisonfitz"
          target="_blank"
          rel="noreferrer"
          className="font-data flex items-center justify-center gap-2.5 rounded-full border border-imdb/50 bg-imdb/10 px-5 py-3 text-[0.62rem] tracking-[0.2em] text-imdb uppercase transition-colors hover:bg-imdb/20 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
        >
          <span aria-hidden className="text-base">
            ☕
          </span>
          Buy me a coffee
        </a>
      </div>
    </Sheet>
  );
}
