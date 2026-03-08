# Snackbox

A lightweight collection of web games, small tools, and calculators. No frameworks, no build step — just static HTML, CSS, and JavaScript.

## What's Inside

**Games**
- **Click Counter** — Click the button as fast as you can
- **Memory Game** — Match pairs of emoji cards before time runs out
- **Type the Color** — Stroop test: type the ink color, not the word

**Tools**
- **Text Counter** — Count characters, words, and lines in any text

**Calculators**
- **Unit Converter** — Convert between kilometers and miles

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
