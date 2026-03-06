(function () {
  var stored = localStorage.getItem('snackbox-theme');
  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('snackbox-theme', next);
    updateToggleIcon();
  };

  function updateToggleIcon() {
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '\u2600' : '\u263E';
    }
  }

  document.addEventListener('DOMContentLoaded', updateToggleIcon);
})();
