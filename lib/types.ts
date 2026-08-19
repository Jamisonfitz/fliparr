/** Shapes returned by Radarr v3, verified against 6.3.0.10514. */

export interface RadarrImage {
  coverType: "poster" | "fanart" | "banner" | "clearlogo" | string;
  remoteUrl?: string;
  url?: string;
}

export interface RatingValue {
  votes: number;
  value: number;
  type: string;
}

/**
 * Radarr omits sources it has no data for, and reports `votes: 0` with a real
 * value for Metacritic / Rotten Tomatoes. Every field is optional.
 */
export interface Ratings {
  imdb?: RatingValue;
  tmdb?: RatingValue;
  metacritic?: RatingValue;
  rottenTomatoes?: RatingValue;
  trakt?: RatingValue;
}

/**
 * A swipeable card. Modelled on Radarr's importlist/movie item; Seerr movie and
 * TV results are mapped into the same shape. `source` and `mediaType` are tagged
 * at load so a swipe routes to the right backend without a global lookup — which
 * is also what lets a deck mix sources (e.g. Radarr movies then a Seerr fallback).
 */
export interface DiscoverMovie {
  source: DeckSource;
  mediaType: MediaType;
  title: string;
  sortTitle: string;
  year: number;
  overview?: string;
  runtime: number;
  certification?: string;
  studio?: string;
  status?: string;
  genres: string[];
  images: RadarrImage[];
  remotePoster?: string;
  youTubeTrailerId?: string;
  tmdbId: number;
  imdbId?: string;
  ratings?: Ratings;
  popularity?: number;
  inCinemas?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  isExisting: boolean;
  isExcluded: boolean;
  isRecommendation: boolean;
  isTrending: boolean;
  isPopular: boolean;
  lists: number[];
}

export interface QualityProfile {
  id: number;
  name: string;
}

export interface RootFolder {
  id: number;
  path: string;
  freeSpace?: number;
  accessible?: boolean;
}

/** Radarr's ImportListExclusion resource. */
export interface Exclusion {
  id: number;
  tmdbId: number;
  movieTitle: string;
  movieYear: number;
}

/** Subset of the movie resource we care about from POST /api/v3/movie. */
export interface AddedMovie {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  qualityProfileId: number;
  rootFolderPath?: string;
  monitored: boolean;
}

export type MonitorOption =
  | "movieOnly"
  | "movieAndCollection"
  | "none";

export type MinimumAvailability =
  | "announced"
  | "inCinemas"
  | "released";

/** User-editable settings, persisted to $DATA_DIR/fliparr.json. */
export interface Settings {
  qualityProfileId: number;
  rootFolderPath: string;
  minimumAvailability: MinimumAvailability;
  monitor: MonitorOption;
  searchOnAdd: boolean;
  /** Which feed the movie deck pulls from. The Radarr fields above only apply when this is "radarr". */
  source: DeckSource;
  /** How many seasons a TV right-swipe requests from Seerr. */
  tvSeasons: SeasonStrategy;
}

export type SwipeDirection = "right" | "left";

/** Where the deck comes from. Radarr's recommendations, or Seerr's endless discover feed. */
export type DeckSource = "radarr" | "seerr";

/** What a card is. Movies come from Radarr or Seerr; TV comes from Seerr only. */
export type MediaType = "movie" | "tv";

/**
 * How many seasons a TV right-swipe requests. A settings default rather than a
 * per-swipe prompt, so swiping stays fast. `all` needs no lookup; `latest`/
 * `first` resolve to a season number from Seerr's show detail.
 */
export type SeasonStrategy = "all" | "latest" | "first";

/**
 * One recorded swipe. `radarrId` is the id undo issues its DELETE against — the
 * created movie (radarr right), the exclusion (radarr left), or the Seerr
 * request (seerr right). A seerr left is a plain skip with no id (0).
 * `source` is optional so history written before Seerr existed still undoes.
 */
export interface SwipeRecord {
  tmdbId: number;
  title: string;
  year: number;
  direction: SwipeDirection;
  radarrId: number;
  source?: DeckSource;
  mediaType?: MediaType;
  at: string;
}

/** Where Radarr (or Seerr) lives. Set in the app, or seeded from env on first run. */
export interface Connection {
  url: string;
  apiKey: string;
}

export interface StoreData {
  settings: Settings | null;
  connection: Connection | null;
  seerr: Connection | null;
  history: SwipeRecord[];
}

/** A minimum-score gate the deck applies client-side. `any` is off. */
export interface RatingFilter {
  source: "any" | "imdb" | "rottenTomatoes" | "metacritic" | "tmdb";
  min: number;
}
