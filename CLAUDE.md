# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Snackbox is a lightweight collection of web games, small tools, and calculators. No frameworks, no build step — just static HTML, CSS, and JavaScript served via Cloudflare Pages.

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no frameworks, no bundlers, no transpilers
- Each game/tool/calculator is its own standalone HTML page
- No build step. Files are served as-is.

## Project Structure

```
index.html          — Front page listing all items by category
games/              — Browser games (each in its own subdirectory)
  game-name/
    index.html
    style.css
    script.js
tools/              — Small utilities (each in its own subdirectory)
  tool-name/
    index.html
    style.css
    script.js
calculators/        — Calculators (each in its own subdirectory)
  calc-name/
    index.html
    style.css
    script.js
shared/             — Shared CSS/JS (e.g. common styles, nav)
  style.css
```

## Development

Serve locally with any static file server:
```
npx serve .
# or
python -m http.server 8000
```

No install, no build, no compile. Just open files in a browser.

## Deployment

Hosted on Cloudflare Pages. Push to `main` triggers deploy. Build command: none. Output directory: `/` (repo root).

## Conventions

- Each item lives in its own subdirectory under its category (`games/`, `tools/`, `calculators/`)
- Every subdirectory has its own `index.html`, `style.css`, and `script.js` — fully self-contained
- The front page (`index.html`) is a static listing organized into three sections: Games, Tools, Calculators
- Keep things minimal. No unnecessary dependencies, libraries, or abstractions.
- Shared styles (nav, layout, typography) go in `shared/style.css`
