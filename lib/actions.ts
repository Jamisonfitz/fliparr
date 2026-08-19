import type { DeckSource, MediaType } from "./types";

/**
 * The words a swipe uses, derived from the card's origin so the buttons and the
 * drag verdict bands say what the swipe will actually do:
 *   - Radarr movie: right adds to the library, left writes a permanent exclusion.
 *   - Seerr movie/TV: right files a request, left is a reversible skip (Seerr has
 *     no exclusion list). TV requests all seasons.
 */
export function actionCopy(source: DeckSource, mediaType: MediaType) {
  const noun = mediaType === "tv" ? "series" : "film";

  if (source === "seerr") {
    return {
      rejectLabel: "Skip",
      approveLabel: mediaType === "tv" ? "Request series" : "Request movie",
      lead: `This ${noun} has been`,
      approveVerdict: "Requested",
      approveDetail: mediaType === "tv" ? "Sent to Seerr — all seasons" : "Sent to Seerr",
      rejectVerdict: "Skipped",
      rejectDetail: "Passed for now — no request made",
    };
  }

  return {
    rejectLabel: "Exclude",
    approveLabel: "Add to library",
    lead: `This ${noun} has been`,
    approveVerdict: "Approved",
    approveDetail: "For your Radarr library",
    rejectVerdict: "Excluded",
    rejectDetail: "From discover — it won't come back",
  };
}
