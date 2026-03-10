(function () {
  // ── Constants ────────────────────────────────────────
  var CANVAS_W = 500;
  var CANVAS_H = 600;
  var GRAVITY = 0.15;
  var WALL_DAMPING = 0.8;
  var PUCK_R = 12;
  var PADDLE_R = 30;
  var MIN_BOUNCE_SPEED = 8;
  var MAX_PUCK_SPEED = 12;
  var STAR_COUNT = 5;
  var STAR_POINTS = 10;
  var STARTING_LIVES = 5;

  // ── DOM refs ─────────────────────────────────────────
  var startScreen = document.getElementById('start-screen');
  var gameScreen = document.getElementById('game-screen');
  var gameoverScreen = document.getElementById('gameover-screen');
  var startBtn = document.getElementById('start-btn');
  var playAgainBtn = document.getElementById('play-again-btn');
  var scoreDisplay = document.getElementById('score-display');
  var livesDisplay = document.getElementById('lives-display');
  var finalScoreEl = document.getElementById('final-score');
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');

  // ── DPR-aware canvas ─────────────────────────────────
  var dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.scale(dpr, dpr);

  // ── Game state ───────────────────────────────────────
  var score, lives, puck, paddle, stars, animId, gameActive;

  function resetPuck() {
    return {
      x: CANVAS_W / 2 + (Math.random() - 0.5) * 200,
      y: 50,
      vx: (Math.random() - 0.5) * 3,
      vy: 0
    };
  }

  function randomStar() {
    var margin = 30;
    return {
      x: margin + Math.random() * (CANVAS_W - margin * 2),
      y: margin + Math.random() * (CANVAS_H * 0.75 - margin * 2),
      r: 14
    };
  }

  function initStars() {
    var arr = [];
    for (var i = 0; i < STAR_COUNT; i++) arr.push(randomStar());
    return arr;
  }

  // ── Helpers ──────────────────────────────────────────
  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampSpeed(vx, vy) {
    var spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > MAX_PUCK_SPEED) {
      var scale = MAX_PUCK_SPEED / spd;
      return { vx: vx * scale, vy: vy * scale };
    }
    return { vx: vx, vy: vy };
  }

  function updateLivesDisplay() {
    var s = '';
    for (var i = 0; i < STARTING_LIVES; i++) {
      s += i < lives ? '\u25CF' : '\u25CB';
    }
    livesDisplay.textContent = s;
  }

  // ── CSS theme colors ─────────────────────────────────
  function getColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  // ── Physics update ───────────────────────────────────
  function updatePhysics() {
    // Gravity
    puck.vy += GRAVITY;

    // Move
    puck.x += puck.vx;
    puck.y += puck.vy;

    // Wall bounces (left, right, top)
    if (puck.x - PUCK_R < 0) {
      puck.x = PUCK_R;
      puck.vx = Math.abs(puck.vx) * WALL_DAMPING;
    }
    if (puck.x + PUCK_R > CANVAS_W) {
      puck.x = CANVAS_W - PUCK_R;
      puck.vx = -Math.abs(puck.vx) * WALL_DAMPING;
    }
    if (puck.y - PUCK_R < 0) {
      puck.y = PUCK_R;
      puck.vy = Math.abs(puck.vy) * WALL_DAMPING;
    }

    // Fell through bottom
    if (puck.y - PUCK_R > CANVAS_H) {
      lives--;
      updateLivesDisplay();
      if (lives <= 0) {
        endGame();
        return;
      }
      puck = resetPuck();
    }
  }

  // ── Paddle collision ─────────────────────────────────
  function checkPaddleCollision() {
    var d = dist(puck.x, puck.y, paddle.x, paddle.y);
    var minDist = PUCK_R + PADDLE_R;
    if (d < minDist && d > 0) {
      // Normal from paddle center to puck
      var nx = (puck.x - paddle.x) / d;
      var ny = (puck.y - paddle.y) / d;

      // Separate
      puck.x = paddle.x + nx * minDist;
      puck.y = paddle.y + ny * minDist;

      // Current speed
      var spd = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
      var outSpeed = Math.max(spd, MIN_BOUNCE_SPEED);

      // Bounce along normal
      puck.vx = nx * outSpeed;
      puck.vy = ny * outSpeed;

      var clamped = clampSpeed(puck.vx, puck.vy);
      puck.vx = clamped.vx;
      puck.vy = clamped.vy;
    }
  }

  // ── Star collision ───────────────────────────────────
  function checkStarCollisions() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (dist(puck.x, puck.y, s.x, s.y) < PUCK_R + s.r) {
        score += STAR_POINTS;
        scoreDisplay.textContent = score;
        stars[i] = randomStar();
      }
    }
  }

  // ── Draw star shape ──────────────────────────────────
  function drawStar(cx, cy, r, pulse) {
    var spikes = 5;
    var outerR = r + pulse;
    var innerR = outerR * 0.45;
    ctx.beginPath();
    for (var i = 0; i < spikes * 2; i++) {
      var angle = (i * Math.PI / spikes) - Math.PI / 2;
      var rad = i % 2 === 0 ? outerR : innerR;
      var sx = cx + Math.cos(angle) * rad;
      var sy = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Render ───────────────────────────────────────────
  var frameCount = 0;

  function render() {
    frameCount++;
    var textColor = getColor('--color-text');
    var accentColor = getColor('--color-accent');
    var bgColor = getColor('--color-bg');

    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars
    ctx.fillStyle = '#f59e0b';
    for (var i = 0; i < stars.length; i++) {
      var pulse = Math.sin(frameCount * 0.05 + i * 1.2) * 2;
      drawStar(stars[i].x, stars[i].y, stars[i].r, pulse);
    }

    // Puck
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2);
    ctx.fill();

    // Paddle
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Game loop ────────────────────────────────────────
  function loop() {
    if (!gameActive) return;
    updatePhysics();
    if (!gameActive) return; // endGame may have been called
    checkPaddleCollision();
    checkStarCollisions();
    render();
    animId = requestAnimationFrame(loop);
  }

  // ── Mouse/touch tracking ─────────────────────────────
  function getCanvasCoords(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = CANVAS_W / rect.width;
    var scaleY = CANVAS_H / rect.height;
    return {
      x: Math.max(PADDLE_R, Math.min(CANVAS_W - PADDLE_R, (clientX - rect.left) * scaleX)),
      y: Math.max(PADDLE_R, Math.min(CANVAS_H - PADDLE_R, (clientY - rect.top) * scaleY))
    };
  }

  canvas.addEventListener('mousemove', function (e) {
    if (!gameActive) return;
    var c = getCanvasCoords(e.clientX, e.clientY);
    paddle.x = c.x;
    paddle.y = c.y;
  });

  canvas.addEventListener('touchmove', function (e) {
    if (!gameActive) return;
    e.preventDefault();
    var t = e.touches[0];
    var c = getCanvasCoords(t.clientX, t.clientY);
    paddle.x = c.x;
    paddle.y = c.y;
  }, { passive: false });

  canvas.addEventListener('touchstart', function (e) {
    if (!gameActive) return;
    e.preventDefault();
    var t = e.touches[0];
    var c = getCanvasCoords(t.clientX, t.clientY);
    paddle.x = c.x;
    paddle.y = c.y;
  }, { passive: false });

  // ── Game flow ────────────────────────────────────────
  function startGame() {
    score = 0;
    lives = STARTING_LIVES;
    puck = resetPuck();
    paddle = { x: CANVAS_W / 2, y: CANVAS_H - 60 };
    stars = initStars();
    gameActive = true;
    frameCount = 0;

    scoreDisplay.textContent = '0';
    updateLivesDisplay();

    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    loop();
  }

  function endGame() {
    gameActive = false;
    cancelAnimationFrame(animId);

    gameScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
  }

  // ── Event listeners ──────────────────────────────────
  startBtn.addEventListener('click', startGame);
  playAgainBtn.addEventListener('click', startGame);
})();
