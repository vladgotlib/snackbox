(function () {
  var TOTAL = 1207;
  var MAX_PICKS = 3;

  var grid = document.getElementById('grid');
  var picksDisplay = document.getElementById('picks');
  var attemptsDisplay = document.getElementById('attempts');
  var resultDisplay = document.getElementById('result');
  var resetBtn = document.getElementById('reset-btn');

  var winners = [];
  var selected = [];
  var attempts = 0;
  var revealed = false;

  function init() {
    buildGrid();
    pickWinners();
  }

  function buildGrid() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TOTAL; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      frag.appendChild(cell);
    }
    grid.appendChild(frag);
  }

  function pickWinners() {
    winners = [];
    while (winners.length < MAX_PICKS) {
      var r = Math.floor(Math.random() * TOTAL);
      if (winners.indexOf(r) === -1) winners.push(r);
    }
  }

  function reset() {
    revealed = false;
    selected = [];
    resultDisplay.textContent = '';
    resultDisplay.className = 'result-message';
    picksDisplay.textContent = '0 / 3';

    var cells = grid.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].className = 'cell';
    }

    pickWinners();
  }

  function reveal() {
    revealed = true;
    attempts++;
    attemptsDisplay.textContent = attempts;

    var correct = 0;
    for (var i = 0; i < selected.length; i++) {
      if (winners.indexOf(selected[i]) !== -1) {
        correct++;
      } else {
        grid.children[selected[i]].classList.add('wrong');
      }
    }

    for (var j = 0; j < winners.length; j++) {
      grid.children[winners[j]].classList.remove('selected');
      grid.children[winners[j]].classList.add('winner');
    }

    if (correct === MAX_PICKS) {
      resultDisplay.textContent = 'You won! Go buy a lottery ticket. Seriously.';
      resultDisplay.className = 'result-message win';
    } else {
      resultDisplay.textContent = 'You matched ' + correct + ' of 3. You lost — just like real Powerball.';
      resultDisplay.className = 'result-message lose';
    }
  }

  // Event delegation
  grid.addEventListener('click', function (e) {
    if (revealed) return;
    var cell = e.target;
    if (!cell.classList.contains('cell')) return;

    var index = parseInt(cell.dataset.index, 10);

    // Toggle off
    var pos = selected.indexOf(index);
    if (pos !== -1) {
      selected.splice(pos, 1);
      cell.classList.remove('selected');
      picksDisplay.textContent = selected.length + ' / 3';
      return;
    }

    // At max picks
    if (selected.length >= MAX_PICKS) return;

    selected.push(index);
    cell.classList.add('selected');
    picksDisplay.textContent = selected.length + ' / 3';

    if (selected.length === MAX_PICKS) {
      reveal();
    }
  });

  resetBtn.addEventListener('click', reset);

  init();
})();

