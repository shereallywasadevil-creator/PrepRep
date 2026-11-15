"""Collect photo CANDIDATES for every recipe so a person can pick the most appetizing one.

Sources (free licences that allow use in an app, with credit): Openverse (indexes Flickr and other CC collections)
and Wikimedia Commons. Licences kept: CC0, public domain, CC BY, CC BY-SA. No NC/ND.
Writes review/candidates.json and review/sheet_XX.jpg contact sheets (numbered thumbnails per recipe).
The picks go in tools/photo_picks.json:  {"recipe_id": "<candidate key>"}  (or "none").
Runs in the photo-review workflow; the sheets are pushed to the photo-review branch.
"""
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RECIPES = ROOT / "src" / "PrepRep" / "web" / "data" / "recipes.json"
OUT = ROOT / "review"
UA = {"User-Agent": "PrepRepBuild/1.0 (personal app; github.com/shereallywasadevil-creator/PrepRep)"}
OK_LIC = {"cc0", "pdm", "by", "by-sa"}
PER = 6


def get(url, tries=4, timeout=40):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(4 * (i + 1))


def openverse(q):
    qs = urllib.parse.urlencode({"q": q, "license": "by,by-sa,cc0,pdm", "mature": "false", "page_size": 20, "size": "large"})
    data = json.loads(get("https://api.openverse.org/v1/images/?" + qs))
    out = []
    for r in data.get("results", []):
        if (r.get("license") or "").lower() not in OK_LIC:
            continue
        w, h = r.get("width") or 0, r.get("height") or 0
        if w and h and (w < 640 or w < h * 0.95):
            continue
        out.append({"src": "openverse", "id": r["id"], "title": r.get("title", "")[:120], "thumb": r.get("thumbnail") or r["url"], "full": r["url"],
                    "page": r.get("foreign_landing_url") or "", "artist": (r.get("creator") or "Unknown")[:100],
                    "license": ("CC " + r["license"].upper() + " " + (r.get("license_version") or "")).strip() if r["license"] not in ("cc0", "pdm") else r["license"].upper()})
    return out


def commons(q):
    params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6,
              "gsrlimit": 20, "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 900}
    data = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    out = []
    for p in sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99)):
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        if not re.match(r"^(public domain|pd|cc0|cc by(-sa)? [0-9.]+)", lic.strip(), re.I):
            continue
        if info.get("width", 0) < 640 or info.get("width", 0) < info.get("height", 1) * 0.95:
            continue
        artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "Unknown")).strip()[:100]
        out.append({"src": "commons", "id": p.get("title", ""), "title": p.get("title", "")[:120], "thumb": info.get("thumburl") or info["url"],
                    "full": info.get("thumburl") or info["url"], "page": info.get("descriptionurl", ""), "artist": artist, "license": lic})
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))["recipes"]
    only = set(sys.argv[1:])
    OUT.mkdir(exist_ok=True)
    cands = {}
    for r in recipes:
        if only and r["id"] not in only:
            continue
        seen, got = set(), []
        q = r.get("photo") or r["name"]
        for fn, query in ((openverse, q), (openverse, re.sub(r"\(.*?\)", "", r["name"]).strip()), (commons, q)):
            try:
                for c in fn(query):
                    if c["thumb"] in seen:
                        continue
                    seen.add(c["thumb"]); got.append(c)
            except Exception as e:
                print("skip", r["id"], fn.__name__, e)
            if len(got) >= PER * 2:
                break
            time.sleep(1.5)
        thumbs = []
        for c in got:
            if len(thumbs) >= PER:
                break
            try:
                im = Image.open(io.BytesIO(get(c["thumb"], tries=2, timeout=30))).convert("RGB")
                im.thumbnail((360, 240))
                thumbs.append((c, im))
            except Exception:
                continue
        cands[r["id"]] = [dict(c, key=f"{r['id']}#{i}") for i, (c, _) in enumerate(thumbs)]
        r["_thumbs"] = [im for _, im in thumbs]
        print(f"{r['id']}: {len(thumbs)} candidates")
    (OUT / "candidates.json").write_text(json.dumps(cands, indent=1, ensure_ascii=False), encoding="utf-8")
    # contact sheets: 5 recipes per sheet, one row each: name + up to 6 numbered thumbnails
    rows = [r for r in recipes if r.get("_thumbs") is not None]
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    for s in range(0, len(rows), 5):
        chunk = rows[s:s + 5]
        sheet = Image.new("RGB", (6 * 370 + 10, len(chunk) * 290 + 10), "white")
        d = ImageDraw.Draw(sheet)
        for j, r in enumerate(chunk):
            y = 10 + j * 290
            d.text((10, y), f"{r['id']}  —  {r['name']}", fill="black", font=font)
            for i, im in enumerate(r["_thumbs"]):
                x = 10 + i * 370
                sheet.paste(im, (x, y + 30))
                d.rectangle((x, y + 30, x + 34, y + 62), fill="black")
                d.text((x + 9, y + 34), str(i), fill="white", font=font)
        sheet.save(OUT / f"sheet_{s // 5:02d}.jpg", quality=80)
    print("sheets:", (len(rows) + 4) // 5)


if __name__ == "__main__":
    main()
