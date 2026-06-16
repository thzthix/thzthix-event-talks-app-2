from datetime import datetime
from pathlib import Path
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import app, fetch_release_feed

DIST = ROOT / "dist"


def build_index():
    with app.test_client() as client:
        response = client.get("/")

    if response.status_code >= 400:
        raise RuntimeError(f"Could not render index page: HTTP {response.status_code}")

    html = response.data.decode("utf-8")
    html = html.replace('href="/static/', 'href="static/')
    html = html.replace('src="/static/', 'src="static/')
    return html


def build_release_data():
    feed = fetch_release_feed(force=True)
    last_updated = ""

    if feed["last_fetched"]:
        last_updated = datetime.fromtimestamp(feed["last_fetched"]).strftime("%Y-%m-%d %H:%M:%S")

    return {
        "status": "success",
        "source": "static snapshot",
        "last_updated": last_updated,
        "data": feed["data"],
    }


def main():
    if DIST.exists():
        shutil.rmtree(DIST)

    (DIST / "static").mkdir(parents=True)
    (DIST / "data").mkdir(parents=True)

    shutil.copytree(ROOT / "static" / "css", DIST / "static" / "css")
    shutil.copytree(ROOT / "static" / "js", DIST / "static" / "js")

    (DIST / "index.html").write_text(build_index(), encoding="utf-8")
    (DIST / "data" / "releases.json").write_text(
        json.dumps(build_release_data(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
