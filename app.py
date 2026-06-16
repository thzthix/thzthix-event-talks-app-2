from datetime import datetime
from urllib.parse import urljoin
import re
import time

import feedparser
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request


app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION_SECONDS = 300

feed_cache = {
    "data": [],
    "last_fetched": 0,
    "source": "none",
}

ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "em",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "ul",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "code": {"class"},
    "pre": {"class"},
}
REMOVED_TAGS = {"script", "style", "iframe", "object", "embed", "link", "meta"}


def sanitize_html(html):
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup.find_all(True):
        if tag.name in REMOVED_TAGS:
            tag.decompose()
            continue

        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
            continue

        allowed_attrs = ALLOWED_ATTRIBUTES.get(tag.name, set())
        for attr in list(tag.attrs):
            if attr not in allowed_attrs:
                del tag.attrs[attr]

        if tag.name == "a":
            href = tag.get("href", "")
            if href.startswith(("http://", "https://", "/")):
                tag["href"] = urljoin(FEED_URL, href)
                tag["target"] = "_blank"
                tag["rel"] = "noopener noreferrer"
            else:
                del tag["href"]

    return str(soup).strip()


def text_from_html(html):
    text = BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


def content_for_entry(entry):
    if entry.get("content"):
        return entry.content[0].value
    return entry.get("summary", "")


def parse_release_notes(xml_content):
    feed = feedparser.parse(xml_content)
    releases = []

    for entry_index, entry in enumerate(feed.entries):
        date = entry.get("title", "Release note")
        updated = entry.get("updated", "")
        link = entry.get("link", "")
        soup = BeautifulSoup(content_for_entry(entry), "html.parser")

        current_category = "Update"
        current_nodes = []

        def append_release():
            raw_html = "".join(str(node) for node in current_nodes).strip()
            clean_html = sanitize_html(raw_html)
            clean_text = text_from_html(clean_html)

            if not clean_text:
                return

            releases.append(
                {
                    "id": f"release-{entry_index}-{len(releases)}",
                    "date": date,
                    "updated": updated,
                    "title": date,
                    "category": current_category,
                    "html": clean_html,
                    "text": clean_text,
                    "link": link,
                }
            )

        for child in soup.contents:
            if getattr(child, "name", None) in {"h3", "h4"}:
                if current_nodes:
                    append_release()
                current_category = child.get_text(" ", strip=True) or "Update"
                current_nodes = []
            elif getattr(child, "name", None) is not None or str(child).strip():
                current_nodes.append(child)

        if current_nodes:
            append_release()

    return releases


def fetch_release_feed(force=False):
    now = time.time()
    cache_is_fresh = now - feed_cache["last_fetched"] < CACHE_DURATION_SECONDS

    if feed_cache["data"] and cache_is_fresh and not force:
        feed_cache["source"] = "cache"
        return feed_cache

    try:
        response = requests.get(
            FEED_URL,
            headers={"User-Agent": "bq-release-notes-viewer/1.0"},
            timeout=10,
        )
        response.raise_for_status()
        feed_cache["data"] = parse_release_notes(response.content)
        feed_cache["last_fetched"] = now
        feed_cache["source"] = "network"
        return feed_cache
    except requests.RequestException:
        if feed_cache["data"]:
            feed_cache["source"] = "fallback"
            return feed_cache
        raise


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/releases")
def api_releases():
    force = request.args.get("force", "false").lower() == "true"

    try:
        result = fetch_release_feed(force=force)
        last_updated = ""
        if result["last_fetched"]:
            last_updated = datetime.fromtimestamp(result["last_fetched"]).strftime(
                "%Y-%m-%d %H:%M:%S"
            )

        return jsonify(
            {
                "status": "success",
                "source": result["source"],
                "last_updated": last_updated,
                "data": result["data"],
            }
        )
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
