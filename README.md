# Fliparr

Swipe through Radarr's Discover recommendations.

Radarr's **Movies → Discover** tab is a dense alphabetical list: every movie
needs a checkbox tick and a trip down to the footer bar to either add it or
exclude it. Fliparr turns that into a deck. One movie fills the screen — poster,
ratings, genres, synopsis — and you decide with a swipe.

- **Swipe right** — adds the movie to Radarr, monitored, and starts a search.
- **Swipe left** — writes a real import list exclusion, so it never comes back
  here *or* in Radarr's own Discover tab.
- **Undo** — reverses the last swipe, up to 50 deep.

Arrow keys work on desktop (`←` exclude, `→` add, `u` undo).

## The deck refills itself

Radarr builds its recommendations from a live query over every movie you own,
subtracting your library and your exclusion list, capped at the top 100. The
candidate pool is much larger than that — so each swipe frees a slot and
promotes the next-best candidate. Fliparr pulls a fresh deck once you're under
15 cards left, which is why the queue keeps producing new material instead of
draining to zero.

## Configuration

Everything is set in the app's own **Settings** screen: Radarr's address and
API key (with a **Test** button), then quality profile, root folder, monitor
mode, minimum availability, and search-on-add. The profile and root folder
choices are read live from your Radarr.

Environment variables are optional. They seed a fresh install so a container
comes up already connected; once you save a connection in the app, the saved
one wins and changing it needs no redeploy.

| Variable | What it's for |
| --- | --- |
| `RADARR_URL` | Radarr's address, e.g. `http://192.168.0.10:7878` |
| `RADARR_API_KEY` | Radarr → Settings → General → API Key |
| `DATA_DIR` | Where the connection, settings, and history are written. `/config` in Docker. |

The API key stays server-side. It is never sent back to the browser — the
settings screen only learns whether a key is set, and saving with a blank key
keeps the existing one.

**Fliparr has no login.** Anyone who can reach the port can change your Radarr
connection and add films. Keep it on your LAN or behind whatever proxy and auth
you already run.

## Running it

Local development:

```bash
cp .env.example .env.local   # fill in RADARR_API_KEY
npm install
npm run dev
```

Docker:

```bash
docker build -t fliparr:latest .
docker run -d --name fliparr --restart unless-stopped \
  -p 7979:3000 \
  --add-host host.docker.internal:host-gateway \
  -e RADARR_URL=http://host.docker.internal:7878 \
  -e RADARR_API_KEY=your_key_here \
  -v /mnt/user/appdata/fliparr:/config \
  fliparr:latest
```

**Point `RADARR_URL` at `host.docker.internal`, not the host's LAN address.**
When Radarr runs on the same box, the LAN IP makes the request leave the
bridge network and get NAT'd back in — it only works while Docker's hairpin
rules hold, and it broke here on a plain container recreate while the host
itself could still reach Radarr fine. `host-gateway` keeps the traffic on the
bridge.

Then open `http://your-server:7979` on your phone.

`docker-compose.yml` is equivalent, if you have the compose plugin — Unraid
does not ship with it by default.

## Notes for anyone changing this

Two decisions worth knowing before you touch `lib/radarr.ts`:

**It uses the single-item write endpoints, not the bulk ones.** Radarr's own
Discover footer posts to `POST /importlist/movie` and `POST /exclusions/bulk`.
The bulk add runs with `ignoreErrors: true` and answers `200` with an empty
array when an add is rejected — in a swipe UI that reads as success while
nothing happened. `POST /movie` returns a real `400` and hands back the created
id, which undo needs.

**The Discover response is cached for 15 minutes.** Radarr's controller does an
uncached bulk TMDb lookup for all ~100 recommendation ids on every single
request, so the upstream call can take up to a minute. Never call
`getDiscoverMovies()` straight from a request path; go through `lib/deck.ts`.

Also: undoing an add must pass `addImportExclusion=false`. If it ever defaults
to true, "undo" would permanently exclude the movie — the exact opposite of
what it says on the button.
