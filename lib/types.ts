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

/** One item from GET /api/v3/importlist/movie */
export interface DiscoverMovie {
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
}

export type SwipeDirection = "right" | "left";

/**
 * One recorded swipe. `radarrId` is the id of the created movie (right) or
 * exclusion (left) — undo needs it to issue the matching DELETE.
 */
export interface SwipeRecord {
  tmdbId: number;
  title: string;
  year: number;
  direction: SwipeDirection;
  radarrId: number;
  at: string;
}

export interface StoreData {
  settings: Settings | null;
  history: SwipeRecord[];
}
