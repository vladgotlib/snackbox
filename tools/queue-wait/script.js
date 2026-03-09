const yourNumberInput = document.getElementById('your-number');
const nowServingInput = document.getElementById('now-serving');
const addBtn = document.getElementById('add-btn');
const estimateEl = document.getElementById('estimate');
const messageEl = document.getElementById('message');
const obsSection = document.getElementById('observations-section');
const obsList = document.getElementById('observations-list');

const waitTimeEl = document.getElementById('wait-time');
const callTimeEl = document.getElementById('call-time');
const aheadEl = document.getElementById('ahead');
const rateEl = document.getElementById('rate');

let observations = [];

addBtn.addEventListener('click', addObservation);
nowServingInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') addObservation();
});
yourNumberInput.addEventListener('input', updateEstimate);

function addObservation() {
  const num = parseInt(nowServingInput.value, 10);
  if (isNaN(num)) return;

  observations.push({ number: num, timestamp: Date.now() });
  nowServingInput.value = '';
  nowServingInput.focus();
  render();
}

function removeObservation(index) {
  observations.splice(index, 1);
  render();
}

function render() {
  renderList();
  updateEstimate();
}

function renderList() {
  obsList.innerHTML = '';

  if (observations.length === 0) {
    obsSection.classList.add('hidden');
    return;
  }

  obsSection.classList.remove('hidden');

  observations.forEach(function(obs, i) {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.className = 'obs-text';
    span.textContent = '#' + obs.number + ' at ' + formatTime(obs.timestamp);
    li.appendChild(span);

    const btn = document.createElement('button');
    btn.className = 'obs-remove';
    btn.textContent = 'Remove';
    btn.addEventListener('click', function() { removeObservation(i); });
    li.appendChild(btn);

    obsList.appendChild(li);
  });
}

function updateEstimate() {
  const yourNumber = parseInt(yourNumberInput.value, 10);

  if (observations.length < 2 || isNaN(yourNumber)) {
    estimateEl.classList.add('hidden');
    messageEl.classList.remove('hidden');
    if (observations.length < 2) {
      messageEl.textContent = 'Log at least 2 observations to see an estimate.';
    } else {
      messageEl.textContent = 'Enter your number to see an estimate.';
    }
    return;
  }

  // Linear regression: number vs timestamp
  const n = observations.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = observations[i].number;
    const y = observations[i].timestamp;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    estimateEl.classList.add('hidden');
    messageEl.classList.remove('hidden');
    messageEl.textContent = 'Need observations with different serving numbers.';
    return;
  }

  const slope = (n * sumXY - sumX * sumY) / denom; // ms per number
  const intercept = (sumY - slope * sumX) / n;

  const msPerNumber = slope;
  const minPerNumber = msPerNumber / 60000;

  if (minPerNumber <= 0) {
    estimateEl.classList.add('hidden');
    messageEl.classList.remove('hidden');
    messageEl.textContent = 'Something looks off — numbers should increase over time.';
    return;
  }

  const latestServing = observations[observations.length - 1].number;
  const numbersAhead = Math.max(0, yourNumber - latestServing);

  if (numbersAhead === 0) {
    estimateEl.classList.add('hidden');
    messageEl.classList.remove('hidden');
    messageEl.textContent = 'Your number has been called (or is being served now)!';
    return;
  }

  const estimatedCallTime = intercept + slope * yourNumber;
  const now = Date.now();
  const waitMs = Math.max(0, estimatedCallTime - now);
  const waitMin = Math.round(waitMs / 60000);

  messageEl.classList.add('hidden');
  estimateEl.classList.remove('hidden');

  waitTimeEl.textContent = '~' + waitMin + ' min';
  callTimeEl.textContent = '~' + formatTime(estimatedCallTime);
  aheadEl.textContent = numbersAhead;
  rateEl.textContent = '~' + minPerNumber.toFixed(1);
}

function formatTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}
