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

        // After dramatic pause, reveal the answer
        setTimeout(function () {
            document.getElementById('oracleChamber').style.display = 'none';
            document.getElementById('revelation').style.display = 'block';
            document.getElementById('revelation').textContent = answer;
            document.getElementById('resetButton').style.display = 'inline-block';
        }, 4000);
    }

    function resetOracle() {
        secretAnswer = '';
        incantationIndex = 0;
        mysticalInput.value = '';
        hiddenAnswer.textContent = '';
        document.getElementById('inputPhase').style.display = 'block';
        document.getElementById('oracleChamber').style.display = 'none';
        document.getElementById('revelation').style.display = 'none';
        document.getElementById('resetButton').style.display = 'none';
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
