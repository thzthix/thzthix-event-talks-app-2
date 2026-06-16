from flask import Flask, render_template, jsonify, request
import requests
import feedparser
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime

app = Flask(__name__)

# Cache configuration
feed_cache = {
    "data": [],
    "last_fetched": 0,
    "source": "none"
}
CACHE_DURATION_SEC = 300  # 5 minutes
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes(feed_content):
    """
    Parses the Atom XML feed into fine-grained release items.
    """
    feed = feedparser.parse(feed_content)
    parsed_items = []
    
    for entry_idx, entry in enumerate(feed.entries):
        date_str = entry.title
        updated_str = entry.get('updated', '')
        base_link = entry.get('link', '')
        
        # Get content
        content_value = ""
        if entry.get('content'):
            content_value = entry.content[0].value
        elif 'summary' in entry:
            content_value = entry.summary
            
        soup = BeautifulSoup(content_value, 'html.parser')
        
        current_type = "Update"
        current_nodes = []
        
        # We parse elements grouped by h3/h4 headings.
        # This handles cases where one daily entry contains multiple categories.
        for child in soup.contents:
            if child.name in ['h3', 'h4']:
                # Save previous group if it exists
                if current_nodes:
                    html_snippet = "".join([str(n) for n in current_nodes]).strip()
                    text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text().strip()
                    text_snippet = re.sub(r'\s+', ' ', text_snippet)
                    
                    parsed_items.append({
                        "id": f"item_{entry_idx}_{len(parsed_items)}",
                        "date": date_str,
                        "updated": updated_str,
                        "type": current_type,
                        "html": html_snippet,
                        "text": text_snippet,
                        "link": base_link
                    })
                current_type = child.get_text().strip()
                current_nodes = []
            else:
                if child.name is not None or str(child).strip():
                    current_nodes.append(child)
                    
        # Save the last group in the entry
        if current_nodes or current_type != "Update":
            html_snippet = "".join([str(n) for n in current_nodes]).strip()
            text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text().strip()
            text_snippet = re.sub(r'\s+', ' ', text_snippet)
            
            parsed_items.append({
                "id": f"item_{entry_idx}_{len(parsed_items)}",
                "date": date_str,
                "updated": updated_str,
                "type": current_type,
                "html": html_snippet,
                "text": text_snippet,
                "link": base_link
            })
            
    return parsed_items

def get_release_notes(force=False):
    """
    Retrieves release notes, utilizing cache when possible.
    """
    now = time.time()
    
    # Check if cache is still valid
    if not force and feed_cache["data"] and (now - feed_cache["last_fetched"] < CACHE_DURATION_SEC):
        feed_cache["source"] = "cache"
        return feed_cache
        
    try:
        # Fetch the feed
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse XML
        items = parse_release_notes(response.content)
        
        # Update cache
        feed_cache["data"] = items
        feed_cache["last_fetched"] = now
        feed_cache["source"] = "network"
        return feed_cache
        
    except Exception as e:
        print(f"Error fetching release notes: {e}")
        # If network call fails but we have cached data, return cached data
        if feed_cache["data"]:
            feed_cache["source"] = "fallback"
            return feed_cache
        else:
            raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force = request.args.get('force', 'false').lower() == 'true'
    try:
        cache_data = get_release_notes(force=force)
        
        last_updated_formatted = ""
        if cache_data["last_fetched"] > 0:
            dt = datetime.fromtimestamp(cache_data["last_fetched"])
            last_updated_formatted = dt.strftime("%Y-%m-%d %H:%M:%S")
            
        return jsonify({
            "status": "success",
            "source": cache_data["source"],
            "last_updated": last_updated_formatted,
            "data": cache_data["data"]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Running Flask app on port 5001 to prevent conflicts
    app.run(debug=True, host='0.0.0.0', port=5001)
