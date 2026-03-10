(function () {
  /* ── DOM refs ───────────────────────────────────────── */
  var startScreen   = document.getElementById('start-screen');
  var gameScreen    = document.getElementById('game-screen');
  var overScreen    = document.getElementById('gameover-screen');
  var startBtn      = document.getElementById('start-btn');
  var playAgainBtn  = document.getElementById('play-again-btn');
  var scoreEl       = document.getElementById('score-display');
  var levelEl       = document.getElementById('level-display');
  var livesEl       = document.getElementById('lives-display');
  var finalScoreEl  = document.getElementById('final-score');
  var canvas        = document.getElementById('game-canvas');
  var ctx           = canvas.getContext('2d');

  /* ── Constants ──────────────────────────────────────── */
  var CW = 600, CH = 600, CX = 300, CY = 300;
  var TARGET_R      = 8;
  var INNER_R       = 100;
  var MIDDLE_R      = 114;
  var OUTER_R       = 128;
  var SHIP_R        = 142;
  var ARC_THICKNESS = 10;
  var BULLET_SPEED  = 6;
  var SHIP_SPEED    = 0.04;          // radians per frame
  var DEG           = Math.PI / 180;

  /* Speed sets: [inner CW, middle CCW, outer CW, gapDeg] */
  var LEVELS = [
    [1, 1, 2, 24],
    [2, 1, 3, 22],
    [2, 3, 1, 20],
    [3, 2, 4, 18],
    [4, 3, 5, 16]
  ];

  /* ── DPR scaling ────────────────────────────────────── */
  var dpr = window.devicePixelRatio || 1;
  canvas.width  = CW * dpr;
  canvas.height = CH * dpr;
  ctx.scale(dpr, dpr);

  /* ── Theme colors ───────────────────────────────────── */
  function getColor(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  /* ── Game state ─────────────────────────────────────── */
  var score, lives, level, levelCfg;
  var shipAngle;         // radians
  var bullet;            // { r, angle } or null
  var arcs;              // [ { angle (deg), speed (deg/frame), dir (1|-1) } x3 ]
  var particles;         // [ { x,y,vx,vy,life,color } ]
  var rafId;
  var keys = {};

  /* ── Helpers ────────────────────────────────────────── */
  function normDeg(a) {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  }

  function livesString(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '\u25CF';
    return s;
  }

  function getLevelCfg(lv) {
    var idx = Math.min(lv - 1, LEVELS.length - 1);
    return LEVELS[idx];
  }

  /* ── Init / reset ───────────────────────────────────── */
  function initGame() {
    score = 0;
    lives = 5;
    level = 1;
    shipAngle = -Math.PI / 2;   // top
    bullet = null;
    particles = [];
    setupLevel();
    updateHUD();
  }

  function setupLevel() {
    levelCfg = getLevelCfg(level);
    arcs = [
      { angle: 0, speed: levelCfg[0], dir:  1 },   // inner, CW
      { angle: 0, speed: levelCfg[1], dir: -1 },   // middle, CCW
      { angle: 0, speed: levelCfg[2], dir:  1 }    // outer, CW
    ];
  }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = livesString(lives);
  }

  /* ── Screens ────────────────────────────────────────── */
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function showStart()  { show(startScreen); hide(gameScreen); hide(overScreen); }
  function showGame()   { hide(startScreen); show(gameScreen); hide(overScreen); }
  function showOver()   { hide(startScreen); hide(gameScreen); show(overScreen); finalScoreEl.textContent = score; }

  /* ── Particle effects ───────────────────────────────── */
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 1 + Math.random() * 3;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30, color: color });
    }
  }

  /* ── Shooting ───────────────────────────────────────── */
  function fire() {
    if (bullet) return;
    bullet = { r: SHIP_R, angle: shipAngle, cleared: [false, false, false] };
  }

  /* ── Update ─────────────────────────────────────────── */
  function update() {
    /* Ship movement */
    if (keys['ArrowLeft'] || keys['KeyA'])  shipAngle -= SHIP_SPEED;
    if (keys['ArrowRight'] || keys['KeyD']) shipAngle += SHIP_SPEED;

    /* Arc rotation */
    for (var i = 0; i < 3; i++) {
      arcs[i].angle = (arcs[i].angle + arcs[i].speed * arcs[i].dir + 360) % 360;
    }

    /* Bullet */
    if (bullet) {
      var prevR = bullet.r;
      bullet.r -= BULLET_SPEED;

      /* Check collision with arcs (outer → inner) */
      var arcRadii = [OUTER_R, MIDDLE_R, INNER_R];
      var arcOrder = [2, 1, 0];  // indices into arcs[] — outer, middle, inner
      var gapDeg   = levelCfg[3];

      for (var i = 0; i < 3; i++) {
        if (bullet.cleared[i]) continue;
        var r  = arcRadii[i];
        var ai = arcOrder[i];
        /* Bullet crossed this arc this frame? (prevR was outside, now inside or past) */
        if (prevR >= r - ARC_THICKNESS / 2 && bullet.r <= r + ARC_THICKNESS / 2) {
          var bulletDeg = ((bullet.angle / DEG) % 360 + 360) % 360;
          var gapCenter = arcs[ai].angle;
          var diff = normDeg(bulletDeg - gapCenter);
          if (Math.abs(diff) > gapDeg / 2) {
            /* Blocked! */
            var bx = Math.cos(bullet.angle) * r;
            var by = Math.sin(bullet.angle) * r;
            spawnParticles(CX + bx, CY + by, getColor('--color-accent'), 12);
            bullet = null;
            lives--;
            updateHUD();
            if (lives <= 0) { cancelAnimationFrame(rafId); showOver(); return; }
            break;
          }
          bullet.cleared[i] = true;
        }
      }

      /* Hit center target */
      if (bullet && bullet.r <= TARGET_R) {
        spawnParticles(CX, CY, getColor('--color-accent'), 16);
        bullet = null;
        score++;
        if (score % 5 === 0) {
          level++;
          setupLevel();
        }
        updateHUD();
      }
    }

    /* Particles */
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /* ── Render ─────────────────────────────────────────── */
  function render() {
    var bg      = getColor('--color-bg');
    var fg      = getColor('--color-text');
    var accent  = getColor('--color-accent');
    var border  = getColor('--color-border');
    var textSec = getColor('--color-text-secondary');

    ctx.clearRect(0, 0, CW, CH);

    /* Orbit path (faint dashed) */
    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CX, CY, SHIP_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* Center target */
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(CX, CY, TARGET_R, 0, Math.PI * 2);
    ctx.fill();

    /* Arcs */
    var radii = [INNER_R, MIDDLE_R, OUTER_R];
    var gapDeg = levelCfg[3];
    var gapRad = gapDeg * DEG;

    for (var i = 0; i < 3; i++) {
      var r = radii[i];
      var gapCenterRad = arcs[i].angle * DEG;
      var startA = gapCenterRad + gapRad / 2;
      var endA   = gapCenterRad - gapRad / 2 + Math.PI * 2;

      ctx.strokeStyle = fg;
      ctx.lineWidth = ARC_THICKNESS;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(CX, CY, r, startA, endA);
      ctx.stroke();
    }

    /* Bullet with trail */
    if (bullet) {
      var bx = CX + Math.cos(bullet.angle) * bullet.r;
      var by = CY + Math.sin(bullet.angle) * bullet.r;
      var tx = CX + Math.cos(bullet.angle) * (bullet.r + 18);
      var ty = CY + Math.sin(bullet.angle) * (bullet.r + 18);

      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Ship (chevron pointing inward) */
    var sx = CX + Math.cos(shipAngle) * SHIP_R;
    var sy = CY + Math.sin(shipAngle) * SHIP_R;
    var inward = shipAngle + Math.PI;   // angle toward center
    var wingSpread = 0.5;
    var tipLen = 14;
    var wingLen = 10;

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(inward) * tipLen, sy + Math.sin(inward) * tipLen);
    ctx.lineTo(sx + Math.cos(inward + wingSpread) * -wingLen, sy + Math.sin(inward + wingSpread) * -wingLen);
    ctx.lineTo(sx + Math.cos(inward - wingSpread) * -wingLen, sy + Math.sin(inward - wingSpread) * -wingLen);
    ctx.closePath();
    ctx.fill();

    /* Particles */
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── Game loop ──────────────────────────────────────── */
  function loop() {
    update();
    render();
    rafId = requestAnimationFrame(loop);
  }

  /* ── Input ──────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      fire();
    }
  });
  document.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  /* Mobile buttons */
  function addHold(btn, code) {
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); keys[code] = true; }, { passive: false });
    btn.addEventListener('touchend',   function (e) { e.preventDefault(); keys[code] = false; }, { passive: false });
    btn.addEventListener('mousedown',  function () { keys[code] = true; });
    btn.addEventListener('mouseup',    function () { keys[code] = false; });
    btn.addEventListener('mouseleave', function () { keys[code] = false; });
  }
  addHold(document.getElementById('btn-left'),  'ArrowLeft');
  addHold(document.getElementById('btn-right'), 'ArrowRight');
  document.getElementById('btn-fire').addEventListener('touchstart', function (e) { e.preventDefault(); fire(); }, { passive: false });
  document.getElementById('btn-fire').addEventListener('click', function () { fire(); });

  /* ── Start / restart ────────────────────────────────── */
  startBtn.addEventListener('click', function () {
    initGame();
    showGame();
    rafId = requestAnimationFrame(loop);
  });

  playAgainBtn.addEventListener('click', function () {
    initGame();
    showGame();
    rafId = requestAnimationFrame(loop);
  });

  showStart();
})();
