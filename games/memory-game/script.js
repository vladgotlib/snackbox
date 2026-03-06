(function () {
  // ── Emoji Sets ──────────────────────────────────────────
  const THEMES = {
    animals: ['🐶','🐱','🐸','🦊','🐻','🐼','🐨','🦁','🐯','🐮','🐷','🐵','🐔','🐧','🐴','🦄','🐝','🐙','🦋','🐢','🦈','🐘','🦒','🦜','🐳'],
    food:    ['🍎','🍕','🍔','🌮','🍩','🍪','🍫','🧁','🍰','🍿','🥑','🍓','🍉','🥝','🍋','🥕','🌽','🧀','🥐','🍇','🥭','🍑','🫐','🥨','🧆'],
    sports:  ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🏋️','🤸','🚴','⛷️','🏄','🤽','🏇','🥋','🤺','🏹','🛹','🤿','🧗','⛳'],
    objects: ['🎸','🎹','🎮','🎲','🔮','🧲','💡','🔑','🎁','🎈','🎭','🧩','📷','💎','🔔','🕹️','🪁','🧸','🔭','🧪','⏰','🎨','🪄','🎯','🪩'],
  };

  // ── DOM refs ────────────────────────────────────────────
  const boardEl       = document.getElementById('game-board');
  const moveCounterEl = document.getElementById('move-counter');
  const timerEl       = document.getElementById('timer');
  const starRatingEl  = document.getElementById('star-rating');
  const themeSelect   = document.getElementById('theme-select');
  const rowsInput     = document.getElementById('rows-input');
  const colsInput     = document.getElementById('cols-input');
  const restartBtn    = document.getElementById('restart-btn');
  const modalOverlay  = document.getElementById('win-modal');
  const modalMoves    = document.getElementById('modal-moves');
  const modalTime     = document.getElementById('modal-time');
  const modalStars    = document.getElementById('modal-stars');
  const playAgainBtn  = document.getElementById('play-again-btn');

  // ── Game state ──────────────────────────────────────────
  let currentTheme = 'animals';
  let gridRows     = 4;
  let gridCols     = 4;
  let cards        = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let totalPairs   = 0;
  let moves        = 0;
  let seconds      = 0;
  let timerInterval = null;
  let timerStarted = false;
  let locked       = false;

  // ── Utility ─────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function getStarRating(moves, pairCount) {
    if (moves <= pairCount * 1.5) return 3;
    if (moves <= pairCount * 2.5) return 2;
    return 1;
  }

  function starsString(count) {
    return '★'.repeat(count) + '☆'.repeat(3 - count);
  }

  function clampValue(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── Timer ───────────────────────────────────────────────
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timerInterval = setInterval(function () {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerStarted = false;
  }

  // ── Game Init ───────────────────────────────────────────
  function initGame() {
    stopTimer();
    seconds = 0;
    moves = 0;
    matchedPairs = 0;
    flippedCards = [];
    locked = false;
    timerStarted = false;

    var totalCells = gridRows * gridCols;
    var isOdd = totalCells % 2 !== 0;
    var playableCells = isOdd ? totalCells - 1 : totalCells;
    totalPairs = playableCells / 2;
    const emojis = THEMES[currentTheme].slice(0, totalPairs);
    cards = shuffle([...emojis, ...emojis]);

    moveCounterEl.textContent = '0';
    timerEl.textContent = '0:00';
    starRatingEl.textContent = '★★★';

    renderBoard(gridCols, gridRows, isOdd);
  }

  // ── Render Board ────────────────────────────────────────
  function renderBoard(cols, rows, hasEmptyCell) {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--cols', cols);

    cards.forEach(function (emoji, i) {
      var card = document.createElement('div');
      card.className = 'mc-card';
      card.dataset.index = i;
      card.dataset.emoji = emoji;
      card.innerHTML =
        '<div class="mc-card-inner">' +
          '<div class="mc-card-face mc-card-front"></div>' +
          '<div class="mc-card-face mc-card-back">' + emoji + '</div>' +
        '</div>';
      boardEl.appendChild(card);
    });

    if (hasEmptyCell) {
      var placeholder = document.createElement('div');
      placeholder.className = 'mc-card-placeholder';
      boardEl.appendChild(placeholder);
    }
  }

  // ── Card Interaction ────────────────────────────────────
  function flipCard(cardEl) {
    if (locked) return;
    if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

    startTimer();
    cardEl.classList.add('flipped');
    flippedCards.push(cardEl);

    if (flippedCards.length === 2) {
      moves++;
      updateStats();
      locked = true;
      setTimeout(checkMatch, 450);
    }
  }

  function checkMatch() {
    var a = flippedCards[0];
    var b = flippedCards[1];

    if (a.dataset.emoji === b.dataset.emoji) {
      a.classList.add('matched');
      b.classList.add('matched');
      flippedCards = [];
      matchedPairs++;
      locked = false;

      if (matchedPairs === totalPairs) {
        stopTimer();
        setTimeout(showWinModal, 500);
      }
    } else {
      a.classList.add('shake');
      b.classList.add('shake');
      setTimeout(function () {
        a.classList.remove('flipped', 'shake');
        b.classList.remove('flipped', 'shake');
        flippedCards = [];
        locked = false;
      }, 700);
    }
  }

  function updateStats() {
    moveCounterEl.textContent = moves;
    var stars = getStarRating(moves, totalPairs);
    starRatingEl.textContent = starsString(stars);
  }

  // ── Modal ───────────────────────────────────────────────
  function showWinModal() {
    var stars = getStarRating(moves, totalPairs);
    modalMoves.textContent = moves;
    modalTime.textContent = formatTime(seconds);
    modalStars.textContent = starsString(stars);
    modalOverlay.classList.remove('hidden');
  }

  function hideWinModal() {
    modalOverlay.classList.add('hidden');
  }

  // ── Event Listeners ────────────────────────────────────
  boardEl.addEventListener('click', function (e) {
    var card = e.target.closest('.mc-card');
    if (card) flipCard(card);
  });

  themeSelect.addEventListener('change', function () {
    currentTheme = this.value;
    initGame();
  });

  rowsInput.addEventListener('change', function () {
    gridRows = clampValue(parseInt(this.value, 10) || 3, 3, 7);
    this.value = gridRows;
    initGame();
  });

  colsInput.addEventListener('change', function () {
    gridCols = clampValue(parseInt(this.value, 10) || 3, 3, 7);
    this.value = gridCols;
    initGame();
  });

  restartBtn.addEventListener('click', initGame);
  playAgainBtn.addEventListener('click', function () {
    hideWinModal();
    initGame();
  });

  // ── Start ───────────────────────────────────────────────
  initGame();
})();
