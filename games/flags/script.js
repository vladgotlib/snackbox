;(function () {
  'use strict'

  // Slugs match the image filenames: flags/flag-of-<slug>.png
  const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua',
    'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas',
    'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
    'Benin', 'Bhutan', 'Bolivia', 'Bosnia-Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina-Faso', 'Burundi', 'Cabo-Verde', 'Cambodia',
    'Cameroon', 'Canada', 'Central-African-Republic', 'Chad', 'Chile', 'China',
    'Colombia', 'Comoros', 'Congo-Democratic-Republic-of', 'Congo',
    'Costa-Rica', 'Cote-d-Ivoire', 'Croatia', 'Cuba', 'Cyprus',
    'Czech-Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican-Republic',
    'Ecuador', 'Egypt', 'El-Salvador', 'Equatorial-Guinea', 'Eritrea',
    'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
    'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
    'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary',
    'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
    'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho',
    'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
    'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
    'Marshall-Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
    'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
    'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New-Zealand',
    'Nicaragua', 'Niger', 'Nigeria', 'Korea-North', 'North-Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua-New-Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'St-Kitts-Nevis',
    'St-Lucia', 'St-Vincent-the-Grenadines', 'Samoa', 'San-Marino',
    'Sao-Tome-and-Principe', 'Saudi-Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra-Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon-Islands', 'Somalia', 'South-Africa', 'Korea-South',
    'South-Sudan', 'Spain', 'Sri-Lanka', 'Sudan', 'Suriname', 'Sweden',
    'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
    'Timor-Leste', 'Togo', 'Tonga', 'Trinidad-and-Tobago', 'Tunisia',
    'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
    'United-Arab-Emirates', 'United-Kingdom', 'United-States-of-America',
    'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican-City', 'Venezuela',
    'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
  ]

  // Slugs whose display name isn't just hyphens-to-spaces
  const DISPLAY_OVERRIDES = {
    'Antigua': 'Antigua & Barbuda',
    'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
    'Congo-Democratic-Republic-of': 'DR Congo',
    'Cote-d-Ivoire': "Côte d'Ivoire",
    'Guinea-Bissau': 'Guinea-Bissau',
    'Korea-North': 'North Korea',
    'Korea-South': 'South Korea',
    'Sao-Tome-and-Principe': 'São Tomé & Príncipe',
    'St-Kitts-Nevis': 'St Kitts & Nevis',
    'St-Vincent-the-Grenadines': 'St Vincent & the Grenadines',
    'Timor-Leste': 'Timor-Leste',
    'Trinidad-and-Tobago': 'Trinidad & Tobago',
    'United-States-of-America': 'United States',
  }

  const FLAGS_PER_ROUND = 4
  const MEMORIZE_MS = 4000
  const FLIP_MS = 550 // flip duration + stagger, matches style.css

  const grid = document.getElementById('flagGrid')
  const bar = document.getElementById('countdownBar')
  const playRow = document.getElementById('playRow')
  const guessForm = document.getElementById('guessForm')
  const guessInput = document.getElementById('guessInput')
  const result = document.getElementById('result')
  const streakEl = document.getElementById('streak')
  const bestEl = document.getElementById('best')

  let phase = 'idle' // idle | memorize | shuffling | guess | done
  let round = [] // the 4 slugs on the table (in card order after shuffle)
  let hiddenIdx = -1
  let mode = 'easy'
  let streak = 0
  let best = parseInt(localStorage.getItem('missing-flag-best'), 10) || 0

  function displayName(slug) {
    return DISPLAY_OVERRIDES[slug] || slug.replace(/-/g, ' ')
  }

  function flagSrc(slug) {
    return 'flags/flag-of-' + slug + '.png'
  }

  // "Côte d'Ivoire" -> "cotedivoire": accents, punctuation, "the"/"and"/"&",
  // and the Saint/St distinction all get out of the way of a typed answer
  function normalize(name) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(the|and)\b|&/g, '')
      .replace(/\bsaint\b/g, 'st')
      .replace(/[^a-z0-9]/g, '')
  }

  function sample(arr, n) {
    const copy = arr.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, n)
  }

  function renderCards(cards) {
    grid.innerHTML = ''
    cards.forEach((card) => {
      const fig = document.createElement('figure')
      const img = document.createElement('img')
      img.src = card.src
      img.alt = card.alt
      const cap = document.createElement('figcaption')
      cap.textContent = card.caption
      if (card.mystery) cap.classList.add('mystery')
      fig.append(img, cap)
      grid.appendChild(fig)
    })
  }

  function setCard(i, card) {
    const fig = grid.children[i]
    const img = fig.querySelector('img')
    const cap = fig.querySelector('figcaption')
    img.src = card.src
    img.alt = card.alt
    cap.textContent = card.caption
    cap.classList.toggle('mystery', !!card.mystery)
    fig.classList.toggle('revealed', !!card.revealed)
  }

  function runCountdown(ms) {
    bar.classList.remove('running')
    bar.style.transitionDuration = '0s'
    bar.style.width = '100%'
    void bar.offsetWidth // flush, so the shrink animates from full
    bar.classList.add('running')
    bar.style.transitionDuration = ms + 'ms'
    bar.style.width = '0%'
  }

  function startRound(m) {
    mode = m
    phase = 'memorize'
    playRow.hidden = true
    result.hidden = true
    guessInput.value = ''

    round = sample(COUNTRIES, FLAGS_PER_ROUND)
    renderCards(
      round.map((slug) => ({
        src: flagSrc(slug),
        alt: 'Flag of ' + displayName(slug),
        caption: displayName(slug),
      }))
    )

    runCountdown(MEMORIZE_MS)
    setTimeout(shufflePhase, MEMORIZE_MS)
  }

  function shufflePhase() {
    phase = 'shuffling'
    const figures = [...grid.children]
    figures.forEach((fig) => fig.classList.add('down'))

    setTimeout(() => {
      round = sample(round, round.length)
      hiddenIdx = Math.floor(Math.random() * round.length)

      round.forEach((slug, i) => {
        if (i === hiddenIdx) {
          setCard(i, {
            src: mode === 'easy' ? flagSrc(slug) : 'flags/mysteryflag.png',
            alt: 'Mystery flag',
            caption: '???',
            mystery: true,
          })
        } else {
          setCard(i, {
            src: flagSrc(slug),
            alt: 'Flag of ' + displayName(slug),
            caption: displayName(slug),
          })
        }
      })

      figures.forEach((fig) => fig.classList.remove('down'))
      phase = 'guess'
      guessForm.hidden = false
      guessInput.focus()
    }, FLIP_MS)
  }

  function submitGuess(e) {
    e.preventDefault()
    if (phase !== 'guess') return
    const guess = guessInput.value.trim()
    if (!guess) return

    phase = 'done'
    guessForm.hidden = true
    playRow.hidden = false

    const answer = round[hiddenIdx]
    setCard(hiddenIdx, {
      src: flagSrc(answer),
      alt: 'Flag of ' + displayName(answer),
      caption: displayName(answer),
      revealed: true,
    })

    const correct = normalize(guess) === normalize(displayName(answer))
    result.hidden = false
    result.classList.toggle('ok', correct)
    if (correct) {
      result.textContent = 'Correct! It was ' + displayName(answer) + '. \u{1F389}'
      streak++
      if (streak > best) {
        best = streak
        localStorage.setItem('missing-flag-best', best)
      }
      confetti()
    } else {
      result.textContent = 'Not quite — it was ' + displayName(answer) + '.'
      streak = 0
    }
    updateScore()
  }

  function updateScore() {
    streakEl.textContent = streak
    bestEl.textContent = best > 0 ? best : '—'
  }

  function confetti() {
    const colors = ['#2563eb', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#a855f7']
    const holder = document.createElement('div')
    holder.className = 'confetti'
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('i')
      p.style.setProperty('--l', Math.random() * 100 + 'vw')
      p.style.setProperty('--c', colors[i % colors.length])
      p.style.setProperty('--d', 1.6 + Math.random() * 1.4 + 's')
      p.style.setProperty('--delay', Math.random() * 0.4 + 's')
      p.style.setProperty('--sway', (Math.random() * 16 - 8) + 'vw')
      p.style.setProperty('--spin', Math.floor(360 + Math.random() * 720) + 'deg')
      holder.appendChild(p)
    }
    document.body.appendChild(holder)
    setTimeout(() => holder.remove(), 3600)
  }

  // --- init ---

  const datalist = document.getElementById('countryList')
  COUNTRIES.map(displayName)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => {
      const opt = document.createElement('option')
      opt.value = name
      datalist.appendChild(opt)
    })

  renderCards(
    Array.from({ length: FLAGS_PER_ROUND }, () => ({
      src: 'flags/mysteryflag.png',
      alt: 'Mystery flag',
      caption: '???',
      mystery: true,
    }))
  )

  document.getElementById('playEasy').addEventListener('click', () => {
    if (phase === 'idle' || phase === 'done') startRound('easy')
  })
  document.getElementById('playHard').addEventListener('click', () => {
    if (phase === 'idle' || phase === 'done') startRound('hard')
  })
  guessForm.addEventListener('submit', submitGuess)

  updateScore()
})()
