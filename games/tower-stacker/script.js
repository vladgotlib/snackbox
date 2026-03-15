(function () {
  // ── Constants ────────────────────────────────────────
  var CANVAS_W = 400;
  var CANVAS_H = 600;
  var BLOCK_HEIGHT = 25;
  var BASE_WIDTH = 200;
  var BASE_SPEED = 2;
  var SPEED_INCREMENT = 0.15;
  var MAX_SPEED = 10;
  var COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#1abc9c', '#3498db', '#9b59b6', '#e84393'
  ];

  // ── DOM refs ─────────────────────────────────────────
  var startScreen = document.getElementById('start-screen');
  var gameScreen = document.getElementById('game-screen');
  var gameoverScreen = document.getElementById('gameover-screen');
  var startBtn = document.getElementById('start-btn');
  var playAgainBtn = document.getElementById('play-again-btn');
  var scoreDisplay = document.getElementById('score-display');
  var finalScoreEl = document.getElementById('final-score');
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');

  // ── DPR-aware canvas ─────────────────────────────────
  var dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.scale(dpr, dpr);

  // ── Game state ───────────────────────────────────────
  var score, gameActive, animId;
  var tower, currentBlock, cameraY, fallingPieces;
  var direction; // 1 or -1

  // ── Helpers ──────────────────────────────────────────
  function getColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function blockColor(index) {
    return COLORS[index % COLORS.length];
  }

  function currentSpeed() {
    return Math.min(BASE_SPEED + score * SPEED_INCREMENT, MAX_SPEED);
  }

  // ── Create a new moving block ────────────────────────
  function spawnBlock() {
    var top = tower[tower.length - 1];
    var y = top.y - BLOCK_HEIGHT;
    var width = top.width;
    // Start from left or right edge alternating
    var startX = direction === 1 ? -width : CANVAS_W;
    currentBlock = { x: startX, y: y, width: width };
  }

  // ── Drop block ───────────────────────────────────────
  function dropBlock() {
    if (!gameActive || !currentBlock) return;

    var top = tower[tower.length - 1];
    var cur = currentBlock;

    // Calculate overlap
    var overlapLeft = Math.max(cur.x, top.x);
    var overlapRight = Math.min(cur.x + cur.width, top.x + top.width);
    var overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Missed entirely — the whole block falls
      fallingPieces.push({
        x: cur.x, y: cur.y, width: cur.width,
        vy: 0, color: blockColor(score), alpha: 1
      });
      endGame();
      return;
    }

    // Perfect placement check (>= 98% of previous width)
    if (overlapWidth >= top.width * 0.98) {
      overlapWidth = top.width;
      overlapLeft = top.x;
    }

    // Cut-off piece falls away
    var cutLeft = cur.x;
    var cutRight = cur.x + cur.width;
    if (overlapLeft > cutLeft) {
      // Left side was cut
      var leftCutWidth = overlapLeft - cutLeft;
      if (leftCutWidth > 1) {
        fallingPieces.push({
          x: cutLeft, y: cur.y, width: leftCutWidth,
          vy: 0, color: blockColor(score), alpha: 1
        });
      }
    }
    if (overlapRight < cutRight) {
      // Right side was cut
      var rightCutWidth = cutRight - overlapRight;
      if (rightCutWidth > 1) {
        fallingPieces.push({
          x: overlapRight, y: cur.y, width: rightCutWidth,
          vy: 0, color: blockColor(score), alpha: 1
        });
      }
    }

    // Place the trimmed block
    tower.push({
      x: overlapLeft,
      y: cur.y,
      width: overlapWidth
    });

    score++;
    scoreDisplay.textContent = score;

    // Alternate direction
    direction *= -1;

    // Spawn next block
    spawnBlock();
  }

  // ── Update ───────────────────────────────────────────
  function update() {
    if (!currentBlock) return;

    // Move current block horizontally
    currentBlock.x += currentSpeed() * direction;

    // Bounce off canvas edges
    if (direction === 1 && currentBlock.x > CANVAS_W) {
      currentBlock.x = CANVAS_W;
      direction = -1;
    } else if (direction === -1 && currentBlock.x + currentBlock.width < 0) {
      currentBlock.x = -currentBlock.width;
      direction = 1;
    }

    // Camera scrolling — lerp toward target
    var targetCamY = Math.max(0, CANVAS_H * 0.3 - currentBlock.y);
    cameraY += (targetCamY - cameraY) * 0.08;

    // Update falling pieces
    for (var i = fallingPieces.length - 1; i >= 0; i--) {
      var p = fallingPieces[i];
      p.vy += 0.3;
      p.y += p.vy;
      p.alpha -= 0.01;
      if (p.y - cameraY > CANVAS_H + 50 || p.alpha <= 0) {
        fallingPieces.splice(i, 1);
      }
    }
  }

  // ── Render ───────────────────────────────────────────
  function render() {
    var bgColor = getColor('--color-bg');

    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.translate(0, cameraY);

    // Draw tower blocks
    for (var i = 0; i < tower.length; i++) {
      var b = tower[i];
      ctx.fillStyle = i === 0 ? '#888' : blockColor(i - 1);
      ctx.fillRect(b.x, b.y, b.width, BLOCK_HEIGHT);
      // Subtle border
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.width, BLOCK_HEIGHT);
    }

    // Draw current moving block
    if (currentBlock && gameActive) {
      ctx.fillStyle = blockColor(score);
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, BLOCK_HEIGHT);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(currentBlock.x, currentBlock.y, currentBlock.width, BLOCK_HEIGHT);
    }

    // Draw falling pieces
    for (var j = 0; j < fallingPieces.length; j++) {
      var fp = fallingPieces[j];
      ctx.globalAlpha = Math.max(0, fp.alpha);
      ctx.fillStyle = fp.color;
      ctx.fillRect(fp.x, fp.y, fp.width, BLOCK_HEIGHT);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ── Game loop ────────────────────────────────────────
  function loop() {
    if (!gameActive) return;
    update();
    render();
    animId = requestAnimationFrame(loop);
  }

  // ── Input ────────────────────────────────────────────
  canvas.addEventListener('mousedown', function () {
    dropBlock();
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    dropBlock();
  }, { passive: false });

  // ── Game flow ────────────────────────────────────────
  function startGame() {
    score = 0;
    gameActive = true;
    cameraY = 0;
    fallingPieces = [];
    direction = 1;

    // Base block centered at bottom
    tower = [{
      x: (CANVAS_W - BASE_WIDTH) / 2,
      y: CANVAS_H - BLOCK_HEIGHT,
      width: BASE_WIDTH
    }];

    scoreDisplay.textContent = '0';

    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    spawnBlock();
    loop();
  }

  function endGame() {
    gameActive = false;
    cancelAnimationFrame(animId);

    // Render one last frame to show the final state
    render();

    gameScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
  }

  // ── Event listeners ──────────────────────────────────
  startBtn.addEventListener('click', startGame);
  playAgainBtn.addEventListener('click', startGame);
})();
