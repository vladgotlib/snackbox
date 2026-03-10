(function () {
  // ── Constants ────────────────────────────────────────
  var CANVAS_W = 700;
  var CANVAS_H = 400;
  var TOTAL_ROUNDS = 5;
  var LANE_H = 100;
  var LANE_TOP = 50; // top margin for lanes
  var FINISH_X = CANVAS_W - 60;
  var FINISH_COL_W = 20;
  var EMOJI_SIZE = 40;
  var COUNTDOWN_FRAMES = 180; // 3 seconds at 60fps
  var RESULT_PAUSE_FRAMES = 120; // 2 seconds
  var EMOJI_POOL = ['🐢','🐇','🐎','🐌','🦊','🐕','🐈','🐁','🦆','🐸'];

  // ── DOM refs ─────────────────────────────────────────
  var startScreen = document.getElementById('start-screen');
  var gameScreen = document.getElementById('game-screen');
  var gameoverScreen = document.getElementById('gameover-screen');
  var startBtn = document.getElementById('start-btn');
  var playAgainBtn = document.getElementById('play-again-btn');
  var scoreDisplay = document.getElementById('score-display');
  var roundDisplay = document.getElementById('round-display');
  var finalScoreEl = document.getElementById('final-score');
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');

  // ── DPR-aware canvas ─────────────────────────────────
  var dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.scale(dpr, dpr);

  // ── Game state ───────────────────────────────────────
  var score, round, racers, winnerIndex, playerPick;
  var phase; // 'countdown', 'racing', 'result', 'done'
  var phaseTimer, roundStartTime, animId;
  var frameCount;

  // ── CSS theme colors ─────────────────────────────────
  function getColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  // ── Helpers ──────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function laneY(index) {
    return LANE_TOP + index * LANE_H + LANE_H / 2;
  }

  // ── Race setup ───────────────────────────────────────
  function setupRound() {
    var emojis = shuffle(EMOJI_POOL).slice(0, 3);
    winnerIndex = Math.floor(Math.random() * 3);
    playerPick = -1;

    // Target race duration: 4-6 seconds (in frames at 60fps)
    var T = (4 + Math.random() * 2) * 60;

    // Assign random start positions (50-250px), at least 30px apart
    var starts = [];
    for (var i = 0; i < 3; i++) {
      var sx;
      var valid;
      do {
        sx = 50 + Math.random() * 200;
        valid = true;
        for (var j = 0; j < starts.length; j++) {
          if (Math.abs(sx - starts[j]) < 30) { valid = false; break; }
        }
      } while (!valid);
      starts.push(sx);
    }

    racers = [];
    for (var i = 0; i < 3; i++) {
      var dist = FINISH_X - starts[i];
      var speed;
      if (i === winnerIndex) {
        speed = dist / T;
      } else {
        // Losers arrive 5-30 frames late
        var delay = 5 + Math.random() * 25;
        speed = dist / (T + delay);
      }
      racers.push({
        emoji: emojis[i],
        startX: starts[i],
        x: starts[i],
        speed: speed,
        sinPhase: Math.random() * Math.PI * 2,
        sinFreq: 0.03 + Math.random() * 0.02,
        sinAmp: 0.3 + Math.random() * 0.3,
        finished: false
      });
    }

    phase = 'countdown';
    phaseTimer = COUNTDOWN_FRAMES;
    roundStartTime = performance.now();
    frameCount = 0;
  }

  // ── Scoring ──────────────────────────────────────────
  function calcPoints() {
    var elapsed = (performance.now() - roundStartTime) / 1000;
    return Math.max(10, Math.floor(100 - 10 * elapsed));
  }

  // ── Canvas coord from click/touch ────────────────────
  function getCanvasY(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleY = CANVAS_H / rect.height;
    return (clientY - rect.top) * scaleY;
  }

  function getLaneFromY(cy) {
    for (var i = 0; i < 3; i++) {
      var top = LANE_TOP + i * LANE_H;
      if (cy >= top && cy < top + LANE_H) return i;
    }
    return -1;
  }

  function handlePick(clientX, clientY) {
    if (playerPick !== -1) return; // already picked
    if (phase !== 'countdown' && phase !== 'racing') return;
    var cy = getCanvasY(clientX, clientY);
    var lane = getLaneFromY(cy);
    if (lane === -1) return;
    playerPick = lane;
  }

  canvas.addEventListener('click', function (e) {
    handlePick(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    handlePick(t.clientX, t.clientY);
  }, { passive: false });

  // ── Drawing ──────────────────────────────────────────
  function drawCheckeredFinish() {
    var sq = 10;
    var cols = Math.ceil(FINISH_COL_W / sq);
    var rows = Math.ceil((LANE_H * 3) / sq);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#222' : '#eee';
        ctx.fillRect(FINISH_X + c * sq, LANE_TOP + r * sq, sq, sq);
      }
    }
  }

  function drawLanes() {
    var borderColor = getColor('--color-border');
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    for (var i = 0; i <= 3; i++) {
      var y = LANE_TOP + i * LANE_H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
  }

  function drawRacers() {
    ctx.font = EMOJI_SIZE + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < racers.length; i++) {
      var r = racers[i];
      ctx.fillText(r.emoji, r.x, laneY(i));
    }
  }

  function drawPickHighlight() {
    if (playerPick === -1) return;
    var top = LANE_TOP + playerPick * LANE_H;
    var correct = playerPick === winnerIndex;
    if (phase === 'result') {
      ctx.fillStyle = correct ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)';
    } else {
      ctx.fillStyle = 'rgba(59,130,246,0.15)';
    }
    ctx.fillRect(0, top, CANVAS_W, LANE_H);
  }

  function drawWinnerHighlight() {
    if (phase !== 'result') return;
    var top = LANE_TOP + winnerIndex * LANE_H;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, top + 1, CANVAS_W - 2, LANE_H - 2);
  }

  function drawCountdown() {
    if (phase !== 'countdown') return;
    var sec = Math.ceil(phaseTimer / 60);
    var text = sec > 0 ? '' + sec : 'GO!';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getColor('--color-accent');
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  }

  function drawResultText() {
    if (phase !== 'result') return;
    var text, color;
    if (playerPick === winnerIndex) {
      text = '+' + lastAwardedPoints;
      color = '#22c55e';
    } else if (playerPick === -1) {
      text = 'Too slow!';
      color = '#ef4444';
    } else {
      text = 'Wrong!';
      color = '#ef4444';
    }
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  }

  var lastAwardedPoints = 0;

  function render() {
    var bgColor = getColor('--color-bg');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawLanes();
    drawCheckeredFinish();
    drawPickHighlight();
    drawWinnerHighlight();
    drawRacers();
    drawCountdown();
    drawResultText();
  }

  // ── Update ───────────────────────────────────────────
  function update() {
    frameCount++;

    if (phase === 'countdown') {
      phaseTimer--;
      if (phaseTimer <= -30) { // brief "GO!" display
        phase = 'racing';
      }
      return;
    }

    if (phase === 'racing') {
      var anyRacing = false;
      for (var i = 0; i < racers.length; i++) {
        var r = racers[i];
        if (r.finished) continue;

        // Progress ratio (0 to 1)
        var progress = (r.x - r.startX) / (FINISH_X - r.startX);
        progress = Math.max(0, Math.min(1, progress));

        // Sinusoidal variation dampens near finish
        var dampen = 1 - progress * progress;
        var sin = Math.sin(frameCount * r.sinFreq + r.sinPhase) * r.sinAmp * dampen;
        r.x += r.speed + sin;

        if (r.x >= FINISH_X) {
          r.x = FINISH_X;
          r.finished = true;
        } else {
          anyRacing = true;
        }
      }

      // Check if winner crossed
      if (racers[winnerIndex].finished) {
        // Award points
        if (playerPick === winnerIndex) {
          lastAwardedPoints = calcPoints();
          score += lastAwardedPoints;
          scoreDisplay.textContent = score;
        } else {
          lastAwardedPoints = 0;
        }
        phase = 'result';
        phaseTimer = RESULT_PAUSE_FRAMES;
      }
      return;
    }

    if (phase === 'result') {
      // Let remaining racers finish visually
      for (var i = 0; i < racers.length; i++) {
        var r = racers[i];
        if (!r.finished) {
          r.x += r.speed;
          if (r.x >= FINISH_X) {
            r.x = FINISH_X;
            r.finished = true;
          }
        }
      }
      phaseTimer--;
      if (phaseTimer <= 0) {
        if (round >= TOTAL_ROUNDS) {
          endGame();
          return;
        }
        round++;
        roundDisplay.textContent = round + '/' + TOTAL_ROUNDS;
        setupRound();
      }
      return;
    }
  }

  // ── Game loop ────────────────────────────────────────
  function loop() {
    if (phase === 'done') return;
    update();
    if (phase === 'done') return;
    render();
    animId = requestAnimationFrame(loop);
  }

  // ── Game flow ────────────────────────────────────────
  function startGame() {
    score = 0;
    round = 1;
    scoreDisplay.textContent = '0';
    roundDisplay.textContent = '1/' + TOTAL_ROUNDS;

    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    setupRound();
    loop();
  }

  function endGame() {
    phase = 'done';
    cancelAnimationFrame(animId);
    gameScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score;
  }

  // ── Event listeners ──────────────────────────────────
  startBtn.addEventListener('click', startGame);
  playAgainBtn.addEventListener('click', startGame);
})();
