# Fliparr

### Tinder-style swiping for Radarr movie recommendations

**Swipe right to add a movie to Radarr. Swipe left to exclude it forever.**
A self-hosted movie discovery app for your homelab, built for your phone.

![Fliparr swipe deck](https://raw.githubusercontent.com/Jamisonfitz/fliparr/main/docs/screenshots/deck.png)

---

## What is Fliparr?

Radarr's **Discover** tab is a wall of text — every recommendation needs a
checkbox tick and a trip down to the footer bar to add or exclude it. Fliparr
turns that list into a deck of cards. One film fills your phone screen — poster,
ratings, genres, synopsis, trailer — and you decide with a swipe.

| Gesture | What happens in Radarr |
| --- | --- |
| **Swipe right** | Movie is added to your library, monitored, and a release search starts |
| **Swipe left** | Movie is written to **Import List Exclusions** — it never comes back, in Fliparr *or* in Radarr's own Discover tab |
| **Undo** | Reverses either one, up to 50 swipes deep |

It's a **library curation tool**: it decides what *enters* your collection, not
what you play tonight. Watch trailers in a sheet without leaving the deck, filter
by genre, and review a reversible history of every decision. Mobile-first, dark,
no login, no account, no telemetry — it talks to your Radarr and nothing else.

---

## Quick start

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

Then open `http://your-server:7979`. Radarr's address and API key can also be
set (with a **Test** button) in the app's Settings screen.

> **Point `RADARR_URL` at `host.docker.internal`, not your host's LAN IP** when
> Radarr is on the same machine — the LAN IP leaves the bridge network and can
> break on a container recreate. `host-gateway` keeps the traffic on the bridge.

| Variable | Purpose |
| --- | --- |
| `RADARR_URL` | Radarr's address, e.g. `http://192.168.0.10:7878` |
| `RADARR_API_KEY` | Radarr → Settings → General → API Key |
| `DATA_DIR` | Where the connection, settings, and history are stored. `/config` in Docker. |

**Requires** a Radarr v3 instance (tested against 6.3.0) with some movies already
in the library — recommendations are derived from what you own.

**Security:** Fliparr has no authentication. Keep it on your LAN or behind your
existing reverse proxy and auth. The API key is stored server-side and is never
sent to the browser.

---

## Tags

- `latest` — most recent release from `main`
- `1.2`, `v1.2.0` — pinned semver
- Also mirrored to `ghcr.io/jamisonfitz/fliparr`

---

## Links & credits

- **Source, full docs, and issues:** https://github.com/Jamisonfitz/fliparr
- **[Radarr](https://radarr.video/)** does all the real work; Fliparr only calls
  its API and includes none of its code.
- Posters, ratings, and trailers come from **[TMDB](https://www.themoviedb.org/)**.
  This product uses the TMDB APIs but is not endorsed or certified by TMDB.

Licensed under **GPL-3.0**.
