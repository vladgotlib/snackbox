(function () {
  // ── Color definitions ─────────────────────────────────
  var COLORS = [
    { name: 'red',    hex: '#e53e3e' },
    { name: 'blue',   hex: '#3b82f6' },
    { name: 'green',  hex: '#22c55e' },
    { name: 'yellow', hex: '#eab308' },
    { name: 'orange', hex: '#f97316' },
    { name: 'purple', hex: '#a855f7' },
    { name: 'pink',   hex: '#ec4899' },
    { name: 'white',  hex: '#e5e5e5' },
  ];

  var GAME_DURATION = 60;
  var PENALTY_SECONDS = 2;

  // ── DOM refs ──────────────────────────────────────────
  var startScreen    = document.getElementById('start-screen');
  var countdownScreen = document.getElementById('countdown-screen');
  var countdownNumber = document.getElementById('countdown-number');
  var gameScreen     = document.getElementById('game-screen');
  var gameoverScreen = document.getElementById('gameover-screen');
  var startBtn       = document.getElementById('start-btn');
  var playAgainBtn   = document.getElementById('play-again-btn');
  var colorWordEl    = document.getElementById('color-word');
  var colorInput     = document.getElementById('color-input');
  var timerDisplay   = document.getElementById('timer-display');
  var timerFill      = document.getElementById('timer-fill');
  var scoreDisplay   = document.getElementById('score-display');
  var comboDisplay   = document.getElementById('combo-display');
  var feedbackEl     = document.getElementById('feedback');
  var finalScoreEl   = document.getElementById('final-score');
  var statCorrectEl  = document.getElementById('stat-correct');
  var statWrongEl    = document.getElementById('stat-wrong');
  var statBestCombo  = document.getElementById('stat-best-combo');

  // ── Hint panel ────────────────────────────────────────
  var hintToggle = document.getElementById('hint-toggle');
  var hintPanel  = document.getElementById('hint-panel');

  COLORS.forEach(function (c) {
    var span = document.createElement('span');
    span.textContent = c.name;
    span.style.color = c.hex;
    hintPanel.appendChild(span);
  });

  hintToggle.addEventListener('click', function () {
    hintPanel.classList.toggle('hidden');
  });

  // ── Game state ────────────────────────────────────────
  var score, combo, bestCombo, correctCount, wrongCount;
  var timeLeft, timerInterval;
  var currentWord, currentColor;
  var gameActive;

  // ── Combo multiplier logic ────────────────────────────
  function getMultiplier(c) {
    if (c >= 10) return 4;
    if (c >= 6) return 3;
    if (c >= 3) return 2;
    return 1;
  }

  // ── Pick next word ────────────────────────────────────
  function nextWord() {
    var wordIndex = Math.floor(Math.random() * COLORS.length);
    var colorIndex;
    do {
      colorIndex = Math.floor(Math.random() * COLORS.length);
    } while (colorIndex === wordIndex);

    currentWord = COLORS[wordIndex].name;
    currentColor = COLORS[colorIndex];

    colorWordEl.textContent = currentWord.toUpperCase();
    colorWordEl.style.color = currentColor.hex;
  }

  // ── Check answer ──────────────────────────────────────
  function checkAnswer(input) {
    var answer = input.trim().toLowerCase();
    if (!answer) return;

    if (answer === currentColor.name) {
      // Correct
      combo++;
      if (combo > bestCombo) bestCombo = combo;
      correctCount++;
      var mult = getMultiplier(combo);
      score += mult;
      scoreDisplay.textContent = score;
      comboDisplay.textContent = 'x' + mult;

      showFeedback(true, '+' + mult + (combo >= 3 ? ' (x' + mult + ' combo!)' : ''));
      flashInput('correct');
      animateWord('correct');
      nextWord();
    } else {
      // Wrong
      wrongCount++;
      combo = 0;
      comboDisplay.textContent = 'x1';
      timeLeft = Math.max(0, timeLeft - PENALTY_SECONDS);
      updateTimerDisplay();

      showFeedback(false, '-' + PENALTY_SECONDS + 's penalty');
      flashInput('wrong');
      animateWord('wrong');
    }

    colorInput.value = '';
  }

  // ── Visual feedback ───────────────────────────────────
  function showFeedback(isCorrect, text) {
    feedbackEl.textContent = text;
    feedbackEl.className = 'feedback ' + (isCorrect ? 'correct-text' : 'wrong-text');
    clearTimeout(feedbackEl._timeout);
    feedbackEl._timeout = setTimeout(function () {
      feedbackEl.textContent = '';
      feedbackEl.className = 'feedback';
    }, 1200);
  }

  function flashInput(type) {
    var cls = type === 'correct' ? 'flash-correct' : 'flash-wrong';
    colorInput.classList.add(cls);
    setTimeout(function () {
      colorInput.classList.remove(cls);
    }, 400);
  }

  function animateWord(type) {
    var cls = type === 'correct' ? 'correct-flash' : 'wrong-shake';
    colorWordEl.classList.remove('correct-flash', 'wrong-shake');
    // Force reflow to restart animation
    void colorWordEl.offsetWidth;
    colorWordEl.classList.add(cls);
    setTimeout(function () {
      colorWordEl.classList.remove(cls);
    }, 400);
  }

  // ── Timer ─────────────────────────────────────────────
  function updateTimerDisplay() {
    timerDisplay.textContent = timeLeft;
    var pct = (timeLeft / GAME_DURATION) * 100;
    timerFill.style.width = pct + '%';

    timerFill.classList.remove('warning', 'danger');
    if (timeLeft <= 10) {
      timerFill.classList.add('danger');
    } else if (timeLeft <= 20) {
      timerFill.classList.add('warning');
    }
  }

  function tick() {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      endGame();
    }
  }

  // ── Game flow ─────────────────────────────────────────
  function showCountdown(callback) {
    startScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');

    var count = 3;
    countdownNumber.textContent = count;
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = '';

    var interval = setInterval(function () {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        countdownScreen.classList.add('hidden');
        callback();
      } else {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth;
        countdownNumber.style.animation = '';
      }
    }, 700);
  }

  function startGame() {
    score = 0;
    combo = 0;
    bestCombo = 0;
    correctCount = 0;
    wrongCount = 0;
    timeLeft = GAME_DURATION;
    gameActive = true;

    scoreDisplay.textContent = '0';
    comboDisplay.textContent = 'x1';
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    colorInput.value = '';

    updateTimerDisplay();
    nextWord();

    gameScreen.classList.remove('hidden');
    colorInput.focus();

    timerInterval = setInterval(tick, 1000);
  }

  function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    updateTimerDisplay();

    gameScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');

    finalScoreEl.textContent = score;
    statCorrectEl.textContent = correctCount;
    statWrongEl.textContent = wrongCount;
    statBestCombo.textContent = 'x' + getMultiplier(bestCombo) + ' (' + bestCombo + ' streak)';
  }

  // ── Event listeners ───────────────────────────────────
  startBtn.addEventListener('click', function () {
    showCountdown(startGame);
  });

  playAgainBtn.addEventListener('click', function () {
    showCountdown(startGame);
  });

  colorInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && gameActive) {
      checkAnswer(colorInput.value);
    }
  });

  // Auto-submit on exact match
  colorInput.addEventListener('input', function () {
    if (!gameActive) return;
    var val = colorInput.value.trim().toLowerCase();
    for (var i = 0; i < COLORS.length; i++) {
      if (val === COLORS[i].name) {
        checkAnswer(colorInput.value);
        return;
      }
    }
  });
})();
