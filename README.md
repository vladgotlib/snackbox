# Snackbox

A lightweight collection of web games, small tools, and calculators. No frameworks, no build step — just static HTML, CSS, and JavaScript.

## What's Inside

**Games** — Quick, casual browser games: reflex tests, puzzles, arcade-style challenges.

**Tools** — Small, single-purpose utilities for everyday tasks like text manipulation and estimation.

**Calculators** — Fun and practical calculators for unit conversion, odds, and quick math.

## Run Locally

Serve with any static file server:

```sh
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` (or whichever port your server uses).

## Project Structure

```
index.html          — Front page listing all items
games/              — Browser games (each in its own subdirectory)
tools/              — Small utilities
calculators/        — Calculators
shared/             — Shared CSS/JS (nav, theme, layout)
```

Each item is fully self-contained in its own subdirectory with `index.html`, `style.css`, and `script.js`.

## Deployment

Hosted on Cloudflare Pages. Push to `main` triggers a deploy — no build step needed.
