const textInput = document.getElementById("text-input");
const charsEl = document.getElementById("chars");
const wordsEl = document.getElementById("words");
const linesEl = document.getElementById("lines");

function update() {
  const text = textInput.value;
  charsEl.textContent = text.length;
  wordsEl.textContent = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  linesEl.textContent = text === "" ? 0 : text.split(/\n/).length;
}

textInput.addEventListener("input", update);
