"use strict";

// ---------------------------------------------------------------- constants
// Straight from the SWF.
const BOX_W     = 499;      // SurroundingBox artwork is 499x499
const LAST_LEVEL = 10;
const FPS       = 32;       // original stage frame rate
const TICK_MS   = 1000 / FPS;
const BLACK_CHANCE = 0.15;
const SPIN_STEP = 10;       // degrees per frame
const FADE_STEP = 0.05;     // alpha per frame
const START_ALPHA = 0.2;
const BLACK_ALPHA = 0.9;
const PULSE_TICKS = 10;     // new Timer(10, 10) -> 10 repeats
const STORE_KEY = "clicktiles.lowestScore";   // was SharedObject("clicktiles")

// ------------------------------------------------------------------- lookup
const $ = (id) => document.getElementById(id);

const elBox     = $("board");
const elSlot    = $("boardSlot");
const elHolder  = $("tileHolder");
const elErrors  = $("errorHolder");
const elScrim   = $("scrim");
const elBegin   = $("beginNewLevel");
const elNewGame = $("btnNewGame");
const elLevelBar = $("levelBar");

const tLevel        = $("tLevel");
const tTime         = $("tTime");
const tPenalties    = $("tPenalties");
const tCurrentScore = $("tCurrentScore");
const tTotalScore   = $("tTotalScore");
const tLowest       = $("tLowest");

// Scores are shown to a fixed 3 decimals so the ticking clock does not
// jitter in width -- the arithmetic is unchanged.
const fmt = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

// -------------------------------------------------------------------- state
let level, numTilesOneSide, numBlackTiles, numFilledIn, numErrors;
let currentWidth, okToBeginNewLevel, startedGameAt, currentlyOnTile;
let finished = false;

let tiles = [];             // every tile on the board
let spinning = [];          // tiles currently mid-flip
let mouseX = 0;             // board-space pointer x, for spin direction
let hoverTile = null;       // tile the pointer is physically sitting on
let levelComplete = false;  // last tile touched; waiting for the board to settle
let frozenSecs = null;      // clock stops the instant the level is completed

let boxPulse = 0;           // >0 while the green glow is running
let errorTick = 0;          // counts down the on-screen crosses
let crossesShowing = false;

// ============================================================== game logic

// levelUp(): reset the per-level counters, grow the grid, clear the board.
function levelUp() {
  numBlackTiles = 0;
  numFilledIn   = 0;
  numErrors     = 0;
  level++;
  tLevel.textContent = String(level);
  elLevelBar.style.setProperty("--p", level / LAST_LEVEL);
  numTilesOneSide++;
  elHolder.replaceChildren();
  tiles = [];
  spinning = [];
}

// addTiles(): lay out an n x n grid; from level 2 on, some tiles turn black.
function addTiles() {
  currentWidth = BOX_W / numTilesOneSide;

  const frag = document.createDocumentFragment();

  for (let i = 0; i < numTilesOneSide; i++) {
    for (let j = 0; j < numTilesOneSide; j++) {
      const el = document.createElement("div");
      el.className = "tile";
      el.style.width  = currentWidth + "px";
      el.style.height = currentWidth + "px";

      const t = {
        el,
        myX: j * currentWidth,
        myY: i * currentWidth,
        alpha: START_ALPHA,
        rotY: 0,
        dir: 0,               // 0 = not yet chosen (was mouseDirX1/mouseDirX2)
        isSpinning: false,
        hasSpun: false,
        amIBlackTile: false,
      };

      if (Math.random() < BLACK_CHANCE && level > 1) {
        t.amIBlackTile = true;
        t.alpha = BLACK_ALPHA;
        el.classList.add("black");
        numBlackTiles++;
      }

      draw(t);
      tiles.push(t);
      frag.appendChild(el);
    }
  }

  elHolder.appendChild(frag);
}

function draw(t) {
  t.el.style.transform =
    `translate3d(${t.myX}px, ${t.myY}px, 0) rotateY(${t.rotY}deg)`;
  t.el.style.opacity = t.alpha;
}

// mouseOverTile(): the whole game, driven by hover.
function enterTile(t) {
  // Once the last tile is touched the board is left alone to finish
  // animating, so waving the pointer around during the settle costs nothing.
  if (!okToBeginNewLevel || levelComplete || currentlyOnTile === t) return;
  currentlyOnTile = t;

  clearCrosses();

  if (!t.isSpinning && !t.amIBlackTile) {
    t.isSpinning = true;
    t.rotY = 0;
    spinning.push(t);
    numFilledIn++;
  } else if (t.hasSpun || t.amIBlackTile) {
    markAsError(t);
    numErrors++;
  }

  if (numFilledIn >= numTilesOneSide * numTilesOneSide - numBlackTiles) {
    // Stop the clock now -- the level was completed the moment the last tile
    // was touched -- but let that tile finish its flip before moving on, so
    // the player actually sees it turn.
    levelComplete = true;
    frozenSecs = (performance.now() - startedGameAt) / 1000;
  }
}

