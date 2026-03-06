const scoreEl = document.getElementById("score");
const clickBtn = document.getElementById("click-btn");
const resetBtn = document.getElementById("reset-btn");

let score = 0;

clickBtn.addEventListener("click", () => {
  score++;
  scoreEl.textContent = score;
});

resetBtn.addEventListener("click", () => {
  score = 0;
  scoreEl.textContent = score;
});