/* Pixel Path Challenge */
(function () {
  var GRID = 21;
  var CELL = 28;
  var SIZE = GRID * CELL;
  var MOVES = 10;
  var CENTER = 10;

  var canvas = document.getElementById('path-canvas');
  var ctx = canvas.getContext('2d');
  var movesDisplay = document.getElementById('path-moves');
  var matchesDisplay = document.getElementById('path-matches');
  var attemptsDisplay = document.getElementById('path-attempts');
  var resultDisplay = document.getElementById('path-result');
  var resetBtn = document.getElementById('path-reset-btn');

  var DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ];

  var winPath = [];
  var winDirs = [];
  var userPath = [];
  var userDirs = [];
  var attempts = 0;
  var done = false;

  function inBounds(x, y) {
    return x >= 0 && x < GRID && y >= 0 && y < GRID;
  }

  function generatePath() {
    winPath = [{ x: CENTER, y: CENTER }];
    winDirs = [];
    var visited = {};
    visited[CENTER + ',' + CENTER] = true;
    for (var i = 0; i < MOVES; i++) {
      var cur = winPath[winPath.length - 1];
      var valid = [];
      for (var d = 0; d < DIRS.length; d++) {
        var nx = cur.x + DIRS[d][0];
        var ny = cur.y + DIRS[d][1];
        if (inBounds(nx, ny) && !visited[nx + ',' + ny]) valid.push(d);
      }
      var pick = valid[Math.floor(Math.random() * valid.length)];
      winDirs.push(pick);
      var next = { x: cur.x + DIRS[pick][0], y: cur.y + DIRS[pick][1] };
      visited[next.x + ',' + next.y] = true;
      winPath.push(next);
    }
  }

  function getColors() {
    var style = getComputedStyle(document.documentElement);
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      bg: style.getPropertyValue('--color-bg').trim() || (isDark ? '#1a1a2e' : '#ffffff'),
      grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      win: '#ef4444',
      user: isDark ? '#e2e8f0' : '#1e293b',
      start: '#22c55e',
      text: style.getPropertyValue('--color-text').trim() || (isDark ? '#eee' : '#111')
    };
  }

  function cellCenter(gx, gy) {
    return { px: gx * CELL + CELL / 2, py: gy * CELL + CELL / 2 };
  }

  function render() {
    var c = getColors();
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Grid lines
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (var i = 0; i <= GRID; i++) {
      var p = i * CELL + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(SIZE, p); ctx.stroke();
    }

    // Winning path — revealed as circles + dashed line with step numbers
    if (done) {
      var radius = CELL / 2 - 4;
      // Dashed connecting line
      ctx.strokeStyle = c.win;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < winPath.length; i++) {
        var cc = cellCenter(winPath[i].x, winPath[i].y);
        if (i === 0) ctx.moveTo(cc.px, cc.py);
        else ctx.lineTo(cc.px, cc.py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Circles with step numbers
      for (var i = 0; i < winPath.length; i++) {
        var cc = cellCenter(winPath[i].x, winPath[i].y);
        ctx.beginPath();
        ctx.arc(cc.px, cc.py, radius, 0, Math.PI * 2);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = c.win;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = c.win;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, cc.px, cc.py);
      }
    }

    // Start cell (only before reveal — after reveal the numbered markers cover it)
    if (!done) {
      ctx.fillStyle = c.start;
      ctx.fillRect(CENTER * CELL + 2, CENTER * CELL + 2, CELL - 4, CELL - 4);
    }

    // User path — filled squares + solid line with step numbers
    if (userPath.length > 0) {
      // Solid connecting line
      ctx.strokeStyle = c.user;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < userPath.length; i++) {
        var cc = cellCenter(userPath[i].x, userPath[i].y);
        if (i === 0) ctx.moveTo(cc.px, cc.py);
        else ctx.lineTo(cc.px, cc.py);
      }
      ctx.stroke();
      // Squares with step numbers
      for (var i = 0; i < userPath.length; i++) {
        var up = userPath[i];
        ctx.fillStyle = c.user;
        ctx.fillRect(up.x * CELL + 4, up.y * CELL + 4, CELL - 8, CELL - 8);
        var cc = cellCenter(up.x, up.y);
        ctx.fillStyle = c.bg;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, cc.px, cc.py);
      }
    }
  }

  function evaluate() {
    done = true;
    attempts++;
    attemptsDisplay.textContent = attempts;

    var matches = 0;
    for (var i = 1; i <= MOVES; i++) {
      if (userPath[i].x === winPath[i].x && userPath[i].y === winPath[i].y) matches++;
    }
    matchesDisplay.textContent = matches + ' / ' + MOVES;

    if (matches === MOVES) {
      resultDisplay.textContent = 'All 10 moves matched! You just beat 1-in-a-billion odds!';
      resultDisplay.className = 'result-message win';
    } else {
      resultDisplay.textContent = matches + ' of ' + MOVES + ' moves matched. Try again!';
      resultDisplay.className = 'result-message lose';
    }

    render();
  }

  function resetGame() {
    done = false;
    userPath = [];
    userDirs = [];
    movesDisplay.textContent = '0 / ' + MOVES;
    matchesDisplay.textContent = '—';
    resultDisplay.textContent = '';
    resultDisplay.className = 'result-message';
    generatePath();
    render();
  }

  function getGridCell(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = SIZE / rect.width;
    var scaleY = SIZE / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top) * scaleY;
    return { x: Math.floor(mx / CELL), y: Math.floor(my / CELL) };
  }

  canvas.addEventListener('mousemove', function (e) {
    if (done) return;

    var cell = getGridCell(e);
    if (!inBounds(cell.x, cell.y)) return;

    // Start tracking when mouse enters center cell
    if (userPath.length === 0) {
      if (cell.x === CENTER && cell.y === CENTER) {
        userPath.push({ x: CENTER, y: CENTER });
        render();
      }
      return;
    }

    var last = userPath[userPath.length - 1];
    if (cell.x === last.x && cell.y === last.y) return;

    // Must be adjacent (one of 8 neighbors)
    var dx = cell.x - last.x;
    var dy = cell.y - last.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return;

    // Find which direction index this is
    var dirIdx = -1;
    for (var d = 0; d < DIRS.length; d++) {
      if (DIRS[d][0] === dx && DIRS[d][1] === dy) { dirIdx = d; break; }
    }
    if (dirIdx === -1) return;

    // Reject move if cell already visited by user path
    for (var i = 0; i < userPath.length; i++) {
      if (userPath[i].x === cell.x && userPath[i].y === cell.y) return;
    }

    userPath.push({ x: cell.x, y: cell.y });
    userDirs.push(dirIdx);
    movesDisplay.textContent = userDirs.length + ' / ' + MOVES;
    render();

    if (userDirs.length === MOVES) {
      evaluate();
    }
  });

  resetBtn.addEventListener('click', resetGame);

  // Observe theme changes to re-render with correct colors
  var observer = new MutationObserver(function () { render(); });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  generatePath();
  render();
})();
