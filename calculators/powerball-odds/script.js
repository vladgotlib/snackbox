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
