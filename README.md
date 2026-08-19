<div align="center">

# Fliparr

### Tinder-style swiping for Radarr movie recommendations

**Swipe right to add a movie to Radarr. Swipe left to exclude it forever.**
A self-hosted movie discovery app for your homelab, built for your phone.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-00843d.svg)](https://www.gnu.org/licenses/gpl-3.0)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Unraid](https://img.shields.io/badge/Unraid-tested-f15a2c)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![Radarr](https://img.shields.io/badge/Radarr-v3%20API-fadb4a)

<img src="docs/screenshots/deck.png" width="320" alt="Fliparr swipe deck showing a movie poster, ratings and synopsis on a phone">

</div>

---

## What is Fliparr?

Radarr's **Discover** tab is a wall of text. Every recommendation needs a
checkbox tick and a trip down to the footer bar to either add it or exclude
it, and there is no fast way to work through hundreds of them.

Fliparr turns that list into a deck of cards. One film fills your phone screen
— poster, ratings, genres, synopsis, trailer — and you decide with a swipe.

| Gesture | What happens in Radarr |
| --- | --- |
| **Swipe right** | Movie is added to your library, monitored, and a release search starts |
| **Swipe left** | Movie is written to **Import List Exclusions** — it never comes back, in Fliparr *or* in Radarr's own Discover tab |
| **Undo** | Reverses either one, up to 50 swipes deep |

Unlike "what should we watch tonight" apps, Fliparr is a **library curation
tool**. It decides what *enters* your collection, not what you play next.

---

## Features

### Swipe to decide

Drag the card and a verdict card takes over the screen, styled after the green
and red band cards that open theatrical trailers. Release past the threshold to
commit; let go early and it snaps back.

<div align="center">
<img src="docs/screenshots/swipe-approved.png" width="270" alt="Green approved verdict card shown while swiping a movie right to add it to Radarr">
<img src="docs/screenshots/swipe-excluded.png" width="270" alt="Red excluded verdict card shown while swiping a movie left to exclude it from Radarr">
</div>

### Watch the trailer without leaving the deck

Tap **Trailer** and it plays in a sheet over the deck. Radarr already supplies a
YouTube ID with the recommendation, so there is no extra lookup and no API key
to configure.

<div align="center">
<img src="docs/screenshots/trailer.png" width="320" alt="Movie trailer playing in a sheet over the Fliparr deck">
</div>

### Filter by genre

Optional and off by default. Every genre in the current deck with a live count;
picking several widens the deck rather than narrowing it, so **Horror +
Thriller** shows either.

<div align="center">
<img src="docs/screenshots/genre-filter.png" width="320" alt="Genre filter sheet listing movie genres with counts">
</div>

### Reversible history

Every swipe is recorded with what you decided and when, and each one can be
reversed on its own — a mistake twenty cards back is one tap, not twenty.

<div align="center">
<img src="docs/screenshots/history.png" width="320" alt="Fliparr swipe history listing added and excluded movies with reverse buttons">
</div>

### Connect and configure in the app

Radarr's address and API key are set in Settings with a **Test** button, so a
typo surfaces immediately instead of as a failed swipe later. Quality profile,
root folder, monitor mode, minimum availability, and search-on-add are read
live from your Radarr.

<div align="center">
<img src="docs/screenshots/settings.png" width="320" alt="Fliparr settings screen showing Radarr connection with a test button">
</div>

### Also

- **Keyboard shortcuts** on desktop — `←` exclude, `→` add, `U` undo
- **Ratings at a glance** from IMDb, Rotten Tomatoes, and Metacritic, each in
  its own colour
- **Mobile-first** dark interface designed for a phone in a dark room
- **No login, no account, no telemetry** — it talks to your Radarr and nothing else

---

## The deck refills itself

This is the part worth understanding, because it is why the queue never runs dry.

Radarr builds recommendations with a live SQL query over every movie you own,
subtracting your library and your exclusion list, capped at the top 100 and
ranked by how many of your own films recommend each candidate.

The candidate pool is far larger than 100. **Every swipe frees a slot and
promotes the next-best candidate into it.** So this is not a 100-item queue
that drains to zero — it keeps producing new material as you work. Fliparr
pulls a fresh deck automatically once you drop below 15 cards, and the **Load
more** button does it on demand.

---

## Requirements

- **Radarr v3 API** — developed and tested against Radarr **6.3.0**
- **Docker** (recommended) or **Node.js 20.9+** for a local install
- A Radarr API key: *Radarr → Settings → General → API Key*
- Some movies already in your library. Recommendations are derived from what
  you own, so a nearly empty Radarr produces a nearly empty deck.

---

## Installation

### Docker (recommended)

```bash
docker run -d \
  --name fliparr \
  --restart unless-stopped \
  -p 7979:3000 \
  --add-host host.docker.internal:host-gateway \
  -e RADARR_URL=http://host.docker.internal:7878 \
  -e RADARR_API_KEY=your_api_key_here \
  -v /path/to/appdata/fliparr:/config \
  jamisonfitz/fliparr:latest
```

Then open `http://your-server:7979`.

> **Point `RADARR_URL` at `host.docker.internal`, not your host's LAN IP.**
> When Radarr runs on the same machine, the LAN IP makes the request leave the
> bridge network and get NAT'd back in. That only works while Docker's hairpin
> rules hold — it broke here on a plain container recreate while the host itself
> could still reach Radarr fine. `host-gateway` keeps the traffic on the bridge.

### Docker Compose

```yaml
services:
  fliparr:
    image: jamisonfitz/fliparr:latest
    container_name: fliparr
    restart: unless-stopped
    ports:
      - "7979:3000"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      RADARR_URL: http://host.docker.internal:7878
      RADARR_API_KEY: your_api_key_here
      DATA_DIR: /config
    volumes:
      - /path/to/appdata/fliparr:/config
```

### Unraid

Unraid does not ship the compose plugin, so use the `docker run` command above
from **Tools → Web Terminal**, with `-v /mnt/user/appdata/fliparr:/config`.
Port **7979** sits clear of Radarr (7878), Sonarr (8989), and Prowlarr (9696).

### Build from source

```bash
git clone https://github.com/Jamisonfitz/fliparr.git
cd fliparr

# Run it directly
cp .env.example .env.local     # fill in RADARR_API_KEY
npm install
npm run dev                    # http://localhost:3000

# ...or build your own image
docker build -t fliparr:latest .
```

> The published image is public on Docker Hub as `jamisonfitz/fliparr`, so
> `docker pull jamisonfitz/fliparr` needs no login. The same image is mirrored
> to `ghcr.io/jamisonfitz/fliparr` if you prefer GHCR.

---

## Configuration

Everything is configurable in the app's **Settings** screen. Environment
variables are optional — they seed a fresh install so a container comes up
already connected. Once you save a connection in the app, the saved one wins
and changing it needs no redeploy.

| Variable | Purpose |
| --- | --- |
| `RADARR_URL` | Radarr's address, e.g. `http://192.168.0.10:7878` |
| `RADARR_API_KEY` | Radarr → Settings → General → API Key |
| `DATA_DIR` | Where the connection, settings, and history are stored. `/config` in Docker. |

Mount `DATA_DIR` as a volume or your settings and undo history reset on every
container recreate.

### Security

**Fliparr has no authentication.** Anyone who can reach the port can change
your Radarr connection and add films to your library. Keep it on your LAN, or
behind whatever reverse proxy and auth you already run for the rest of your
stack. Do not expose it directly to the internet.

The API key is stored server-side and is never sent to the browser — the
settings screen only learns whether a key is set.

---

## FAQ

**Does this replace Radarr?**
No. Fliparr is a companion interface. Radarr does all the work; Fliparr is a
faster way to answer its recommendations.

**What exactly does swiping left do?**
It writes a real entry to Radarr's Import List Exclusions — the same thing the
red **Add Exclusion** button on Radarr's Discover page does. The film is
permanently blocked from being auto-added by any import list. It is reversible
from Fliparr's history screen or from Radarr's own settings.

**Will a right swipe start downloading immediately?**
Only if **Search on add** is enabled, which it is by default. Turn it off in
Settings to add movies without hunting for a release.

**Does it support Sonarr / TV shows?**
Not today — it is on the [Roadmap](#roadmap).

**Does it work with Overseerr, Jellyseerr, or Seerr?**
Not today, but it is the next thing planned — see the [Roadmap](#roadmap).
A Seerr feed is a natural second deck: Seerr's own Discover surfaces trending
and popular titles that Radarr's library-derived recommendations never will,
and a right swipe would file a Seerr request instead of a direct Radarr add.
The wrinkle is that Seerr has no exclusion concept, so a left swipe would either
just skip the card or still write the Radarr exclusion — a design choice to
settle when the feed lands.

**Why is the first load slow?**
Radarr fetches metadata for all ~100 recommendations from TMDB on every call to
its Discover endpoint, with no caching on its side. Fliparr caches the result
for 15 minutes so you only pay that once.

**My deck is empty.**
Radarr derives recommendations from movies you already own. A small library
produces few recommendations. Adding films — or pressing **Load more** after
some swipes — gives it more to work with.

**Can I run it on a different port?**
Change the left-hand side of the port mapping, e.g. `-p 8080:3000`.

---

## How it works

Fliparr is a small Next.js app that talks to Radarr's v3 API from the server
side, so your API key never reaches the browser and there is no CORS to
configure.

Two implementation decisions worth knowing before you change `lib/radarr.ts`:

**It uses the single-item write endpoints, not the bulk ones.** Radarr's own
Discover footer posts to `POST /importlist/movie` and `POST /exclusions/bulk`.
The bulk add runs with `ignoreErrors: true` and answers `200` with an empty
array when an add is rejected — in a swipe UI that reads as success while
nothing happened. `POST /movie` returns a real `400` and hands back the created
id, which undo needs.

**Undoing an add must pass `addImportExclusion=false`.** If that ever defaults
to true, "undo" would permanently exclude the film — the exact opposite of what
the button says.

State lives in a single JSON file in `DATA_DIR`. No database.

---

## Roadmap

Fliparr does one thing well today — swiping Radarr's Discover queue. These are
the directions it is likely to grow, roughly in order:

- **Feed from Seerr (Overseerr / Jellyseerr).** Add a second deck sourced from
  Seerr's Discover — trending, popular, and upcoming titles that Radarr's
  library-derived recommendations never surface. A right swipe files a Seerr
  request (or adds straight to Radarr); the left-swipe behaviour is an open
  design question since Seerr has no exclusion list. Picking a source would be a
  toggle in Settings, so Radarr-only installs are unaffected.
- **TV via Sonarr.** The same swipe model over Sonarr's series recommendations,
  with add-and-monitor and series-level exclusions.
- **More feed sources over time** — the deck is source-agnostic internally, so
  Trakt lists and plain TMDB Discover are candidates once the Seerr path proves
  the second-source pattern.

Nothing here changes the current Radarr behaviour; new sources are opt-in.
Issues and PRs that move these along are welcome.

---

## Credits

Fliparr is glue. The hard parts belong to other people:

- **[Radarr](https://radarr.video/)** ([GitHub](https://github.com/Radarr/Radarr),
  GPL-3.0) — does all the real work: the recommendation engine, the library, the
  indexers, the downloading. Fliparr only calls its API and includes none of its
  code.
- **[TMDB](https://www.themoviedb.org/)** — every poster, backdrop, rating,
  synopsis, and trailer link.

> This product uses TMDB and the TMDB APIs but is not endorsed, certified, or
> otherwise approved by TMDB.

Built by [jamisonf](https://github.com/Jamisonfitz).
If it saved you some clicking, you can
[buy me a coffee](https://buymeacoffee.com/jamisonfitz).

---

## License

[GPL-3.0](LICENSE).

Fliparr calls Radarr over HTTP and links none of its code, so Radarr's GPL does
not propagate here — GPL-3.0 is a deliberate choice to match the licence of the
ecosystem Fliparr plugs into and to keep derivatives open.

---

<div align="center">
<sub><b>Keywords:</b> Radarr Tinder · swipe movies · Radarr recommendations ·
self-hosted movie discovery · homelab media server · Plex Jellyfin Emby
companion · arr stack · Docker Unraid movie app · import list exclusions ·
movie curation</sub>
</div>
