"""Fetch one free-licensed photo per recipe from Wikimedia Commons, with credits. Runs in the GitHub build.

Only licenses that allow use in an app are kept: public domain, CC0, CC BY and CC BY-SA (credit shown in the app).
Writes web/photos/<recipe id>.jpg and web/photos/credits.json. A recipe with no good photo keeps its colour block.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "src" / "PrepRep" / "web"
OUT = WEB / "photos"
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "PrepRepBuild/1.0 (personal app; github.com/shereallywasadevil-creator/PrepRep)"}
OK = re.compile(r"^(public domain|pd|cc0|cc by(-sa)? [0-9.]+)", re.I)


def get(url, tries=5):
    for i in range(tries):                         # Wikimedia asks callers to slow down with 429: wait and retry
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 5 * (i + 1))


def search(query, must):
    q = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6,
         "gsrlimit": 15, "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 720}
    data = json.loads(get(API + "?" + urllib.parse.urlencode(q)))
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    for p in pages:
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        if not re.search(must, p.get("title", ""), re.I):
            continue                                   # the file name must actually name the dish
        if not OK.match(lic.strip()) or info.get("width", 0) < 600 or info.get("width", 0) < info.get("height", 1) * 0.9:
            continue                                   # free licence, big enough, landscape-ish for a card
        artist = re.sub(r"<[^>]+>", "", html.unescape((meta.get("Artist") or {}).get("value", "Unknown"))).strip()
        return {"thumb": info.get("thumburl") or info["url"], "page": info.get("descriptionurl", ""), "license": lic,
                "artist": artist[:120], "title": p.get("title", "")}
    return None


def main():
    recipes = json.loads((WEB / "data" / "recipes.json").read_text(encoding="utf-8"))["recipes"]
    OUT.mkdir(exist_ok=True)
    credits, got = {}, 0
    for r in recipes:
        try:
            hit = search(r["photo"], r["photo_must"]) or search(r["name"], r["photo_must"])
            if hit:
                (OUT / f"{r['id']}.jpg").write_bytes(get(hit["thumb"]))
                credits[r["id"]] = {k: hit[k] for k in ("artist", "license", "page", "title")}
                got += 1
                print(f"OK   {r['id']}: {hit['title']} ({hit['license']}, {hit['artist'][:40]})")
            else:
                print(f"none {r['id']}")
        except Exception as e:
            print(f"skip {r['id']}: {e}")
        time.sleep(2)                                  # be polite to Wikimedia
    (OUT / "credits.json").write_text(json.dumps(credits, indent=1), encoding="utf-8")
    print(f"{got} of {len(recipes)} recipes have photos")


if __name__ == "__main__":
    sys.exit(main())