function endOfLevel() {
  okToBeginNewLevel = false;
  levelComplete = false;
  currentlyOnTile = null;
  hoverTile = null;

  // stop the clock and bank the level's score
  startedGameAt = null;
  frozenSecs = null;
  tTotalScore.textContent = fmt(
    Number(tTotalScore.textContent) + Number(tCurrentScore.textContent));

  if (level < LAST_LEVEL) {
    levelUp();
    addTiles();
    showBegin("Hover here to begin level " + level);
  } else {
    finished = true;
    checkIfAllTimeLowest(Number(tTotalScore.textContent));
    showBegin("Finished — click for a new game");
  }
}

function showBegin(label) {
  elBegin.textContent = label;
  elBegin.hidden = false;
  elScrim.hidden = false;
}

// spinTile(): translate to the tile's own axis, rotate about Y, translate
// back, and fade in 0.05 per frame. CSS rotateY about the default centre
// origin is the same operation, so only the numbers survive.
function stepSpins() {
  for (let k = spinning.length - 1; k >= 0; k--) {
    const t = spinning[k];

    if (t.dir === 0) {
      // Original sampled mouseX on two consecutive frames and spun away
      // from the direction of travel.
      if (t.mouseDirX1 === undefined) {
        t.mouseDirX1 = mouseX;
        continue;                       // original returned here too
      }
      t.dir = mouseX > t.mouseDirX1 ? -SPIN_STEP : SPIN_STEP;
    }

    t.alpha += FADE_STEP;
    t.rotY += t.dir;

    if (t.alpha >= 1) {
      t.alpha = 1;
      t.rotY = 0;
      t.hasSpun = true;
      // isSpinning deliberately stays true for the rest of the level: it is
      // what separates "already dealt with" from "fresh". Combined with
      // hasSpun it gives three states -- fresh / mid-flip / done.
      spinning.splice(k, 1);

      // A tile is only safe *while* it turns. Still parked on it when it
      // lands and you are touching a finished tile, which costs the same as
      // touching a black one -- otherwise creeping along at a crawl would be
      // a free win. currentlyOnTile is left pointing at t, so sitting there
      // is charged once, not once per frame.
      //
      // Except once the level is complete: touching the last tile ends it,
      // and the board is only still animating so the player can watch. The
      // score is settled at that point and nothing the mouse does can move
      // it, including resting on the tile that finishes the level.
      if (!levelComplete && hoverTile === t) {
        markAsError(t);
        numErrors++;
      }
    }
    draw(t);
  }
}

// markAsError(): drop a white cross on the offending tile.
function markAsError(t) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "cross");
  svg.setAttribute("viewBox", "0 0 11 11");
  svg.setAttribute("width", currentWidth);
  svg.setAttribute("height", currentWidth);

  for (const [x1, y1, x2, y2] of [[1.5, 1.5, 9.5, 9.5], [9.5, 1.5, 1.5, 9.5]]) {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", x1); ln.setAttribute("y1", y1);
    ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
    svg.appendChild(ln);
  }

  // errorHolder now sits inside the board, so tile coordinates are used
  // directly. The original centred the cross for black tiles but subtracted
  // half a tile for the rest, putting those one tile to the left; centring
  // both is what it plainly meant to do.
  svg.style.left = t.myX + "px";
  svg.style.top  = t.myY + "px";

  elErrors.appendChild(svg);
  crossesShowing = true;
  errorTick = 0;
}

function clearCrosses() {
  if (!crossesShowing) return;
  elErrors.replaceChildren();
  crossesShowing = false;
}

// checkIfAllTimeLowest(): the SharedObject high score, now localStorage.
function checkIfAllTimeLowest(score) {
  let best = readBest();
  if (best === null || best > score) {
    best = score;
    try { localStorage.setItem(STORE_KEY, String(best)); } catch (e) { /* private mode */ }
  }
  tLowest.textContent = fmt(best);
}

function readBest() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;                        // storage blocked
  }
}

// inits(): show the stored best.
function inits() {
  const best = readBest();
  tLowest.textContent = best === null ? "—" : fmt(best);
}

// functionBeginNewLevel(): green pulse around the board, then start the clock.
function beginLevel() {
  if (okToBeginNewLevel || finished) return;
  okToBeginNewLevel = true;
  elBegin.hidden = true;
  elScrim.hidden = true;
  boxPulse = 1;
}

function stepPulse() {
  if (boxPulse === 0) return;

  const a = boxPulse > 5 ? 1 - (boxPulse - 5) / 5 : boxPulse / 5;
  boxPulse++;

  if (boxPulse > PULSE_TICKS) {
    boxPulse = 0;
    elBox.style.boxShadow = "";
    startedGameAt = performance.now();   // was new Date()
  } else {
    elBox.style.boxShadow =
      `0 0 6px 2px rgba(var(--glow), ${a}), 0 0 16px 6px rgba(var(--glow), ${a * 0.6})`;
  }
}

