# PrepRep

A Windows desktop app built from the Titan 10 desktop blueprint.

- **Screens:** `src/PrepRep/web/` (HTML, CSS, JavaScript, plus Titan parts).
- **Engine:** `src/PrepRep/Engine.cs`. One `case` per job the page asks the PC to do.
- **Preview in a browser:** `python tools/devserver.py`, then open http://127.0.0.1:8790.
- **Score it:** `python -m titan check .` gives a score out of 100 and a fix list.
- **Build:** push to GitHub; the workflow builds `PrepRep.exe` and publishes a release.

Data is saved in `%LOCALAPPDATA%\PrepRep\data.json`.
