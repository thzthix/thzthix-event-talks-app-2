# Implementation Plan: BigQuery Release Notes Dashboard

This document outlines the architecture, design choices, and implementation steps for the BigQuery Release Notes Dashboard.

---

## 1. Project Overview
A lightweight, modern web application designed to parse, display, and share Google Cloud BigQuery release notes.
* **Backend**: Python Flask (handles RSS/Atom feed fetching, caching, and parsing).
* **Frontend**: Vanilla HTML5, CSS3, and JavaScript (handles rendering, category-based filtering, text-based search, sorting, and Twitter Web Intent integration).

---

## 2. Directory Structure
```text
bq-releases-notes/
├── app.py                  # Flask application & Atom parsing logic
├── requirements.txt        # Backend dependencies
├── .gitignore              # Files ignored by git
├── templates/
│   └── index.html          # HTML structure & SEO metadata
└── static/
    ├── css/
    │   └── style.css       # Dark mode theme & glassmorphic styles
    └── js/
        └── main.js         # Frontend controller, search, filters & X share logic
```

---

## 3. Implementation Details

### Step 1: Environment & Dependency Setup
* Initialize python virtual environment (`venv`).
* Install backend dependencies:
  * `flask`: Lightweight WSGI web application framework.
  * `requests`: Python HTTP library to fetch the Atom XML feed.
  * `beautifulsoup4`: HTML parser to structure raw XML content.
  * `feedparser`: Standard parser for Atom/RSS feeds.
* Capture dependencies inside `requirements.txt`.

### Step 2: Flask Backend (`app.py`)
* Configure a caching layer (5-minute TTL) to avoid hitting Google Cloud rate limits during page reloads.
* Create a route `GET /api/releases` with an optional `force=true` parameter to trigger a direct network refresh bypassing the cache.
* Create an Atom feed parser:
  * Fetch `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
  * Parse daily entries and group items by heading tags (`<h3>`/`<h4>`), splitting them into fine-grained release items (e.g., Features vs. Issues vs. Deprecations).
  * Safely extract the raw HTML content, clean text content (for search/tweeting), and source link.

### Step 3: Frontend Layout (`templates/index.html`)
* Establish semantic HTML5 structure containing title and description meta tags for basic SEO.
* Incorporate a metrics dashboard (Total, Features, Issues, Deprecations).
* Add interactive filter widgets (Search input, Category filter, Sort selector).
* Create a glassmorphic compose/preview modal to write and format tweets.
* Assign unique IDs to all interactive elements for structured browser testing.

### Step 4: Styling & UI (`static/css/style.css`)
* Implement a curated dark-theme background with subtle gradients (`#0b0f19`).
* Build cards using glassmorphism effects (`backdrop-filter` and transparent borders).
* Style release categories with distinct accent colors:
  * **Feature**: Emerald Green (`#10b981`)
  * **Issue**: Rose Red (`#f43f5e`)
  * **Deprecation**: Yellow (`#eab308`)
  * **Notice**: Blue (`#3b82f6`)
* Create shimmering skeleton loaders to show loading states while data is being fetched.

### Step 5: Frontend Logic (`static/js/main.js`)
* Fetch data asynchronously from `/api/releases` using `fetch()`.
* Manage live page state (releases, search query, category, sort).
* Handle dynamic HTML rendering safely inside release cards.
* Write search and filter logic to react instantly as the user types or toggles controls.
* Implement the Twitter share workflow:
  * Calculate correct character counts by representing all URLs as exactly 23 characters (conforming to X's `t.co` shortener system).
  * Auto-truncate draft text to keep it within the 280-character limit.
  * Open `https://twitter.com/intent/tweet?text=...` in a new window when sharing.

### Step 6: Git Setup & Publishing
* Initialize git, configure `.gitignore` (filtering out `venv/`, `__pycache__/`, and OS files like `.DS_Store`).
* Commit all code.
* Use GitHub CLI (`gh`) to provision a public repository named `thzthix-event-talks-app` on GitHub and push the initial commit.
