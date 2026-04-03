(function () {
    // Create starfield
    function createStars() {
        const starsContainer = document.getElementById('stars');
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.animationDuration = (Math.random() * 3 + 2) + 's';
            starsContainer.appendChild(star);
        }
    }

    createStars();

    let secretAnswer = '';
    const incantation = "Oh great oracle, reveal the truth";
    let incantationIndex = 0;

    const mysticalInput = document.getElementById('mysticalInput');
    const hiddenAnswer = document.getElementById('hiddenAnswer');

    // Capture the real input while showing fake text
    mysticalInput.addEventListener('input', function (e) {
        const input = e.target;
        const typed = input.value;

        // Store what was actually typed
        if (typed.length > incantationIndex) {
            // User typed a new character
            secretAnswer += typed[typed.length - 1];
        } else if (typed.length < incantationIndex) {
            // User pressed backspace
            secretAnswer = secretAnswer.slice(0, -1);
        }

        // Show the incantation text instead
        incantationIndex = typed.length;
        input.value = incantation.substring(0, incantationIndex);

        // Store the secret answer
        hiddenAnswer.textContent = secretAnswer;
    });

    // Prevent cursor movement with arrow keys
    mysticalInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }
    });

    function consultOracle() {
        let answer = hiddenAnswer.textContent.trim();

        // Remove everything after "." delimiter
        const delimiterIndex = answer.indexOf(".");
        if (delimiterIndex !== -1) {
            answer = answer.substring(0, delimiterIndex);
        }

        answer = answer.trim();

        if (!answer) {
            alert('The oracle requires more spiritual energy... (Type an answer!)');
            return;
        }

        // Hide input phase
        document.getElementById('inputPhase').style.display = 'none';

        // Show oracle chamber
        document.getElementById('oracleChamber').style.display = 'block';

        // After dramatic pause, begin the grand reveal sequence
        setTimeout(function () {
            document.getElementById('oracleChamber').style.display = 'none';
            revealAnswer(answer);
        }, 4000);
    }

    var preambles = [
        'The spirits have spoken\u2026',
        'The Mystic Oracle says\u2026',
        'From the astral plane, the truth emerges\u2026',
        'The ancient ones whisper\u2026',
        'Beyond the stars, the answer is clear\u2026',
        'The cosmos aligns to reveal\u2026',
        'Through the mists of time, the oracle sees\u2026'
    ];

    var runeSymbols = [
        '\u16A0','\u16A2','\u16A6','\u16A8','\u16B1','\u16B7','\u16C1','\u16C7',
        '\u16D2','\u16D6','\u16DA','\u16DE','\u16DF','\u16E0'
    ];

    function revealAnswer(answer) {
        var revelation = document.getElementById('revelation');
        var burst = document.getElementById('revealBurst');
        var runes = document.getElementById('revealRunes');
        var preamble = document.getElementById('revealPreamble');
        var answerEl = document.getElementById('revealAnswer');
        var ornaments = revelation.querySelectorAll('.revelation__ornament');

        // Reset inner content
        runes.innerHTML = '';
        preamble.textContent = '';
        preamble.classList.remove('active');
        answerEl.innerHTML = '';
        answerEl.classList.remove('complete');
        burst.classList.remove('active');
        ornaments.forEach(function (o) { o.classList.remove('active'); });

        // Show the container
        revelation.style.display = 'block';

        // Stage 1: Light burst (0ms)
        burst.classList.add('active');

        // Stage 2: Floating runes (300ms)
        setTimeout(function () {
            for (var i = 0; i < 8; i++) {
                var rune = document.createElement('span');
                rune.className = 'rune';
                rune.textContent = runeSymbols[Math.floor(Math.random() * runeSymbols.length)];
                rune.style.left = (10 + Math.random() * 80) + '%';
                rune.style.top = (10 + Math.random() * 80) + '%';
                rune.style.animationDelay = (i * 0.15) + 's';
                runes.appendChild(rune);
            }
        }, 300);

        // Stage 3: Preamble (800ms)
        setTimeout(function () {
            preamble.textContent = preambles[Math.floor(Math.random() * preambles.length)];
            preamble.classList.add('active');
        }, 800);

        // Stage 4: Ornaments (2000ms)
        setTimeout(function () {
            ornaments.forEach(function (o) { o.classList.add('active'); });
        }, 2000);

        // Stage 5: Letter-by-letter answer (2500ms)
        setTimeout(function () {
            for (var i = 0; i < answer.length; i++) {
                var span = document.createElement('span');
                span.className = 'letter';
                span.textContent = answer[i] === ' ' ? '\u00A0' : answer[i];
                span.style.animationDelay = (i * 0.08) + 's';
                answerEl.appendChild(span);
            }

            // After all letters revealed, add pulse and show reset
            var totalTime = answer.length * 80 + 600;
            setTimeout(function () {
                answerEl.classList.add('complete');
                document.getElementById('resetButton').classList.add('visible');
            }, totalTime);
        }, 2500);
    }

    function resetOracle() {
        secretAnswer = '';
        incantationIndex = 0;
        mysticalInput.value = '';
        hiddenAnswer.textContent = '';
        document.getElementById('inputPhase').style.display = 'block';
        document.getElementById('oracleChamber').style.display = 'none';
        document.getElementById('revelation').style.display = 'none';
        document.getElementById('resetButton').classList.remove('visible');
        document.getElementById('revealBurst').classList.remove('active');
        document.getElementById('revealRunes').innerHTML = '';
        document.getElementById('revealPreamble').textContent = '';
        document.getElementById('revealPreamble').classList.remove('active');
        document.getElementById('revealAnswer').innerHTML = '';
        document.getElementById('revealAnswer').classList.remove('complete');
        document.querySelectorAll('.revelation__ornament').forEach(function (o) {
            o.classList.remove('active');
        });
    }

    // Button event listeners
    document.getElementById('consultBtn').addEventListener('click', consultOracle);
    document.getElementById('resetButton').addEventListener('click', resetOracle);

    // Allow Enter key to consult oracle
    mysticalInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            consultOracle();
        }
    });
})();
