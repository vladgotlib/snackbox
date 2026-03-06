# Backlog

Ideas for new apps. Each entry has enough detail to implement as a standalone vanilla HTML/CSS/JS page.

---

## Games

### The Unwilling Button
A button that does NOT want to be clicked. It flees your cursor, argues in speech bubbles, negotiates, plays dead, and escalates through the five stages of grief. Score = successful clicks.
- Button moves away from the cursor using mousemove tracking
- Speech bubbles appear with increasingly desperate pleas ("Please, no," "I have a family," "Can we talk about this?")
- Button progresses through stages: denial → anger → bargaining → depression → acceptance
- Each successful click gets harder — button moves faster, shrinks, fakes disappearing
- Score counter tracks total clicks; rage-quit detection if cursor leaves the window

### Infinite Sandwich
Stack absurd ingredients on a wobbling sandwich tower with simple physics. How tall before it topples?
- Ingredient palette with ridiculous options: shoe, cloud, smaller sandwich, philosophy textbook, cactus, live fish, a regret
- Drag-and-drop stacking with basic physics (center of mass, wobble animation)
- Tower sways more as it gets taller; topples when balance threshold is exceeded
- Score = number of ingredients stacked before collapse
- "Screenshot Your Creation" button using canvas capture; ingredient name list shown alongside

### Gravity Doodle
Draw lines and ramps on a canvas, then drop a ball that bounces off your drawings with real physics. Guide it to the target zone.
- Freehand drawing tool on a canvas element
- "Drop Ball" button releases a circle from a starting point
- Simple 2D physics: gravity, bounce off drawn lines with angle reflection, friction
- Target zone highlighted on the canvas; reaching it = level complete
- Progressive levels add obstacles (moving platforms, portals, anti-gravity zones)

### Cursor Kart
Your actual mouse cursor IS the race car. A track is drawn on the page. Steer by moving your mouse. Hit walls = slow down.
- Track rendered on a full-page canvas with clear boundaries
- Cursor position = car position; car follows mouse movement with slight inertia
- Hitting track walls applies a speed penalty (brief freeze + red flash)
- AI ghost cursors (pre-recorded paths) race alongside you
- Lap timer and checkpoint system; finish line triggers results screen with time and ranking

---

## Tools

### Excuse Machine
Generate elaborate procedural excuses. Pick a category, adjust severity, and get a multi-clause masterpiece.
- Category picker: work, social, gym, family dinner, existential
- Severity slider from "white lie" to "soap opera" — controls clause count and drama level
- Template engine combines openings, complications, plot twists, and emotional closers
- Each generated excuse has a "Believability Rating" (satirical percentage)
- Copy-to-clipboard button; "Make It Worse" button adds another clause

### Meeting Cost Ticker
Enter headcount and average salary. Press start. Watch money burn in real-time with dramatic flair.
- Inputs: number of attendees, average annual salary (with sensible default)
- Start button begins a live-ticking dollar counter based on per-second cost
- Dramatic milestone callouts appear: "This meeting now costs more than a PS5" → "…a used car" → "…a semester of college" → "…an astronaut's daily salary"
- Animated money-burning visual effect in the background
- Pause/resume button; "Generate Shame Report" button summarizes total cost at the end

### Corporate BS Generator
Generate terrifyingly plausible mission statements, OKRs, performance review phrases, and LinkedIn posts.
- Category picker: mission statement, OKR, performance review, LinkedIn post, all-hands announcement
- Procedural text generation from curated word banks of corporate jargon
- "Make It Worse" button injects more buzzwords and increases sentence complexity
- Jargon density meter displayed as a gauge
- Copy button; generated text is indistinguishable from real corporate communications

### Vibe Check
Paste any text. Get an absurd but eerily accurate procedural analysis — no AI, just clever heuristics.
- Textarea input for pasting any block of text
- Analysis outputs: Pretentiousness Score, Chaos Level, Existential Dread Index, Main Character Energy %, Passive Aggression Detector
- Spirit animal assigned based on weighted keyword matching and punctuation patterns
- All metrics derived from keyword frequency, sentence length, punctuation density, caps ratio, emoji count
- Results displayed as animated gauges/bars with dramatic reveal; shareable summary card

### Your Age In Everything
Enter your birthday. See your age live-ticking in wild units — all counters animate simultaneously.
- Single date input for birthday
- Live-updating counters for: seconds alive, estimated heartbeats, blinks, breaths, full moons witnessed, Mars years, Olympic Games, mass extinctions survived (always 0), dog lifetimes, and cups of coffee (global average)
- All counters tick in real-time with smooth number animations
- Fun facts appear next to each unit ("You've blinked enough times to…")
- Responsive grid layout; counters use odometer-style rolling digit animation

---

## Calculators

### Cosmic Insignificance Calculator
Enter your height, weight, and age. See yourself compared to everything from an electron to the observable universe.
- Inputs: height, weight, age
- Comparison outputs: ratio to a blue whale, the sun, an electron, the observable universe, the US national debt (in dollars-to-grams)
- Interactive zoom slider from quantum scale to cosmic scale with your dot shrinking/growing
- Each comparison has a one-liner ("You are mass-of-the-sun × 3.3e-31 — basically a rounding error")
- Visual scale bar animates as you drag the slider

### Procrastination Invoice
Enter your hourly rate and time wasted. Generate an official-looking invoice for "services not rendered."
- Inputs: hourly rate, hours procrastinated, client name (default: "Myself")
- Generates a styled, printable invoice with line items: "Reorganizing desktop icons," "Existential staring at wall," "Opening fridge repeatedly," "Watching one more episode (x4)"
- Line items are procedurally selected and assigned realistic time slices that sum to total
- Subtotal, tax (Guilt Surcharge: 15%), and grand total
- "Print Invoice" button triggers browser print dialog with print-friendly CSS

### Banana Scale
Convert anything into bananas. Distance, weight, volume, time, speed — everything measured in banana units.
- Input: numeric value + unit dropdown (meters, kg, liters, seconds, km/h, etc.)
- Output: equivalent number of bananas (length: 18 cm, weight: 120 g, volume: 118 mL, etc.)
- Visual banana stack grows dynamically as numbers increase (SVG or emoji stack)
- Fun contextual sentence: "Your commute is 47,000 bananas long. Laid end to end, that's bananas."
- Supports chained conversions ("How many banana-lengths per banana-mass?")

### Life Progress Bar
Enter your birthday and expected lifespan. See your life as progress bars with absurd milestone commentary.
- Inputs: birthday, expected lifespan (default: 80 years)
- Main progress bar: overall life percentage, ticking in real-time
- Category bars: % of Tuesdays used, estimated pizza consumed, sunsets witnessed, hours spent in meetings, times you've said "I should go to bed"
- Milestone markers on the bar with dark-humor commentary ("~67% of all pizza you'll ever eat is behind you")
- Toggleable "existential crisis mode" that dims the page and plays a slow ticking sound

### Argument Settler
Enter two options. A hilariously over-engineered fake computation picks one with absolute authority.
- Two text inputs for the competing options
- "Settle It" button triggers an elaborate fake computation sequence
- Animated stages: "Consulting ancient algorithms…" → "Parsing cosmic vibrations…" → "Cross-referencing with 14 parallel universes…" → "Factoring in Mercury retrograde…"
- Progress bars, spinning indicators, and fake terminal output scroll by
- Final answer revealed dramatically with confetti, a fake rationale, and a "Certificate of Settlement" that can be screenshotted