// gameIsOn(): per-frame scoreboard. Score is elapsed seconds plus 3s an error.
function stepClock() {
  if (startedGameAt === null || startedGameAt === undefined) return;

  // frozenSecs holds the clock at the moment the level was completed.
  const secs = frozenSecs !== null
    ? frozenSecs
    : (performance.now() - startedGameAt) / 1000;

  tTime.textContent = fmt(secs);
  tPenalties.textContent = String(numErrors);
  tCurrentScore.textContent = fmt(secs + 3 * numErrors);
}

// functionStartNewGame()
function startNewGame() {
  clearCrosses();
  okToBeginNewLevel = false;
  finished = false;
  startedGameAt = null;
  frozenSecs = null;
  levelComplete = false;
  boxPulse = 0;
  elBox.style.boxShadow = "";
  currentlyOnTile = null;
  hoverTile = null;

  numTilesOneSide = 2;
  level = 0;

  levelUp();
  addTiles();
  inits();

  tCurrentScore.textContent = fmt(0);
  tTotalScore.textContent   = fmt(0);
  tTime.textContent         = fmt(0);
  tPenalties.textContent    = "0";

  showBegin("Hover here to begin");
}

// ================================================================ main loop
// The original ran its animation off the 32fps stage and two 10ms Timers.
// One fixed 32Hz accumulator reproduces all of it regardless of display rate.
let last = performance.now();
let acc = 0;

function frame(now) {
  acc += now - last;
  last = now;
  if (acc > 250) acc = 250;             // don't catch up after a tab switch

  while (acc >= TICK_MS) {
    acc -= TICK_MS;
    stepSpins();
    stepPulse();
    if (crossesShowing && ++errorTick > PULSE_TICKS) clearCrosses();
  }

  stepClock();

  // Advance only once the board has settled, so the last tile is seen to
  // flip. stepClock() has just written the final score, penalties included.
  if (levelComplete && spinning.length === 0) endOfLevel();

  requestAnimationFrame(frame);
}

// ================================================================== input

// The board keeps its own 499px coordinate system and is scaled as a whole,
// so every number in the game logic stays in that space no matter the
// viewport. The slot is sized by CSS and #board is out of flow, so reading
// the slot cannot feed back into the board's size.
function fit() {
  const s = (elSlot ? elSlot.clientWidth : BOX_W) / BOX_W;
  elBox.style.transform = `scale(${s})`;
  elBox.__scale = s;
}

if (typeof ResizeObserver !== "undefined" && elSlot) {
  new ResizeObserver(fit).observe(elSlot);
} else {
  window.addEventListener("resize", fit);
}
fit();

function boardPoint(clientX, clientY) {
  const r = elBox.getBoundingClientRect();
  const s = elBox.__scale || 1;
  return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
}

// Which tile sits under a board-space point? Worked out from the grid, not
// from the DOM. A tile mid-flip is rotated: its rendered box overlaps its
// neighbours and collapses to nothing edge-on at 90deg, so hit-testing the
// elements reports the wrong tile and would charge penalties for tiles the
// pointer never actually left. The grid never moves.
function tileAt(bx, by) {
  if (bx < 0 || by < 0 || bx >= BOX_W || by >= BOX_W) return null;

  const col = Math.floor(bx / currentWidth);
  const row = Math.floor(by / currentWidth);
  if (col >= numTilesOneSide || row >= numTilesOneSide) return null;

  return tiles[row * numTilesOneSide + col] || null;
}

// The original's MouseEvent.MOUSE_OVER. Mouse and pen hover freely; touch
// only counts while the finger is actually down.
function track(e) {
  const p = boardPoint(e.clientX, e.clientY);
  mouseX = p.x;                       // feeds the spin direction

  if (e.pointerType === "touch" && e.buttons === 0) return;

  // hoverTile is where the pointer actually is, and it persists while the
  // pointer is still -- that is what makes the linger penalty possible.
  hoverTile = tileAt(p.x, p.y);
  if (hoverTile) enterTile(hoverTile);
}

window.addEventListener("pointermove", track);
window.addEventListener("pointerdown", track);

// currentlyOnTile is deliberately not cleared when the pointer leaves the
// board: the original kept it, so sliding off the edge and back onto the
// same tile does not count as a second visit.

// pointerover alone is not enough: the CTA reappears in the same spot every
// level, so the pointer is often already resting on it and no enter event
// ever fires, leaving the button apparently dead. pointermove covers that --
// beginLevel() is idempotent, so calling it repeatedly is free.
const tryBegin = () => { if (!finished) beginLevel(); };
elBegin.addEventListener("pointerover", tryBegin);
elBegin.addEventListener("pointermove", tryBegin);

// A finished game needs a deliberate click, not a stray hover.
elBegin.addEventListener("click", () => {
  if (finished) startNewGame(); else beginLevel();
});

elNewGame.addEventListener("click", startNewGame);

// ==================================================================== boot
startNewGame();
requestAnimationFrame(frame);
