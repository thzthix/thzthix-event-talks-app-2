# BigQuery Release Notes Flask App Rebuild Plan

## Goal
- Rebuild the application as a small Python Flask app with plain HTML, CSS, and JavaScript.
- Fetch the official BigQuery release notes feed from `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
- Display release note updates as readable cards.
- Provide a refresh button with a visible spinner while data is loading.
- Let the user select any update and open an X/Twitter Web Intent draft for that update.

## Current Structure Analysis
- The repository already contains a Flask app:
  - `app.py` for the server, feed fetching, parsing, and JSON API.
  - `templates/index.html` for the single-page UI.
  - `static/js/main.js` for client-side fetching, rendering, refresh, and sharing behavior.
  - `static/css/style.css` for page styling.
  - `requirements.txt` for Flask, requests, feedparser, and BeautifulSoup dependencies.
- The previous implementation included extra features beyond the requested scope, including search, filtering, statistics, copy, and CSV export.
- The rebuild intentionally narrows the app to the requested essentials: feed display, manual refresh, and tweet sharing.

## Proposed Architecture
- Flask serves the page at `GET /`.
- Flask exposes `GET /api/releases` with optional `force=true`:
  - Default requests use a short in-memory cache.
  - `force=true` bypasses a fresh cache and fetches the feed again.
- The backend uses:
  - `requests` for the network fetch.
  - `feedparser` for Atom/RSS parsing.
  - `BeautifulSoup` for release note HTML cleanup and text extraction.
- The API returns:
  - `status`, `source`, `last_updated`, and `data`.
  - Each release item includes `id`, `date`, `updated`, `title`, `category`, `html`, `text`, and `link`.
- The frontend uses:
  - `fetch()` to call `/api/releases`.
  - DOM APIs to render cards.
  - A native `<dialog>` for tweet composition.
  - Twitter Web Intent at `https://twitter.com/intent/tweet?text=...`.

## Work List
- Replace the previous expanded implementation with a simpler scoped version.
- Implement feed fetching, cache handling, XML parsing, HTML sanitization, and JSON output in `app.py`.
- Rebuild `templates/index.html` with only the app header, refresh control, status area, release list, and tweet dialog.
- Rebuild `static/js/main.js` with release loading, loading state, card rendering, tweet text generation, character counting, and Web Intent launch.
- Rebuild `static/css/style.css` with simple responsive layout, cards, spinner, and dialog styles.
- Keep `requirements.txt` aligned with the actual dependencies.

## Verification Method
- Run `./venv/bin/python -m py_compile app.py` to verify Python syntax.
- Use Flask's test client to verify `/` returns HTML successfully.
- Use Flask's test client to verify `/api/releases?force=true` returns successful JSON with release items when network access is available.
- Manually run the Flask development server and verify:
  - The page loads at `http://localhost:5001`.
  - Release cards render.
  - The refresh button disables and shows the spinner while loading.
  - The tweet dialog opens from a selected update.
  - The generated tweet stays within the 280-character limit by default.
  - The Post on X button opens the Twitter intent URL.
