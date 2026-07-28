# Clan Reveal Sites

React + Vite. One app, eight routes, the landing pages behind the
"Reveal My Clan" button in `../clan_reveal_mails/`.

```bash
npm install
npm run dev      # http://localhost:5173/r/3184
npm run build    # -> dist/
```

There is no route at `/`. Open a code directly, e.g. `/r/3184`.

## Before you deploy

```bash
npm run build
npx vite preview --port 4317 &
node scripts/deploycheck.mjs          # or pass the live URL once it is up
```

Plays all eight routes through the full 22-second build-up with no skipping and
reports dropped frames, console errors, failed requests, dead hrefs, and when
the crest and music bed arrive relative to when they are needed. Then exercises
reduced-motion, the skip button, an unknown code, mute-hammering, and
back-navigation. Measured against the live deployment: p50 16.7 ms (60 fps),
zero stalls over 150 ms, plus one ~225 ms long task on the very first visit for
bundle parse and React mount, which lands on the opening drone rather than on
any motion.

The stall bar is 150 ms, not 100. At 100 the check failed on a different route
every run; repeating a single route three times against the live server gave
67 / 117 / 75 ms, so the occasional ~110 ms frame was jitter from driving a
headless browser over a real network and never reproduced. The harness also
warms the browser before measuring, because otherwise whichever route happened
to go first wore the one-off cold-start cost and looked broken.

**It cannot verify that a social profile exists.** Instagram serves a 200 and a
byte-identical logged-out shell for a real handle and for a nonsense one. That
was checked against a control. Dead hrefs are caught; whether a live URL points
at the right person is a click-through job.

### The 22 seconds in front of the reveal are a free download window

Two things used to be requested at the exact frame they were needed, the crest
(the image the whole build-up exists to deliver) and the ~890 KB music bed. Both
are now warmed the moment Begin is pressed, which buys the entire build-up.

On **Slow 3G with a 4× CPU throttle**, measured end to end:

| | ready at | needed at | slack |
|---|---|---|---|
| Crest | 11.7 s | 32.2 s | 20.5 s |
| Music bed | 29.6 s | 36.7 s | 7.1 s |

Before this, the bed only started downloading at the reveal, roughly 18 s of
transfer on that connection, landing well after the ovation it is supposed to
rise underneath.

Crests and the Rishihood logo are **bundled, not hotlinked**. They used to load
from `raw.githubusercontent.com`, which is not a CDN, is rate-limited, and put a
third party between a student and the payoff frame, and the logo one is on the
volume gate, the very first thing anyone sees. The mails still use the GitHub
URLs, because email has no bundler.

## Routes

Codes are meaningless on purpose: `/r/3184` gives away nothing, and the student
and team codes for the same clan share no digits, so two people comparing links
learn nothing about each other.

| Code | Clan | Audience |
|---|---|---|
| `/r/3184` | Rajputana | Students |
| `/r/5027` | Vijaya | Students |
| `/r/7362` | Maratha | Students |
| `/r/9415` | Chola | Students |
| `/r/2760` | Rajputana | Team |
| `/r/4839` | Vijaya | Team |
| `/r/6193` | Maratha | Team |
| `/r/8524` | Chola | Team |

**These must stay in sync with `CODES` in `../clan_reveal_mails/build_mails.py`.**
Change one, change both, then re-run the mail builder.

An unknown code lands on a friendly "this link has no clan" page, not a blank
screen.

## ⚠️ Fill these in before sending

`src/data/clans.js` is the only file you need to edit. Run
`node scripts/content-check.mjs` for the live list. One item open:

- **Nakul has 3 pointers, Pranav has 6.** They sit one above the other on the
  Rajputana page, so the two cards differ noticeably in height. Two more lines
  from Nakul closes it. His source note is three lines; there is nothing there
  to expand without inventing it.

Everything else, names, pointers, photos, war cries and every social URL, is
real and wired.

## War cries

Clans have a **war cry and nothing else**. There is no slogan field and there
never was a real slogan to put in one; four invented ones sat in the hero until
the real cries arrived, and they are gone.

| Clan | War cry |
|---|---|
| Rajputana | राजपूताना राज करेगा! |
| Vijaya | विजया! |
| Maratha | For Victory, For Glory, For Maratha, जय मराठा! |
| Chola | हर हर महादेव! |

The cry now takes the hero slot under the clan name, landing word by word.
A cry is chanted, not read, and it lets Maratha's long line arrive in beats.
It used to be repeated in the footer as well; saying it twice on one page read
as an accident rather than as a chant, so the footer copy is gone.

### It needed a second typeface, and this is not cosmetic

Three of the four cries are Devanagari and **Bodoni has no Devanagari glyphs at
all**. Left alone, the biggest line on three of the eight pages would have
dropped to whatever each device defaults to, Noto on one phone, a system UI
face on the next, sitting directly under a 150px Bodoni clan name.

So the pages also load **Tiro Devanagari Hindi**: a high-contrast Devanagari
text serif designed to set alongside Latin serifs. Maratha's cry runs both
scripts in one line and reads as one voice.

Two details that are easy to undo by accident:

- **Tiro must sit before the generic `serif` in the stack.** `font-family`
  falls through per glyph, and a generic family covers Devanagari everywhere, so `var(--serif), <deva>` resolves every Devanagari glyph in the generic
  serif and never reaches Tiro. See `--serif-cry`.
- **The cry is upright, not italic** like the slogan was. Devanagari has no
  italic; a browser asked for one synthesises a slant, and slanted Devanagari
  reads as a rendering fault, which on Maratha's line would have sat beside a
  genuine Bodoni italic in the same breath.

`checkall.mjs` verifies Tiro is really being used. Note that
`getComputedStyle().fontFamily` reports the *declared* stack, not the family
the engine picked per glyph. It says "Bodoni Moda" even for a glyph Bodoni
does not have. The check measures the string in Tiro-then-serif against serif
alone and compares widths instead.

One knock-on: the words are separate flex items so they can animate
individually, which drops the whitespace between them from the accessibility
tree. The paragraph carries an `aria-label` with the real string, or a screen
reader would announce the cry as one unbroken word.

### Social links

Each **Chief and Deputy Chief** carries their own Instagram and LinkedIn as
small circular icons under their name. The footer carries the clan's own
accounts plus Life at Rishihood and Rishihood University (shared, in
`UNIVERSITY_SOCIALS`).

**Nothing renders unless the URL is real.** Two kinds of empty, and they mean
different things:

| Value | Means | Rendered? | Chased by content-check? |
|---|---|---|---|
| `null` | the account does not exist | no | no |
| `'#'` or `''` | a real account, URL not supplied yet | no | yes |

So Deepanshu shows one icon, not two, he has no Instagram, and three of the
four clans show three footer links rather than four, because only Rajputana has
a LinkedIn page. There is no WhatsApp mark any more; the icon was in the code
for a channel that was never set up.

Counts are asserted per clan in `checkall.mjs`, and every `<a href>` on the page
is checked to go somewhere real, so a URL quietly reverting to `'#'` fails the
run instead of shipping as a button that does nothing.

**One supplied URL was wrong and is corrected in the data:** Rajputana's
LinkedIn arrived as `.../company/108103435/admin/dashboard/`, which is the
page-management view only admins can open. It is stored as
`.../company/108103435/`, the public page. Worth confirming that resolves
before you send.

The grid is 2×2 (`auto-fit` gave 3 + 1 with an orphan). With an odd count the
last card spans both columns at one column's width and centres, keyed off
`:last-child:nth-child(odd)` so it is the count that triggers it, no per-clan
special-casing to keep in sync.

## Leaders

**7 in total:** Chief + Deputy Chief for Rajputana, Maratha and Chola;
**Vijaya has a Chief only.** Each has 5 pointers listed beside the portrait,
written from the source notes in `src/about_leads/`, **except Rajputana's
Deputy Chief, who has 6 by request**: the swimming / guitar / 100 km line was
originally cut to keep everyone level, then put back because it is the only
pointer on his card that shows the person rather than the record.

Counts are declared per clan in `checkall.mjs`'s `CASES` table rather than
asserted as "always 5", so the sixth is a fact the test knows about while any
*other* leader gaining or losing a line still fails.

### The pointers were fact-checked, and it mattered

Every pointer was reviewed line by line against its source note, because these
are real named students being published to the entire incoming cohort. That
pass caught claims that would have publicly credited people with things they
did not do:

| Found | Correction |
|---|---|
| "built a community from the ground up" (Deepanshu) | a **founding claim** for SAGE; the source names him only as President |
| "starts from the user's problem and works backwards" (Aabir) | a specific **working method** with no basis in the source |
| "turning what he learns into things that ship" (Aaryan) | source says hands-on *exposure*, not shipped work |
| "building a culture of technical learning **on campus**" (Aaryan) | source says "within the community", never campus |
| "can explain how the world's capital actually moves" (Aabir) | an *interest* written up as demonstrated expertise |
| "a CubeSat shown at Bharat Mandapam" (Neelanshu) | source says a **prototype**, the omission credits real hardware |

**If you edit these, re-check against `src/about_leads/` rather than trusting
the prose.** Interpretive colour is fine ("knows what the preparation costs"
after a real gold medal); anything that asserts a new *fact* is not.

### The `**emphasis**` markers

A first-year skims. So in each pointer the one fact worth stopping on is
wrapped in `**double asterisks**`, and `Leaders.jsx` renders those runs as
`<strong>`, lifted on two axes at once, weight 300 → 600 *and* 62% ink → full
ink, because at Inter's body weight either change alone is too quiet to
register.

Two rules, both enforced:

- **Mark the credential, not the sentence.** The award, the title, the name in
  the room, `**Winner of DECODE 2025**`, `**Prime Minister Shri Narendra
  Modi**`, `**International Basketball Gold Medalist**`. Emphasising half a
  line emphasises nothing. Roughly one run per pointer; some pointers carry
  none, and that variation is what stops the column reading as a wall of bold.
- **At least two per leader.** `checkall.mjs` counts the rendered `<strong>`s
  per card and fails under two; `content-check.mjs` reports the count and flags
  an odd number of markers, since one unclosed `**` never matches the split and
  reaches the screen as literal asterisks.

Emphasis is deliberately **not** set in the clan colour. Coloured words
mid-sentence read as links, and a reader who taps one and gets nothing has been
lied to by the typography.

Word-count balance is measured on the *stripped* text, so adding markers can
never quietly push a leader out of the target band.

Where a pointer is structurally a list, Pranav's closing swimming / guitar /
100 km line, each item takes its own mark. That is the same rule applied three
times, not an exception to it.

Where the source genuinely ran out, Nakul's note is three lines, the slot is
marked `TODO` rather than filled with something unearned. Do not let anyone
expand those from the existing lines; there is nothing there to expand without
inventing. Ask him for one thing he has led, won or built, and one relatable
interest.

**The two harnesses divide cleanly:** `checkall.mjs` asks *does it work* and
only tests structure, so it stays green while content is still being filled in.
`content-check.mjs` asks *is it finished*. Social links and leader profiles are
rendered only when a real URL is present ('#' is truthy, so it is excluded
explicitly), an unfilled placeholder can never ship as an icon that goes
nowhere, which is also why the rendered social count is content-check's
business and not checkall's.

`node scripts/content-check.mjs` lists every unfilled photo, URL, war cry and
TODO pointer, and prints per-leader word and emphasis counts so the cards stay
balanced: **18 to 25 words per pointer**, minimum 2 highlights each.

That band is deliberately *per pointer*, not a per-leader total. It used to be a
flat 90 to 125 words, which quietly assumed everyone had exactly five. The moment
Pranav was given a sixth, a perfectly balanced card would have been flagged as
too long. Scaling by count measures what actually governs how a card reads: how
long each line is, not how many there are.

```js
{
  name: 'Real Name',
  role: 'Chief',                                    // or 'Deputy Chief'
  photo: `${IMG}/leaders/rajputana-chief.png`,
  points: ['...', '...', '...', '...', '...'],      // 5 (Rajputana Deputy: 6)
},
```

Every card is **full width** regardless of count, portrait on one side and the
pointers on the other, mirrored on every second card. That's deliberate: it
means Vijaya's lone Chief reads exactly like everyone else's instead of
shrinking into a solitary centred box. Below 760px the portrait stacks above
the text.

### Photos

Drop a background-removed source into `src/about_leads/images/` and run:

```bash
python3 scripts/prep_leader_photos.py
```

**Do not wire raw exports straight into `clans.js`.** The card renders every
portrait at a fixed *height*, so the only thing controlling apparent head size
is the ratio `subject-height : image-height`, and source photos never agree on
it. Chola's two arrived as a 4160×2773 podium shot (subject 40% of the frame)
and an 800×800 bust (subject 98%); side by side they would have rendered at
completely different scales.

The script fixes that automatically: it crops away anything that is not the
person (per-photo box in `CROPS`, as fractions so it survives a re-export at
another resolution), then **auto-fits from the alpha bounding box**, scaling
the subject to the same fraction of the frame, centring it on its own
silhouette, and sitting it on the floor. Every output is identical in
dimensions, so heads match on screen.

Output is **lossy WebP with alpha** (~70 to 105 KB each). A full RGBA PNG runs to
about a megabyte per photo; palette-quantizing one down instead posterized the
skin into visible bands.

Leave `photo: null` and the card falls back to a monogram, so the section looks
finished while you are still gathering cut-outs.

**How the portrait sits in the panel.** Vertically centred, with the bottom of
the image dissolved into the card by a `mask-image` gradient. These are bust
crops, so the source ends in a hard horizontal cut across the chest, invisible
while the photo stood on the panel floor, but an obvious chopped edge once it
is centred. The mask is applied to the drop shadow as well, otherwise the
shadow outlines the cut the mask just hid.

The clan-coloured glow behind the subject uses `radial-gradient(ellipse
**closest-side** ...)`. The default `farthest-corner` sizing leaves the gradient
still tinted where it meets the panel's left and right edges, and the stage's
`overflow: hidden` cuts that into a visible rectangle around every photo.

## Theme

**Shipping light.** `THEME` in `src/data/clans.js` is `'light'`. Append
`?theme=dark` to any URL to preview the other one on the live site without a
rebuild, e.g. `/r/3184?theme=dark`.

The clan colours were chosen against black, so the light theme doesn't just
flip the background: anything colour-washed switches to a faint `--clan-soft`
tint (computed from the clan colour at runtime), and the cards become solid
white with a soft shadow instead of translucent panels. All of that lives in
the "LIGHT THEME OVERRIDES" block at the bottom of `src/styles/global.css`.

The theatre has its own themed variables (`--velvet*`, `--gilt*`, `--house*`,
`--footlight*`, `--spot*`). In light the hall is an ivory room at dusk, so the
crimson velvet and gilt stay the darkest things on screen. Build-up text
switches to cream once the curtain is up (`.buildup.has-theatre`), charcoal on
velvet would be unreadable.

## Design system

> **Optical size is pinned to `--opsz: 14`, and this matters.** Bodoni's `opsz`
> axis controls hairline thickness relative to the stems: a HIGH opsz is the
> display design, with very fine hairlines. `font-optical-sizing: auto` ties
> opsz to font-size, so the **largest** type was getting the **thinnest**
> strokes, which made the clan name genuinely hard to read. Raising
> `font-weight` does not fix it (it thickens the stems far more than the
> hairlines); the opsz axis is the correct control. 14 applies the text design
> at display sizes: the Didone contrast survives, the thin strokes do not
> disappear. Lower `--opsz` in `global.css` if it still reads light.


**Type.** `Bodoni Moda` for display, `Inter` for everything small. Bodoni is the
historical playbill and marquee face. Its very high stroke contrast is what
reads as expensive at large sizes, and it's the reason headlines are set at
weight 500 rather than a heavy weight (bolding a Didone destroys the contrast
that makes it work). Inter carries body and labels, where Bodoni's hairlines
would disappear. Display uses `font-optical-sizing: auto` so the variable
`opsz` axis thickens hairlines at small sizes automatically.

Deliberately avoided: Cinzel and Montserrat. Both are the default "make it look
premium" picks and both read as a template.

**Devices that do the work:**
- Letterspaced small caps flanked by hairlines (`.rule-label`) instead of filled pills
- Hairline rules between list rows instead of bullet glyphs
- 2px corner radii, not 18 to 28px, large radii read as consumer-app, not editorial
- Flat solid fills, no candy gradients on buttons, no gradient-filled headlines
- Shadows that describe elevation, not coloured glows
- A film-grain overlay on `body::after` at ~5%, flat digital gradients are the
  single biggest tell of a cheap page

**Colour.** Warm paper `#FAF7F1` and ink `#1C1A17` rather than white and black.
Antique gold `#B0904E` rather than shiny brass, deep wine `#6E0A22` rather than
bright crimson. The clan colour is an accent, rules, labels, the medallion, never a flood.

**Crest.** Cropped to a circle. The artwork is already printed on the clan
colour, so a circular mask makes the JPEG's square edge vanish and leaves a
struck medallion instead of a coloured tile floating on the page.

## The reveal

**~23 seconds**, staged as an evening at the theatre. Beat sheet lives in
`src/components/RevealSequence.jsx` (`T`, in seconds) - change a number there
and both the visuals and the audio follow, because they're scheduled from the
same `t0`.

Tension curve: **wonder -> weight -> dread -> acceleration -> THE CUT -> release.**
The countdown is deliberately metronomic (1.2s / 1.2s); the meter then breaks
by *rupture* - the world dies at +0.75 instead of delivering the expected beat.

| t | What happens |
|---|---|
|, | **Gate.** One choreographed stagger; the BEGIN button carries a slow specular sheen (luxury glints; it doesn't throb). The click unlocks Web Audio. |
| 0.8 | "FOUR CLANS" - per-word blur-to-sharp on a dark house; drone + audience murmur (two panned beds, coughs, a seat creak) |
| 2.8 | "ONE RISHIHOOD" |
| 4.8 | **The house assembles in sequence** - back wall, raked floor, valance drop with a sag-settle, halves closing from the wings, gilt arch with a one-shot glint. Never a crossfade. |
| 6.0 | **Nine footlights strike** L->R across the stereo field, each a filament flicker + panned contactor clunk |
| 8.3 | Follow-spots sweep in mid-swing; the whoosh pans across the stage |
| 9.2 | **Tam-tam gong** (8s shimmer tail) + "YOUR CLAN HAS BEEN ALLOTTED" riding the gong's bloom |
| 11.4 | The house hushes, then the oboe gives the A and the strings drift into tune around it |
| 13.4 | Three baton taps cut through the tuning tail |
| 14.4 | "HOLD YOUR BREATH" - words slowly pulling apart; humanized snare + timpani rolls (the timpani fundamental rises F2->G2) |
| 15.6 | **Shepard-Risset riser** - the infinite-rise illusion - over a physical riser |
| 16.4 / 17.6 / 18.8 | **3 - 2 - 1** slam-settle with shockwave rings, warm light pops, per-hit decaying shake + between-hit tremor, the vignette ratcheting closed; hits pitch DOWN as the numbers fall |
| 19.55 | **THE CUT.** Everything dies in 100ms - rolls, riser and drone are scheduled to END here. 1.55s of near-silence: two dry heartbeats, one faint fabric tremor (a hand already on the velvet), an audience inhale in the last 350ms. Spots converge to one tight pool; total visual freeze. |
| 21.1 | **The curtain** - anticipation tug, then the haul; motor rumble with cogging, panned velvet rustle + fabric granules, ring-modulated cymbal swell; light widens through the gap |
| 22.3 | **IMPACT** - program bus snaps back 30ms early; saturated sub drop, broadband transient, confetti air-cannons (a compressed-air whoomph, not a party crack) |
| 22.32 | **THE REVEAL CHORD** - the whole orchestra lands at once on a suspended 4th: timpani stroke, ceremonial bell, low brass floor, strings. The 4th resolves to the major third at +0.55, horns bloom over the top at +1.3, high strings add a last octave at +2.2. Eight seconds of decay carry into the hero page so the reveal never falls into silence. |
| 22.8 | The hall rises - a dark, distant ovation that builds over half a second rather than erupting |
| 22.5 | Hero mounts under the flash: clan colour -> crest SOLO with a specular glint -> name letter-by-letter -> slogan. Four separate punches, never a pile-up. |

Scrolling is locked until the impact lands. Skip and mute are always available,
and `prefers-reduced-motion` skips the build-up entirely (plus
`MotionConfig reducedMotion="user"` calms the hero page).

### How the theatre is built

`Stage.jsx` paints back wall -> raked floor -> `Curtains.jsx` -> follow-spots
-> footlights -> gilt proscenium, in DOM order inside one stacking context.
The spots fall ON the velvet, the footlights sit IN FRONT of it on the apron,
the arch frames the lot. The light through the parting gap is rendered BEHIND
the halves - in front it just washes the velvet out.

### Hard-won implementation notes (do not regress these)

- `clan` in RevealPage is memoized and RevealSequence's scheduling effect is
  mount-once with callbacks in refs. An unstable identity there RESTARTS the
  whole show on any re-render (e.g. tapping mute) and double-schedules the
  soundtrack - cleanup can clear timers but never already-scheduled Web Audio.
- The cards/counts AnimatePresence has ONE conditional child with the exit on
  the DIRECT child. Two stacked conditionals with a descendant exit made
  removals sporadically untracked - cards piled up forever.
- Spot entrance delay (3.5s) must not apply to the frantic flip - framer
  applies `delay` on every animation start, which froze the spots through the
  countdown. Frantic keyframes start from `null` (current value) to avoid a
  40-degree teleport.
- `curtainOpen` must win over `gasp` in the vignette and follow-pool
  ternaries, or the reveal plays under a 0.85 vignette.
- Never animate a child inside a `filter: blur()` subtree (forces re-raster +
  re-blur of the whole layer every frame) - the spot cones bake softness into
  radial gradients instead.

## Sound

Every sound is synthesised at runtime with the Web Audio API in
`src/audio/engine.js`. **There are no audio files** - nothing to host, license,
or 404.

**The hall:** a generated-impulse-response convolution reverb (2.8s stereo IR,
RT60 1.9s, darkening tail, early reflections offset 3ms L/R) with per-sound
send levels. The heartbeat is deliberately DRY against the reverbed room - the
hall is huge, your pulse is in your ears.

**The buses:** voices -> program (the gasp ducks THIS, -38dB in 100ms) ->
HP24 -> presence +1.5dB@2.8k -> lowshelf -> glue compressor -> master (mute
lives here, so the duck never fights it) -> unnormalized tanh soft ceiling ->
brick limiter. A few sounds route DIRECT (post-duck): the gasp heartbeats, the
inhale, the fabric tremor.

**The stereo stage:** footlights march L->R, the orchestra sits in seating
plan, rolls alternate hands ±0.12, curtain halves rustle from ±0.6, the
ovation spreads to ±0.7. Centre stays mono-safe for phone speakers; the
saturated sub folds 28Hz into audible harmonics so small speakers still feel
the drop.

**The orchestra** (everything from the curtain onward). Synthesised strings and
brass sound like a synth patch unless you build in what makes a section a
section, so `ensemble()` gives every note: many detuned voices each with
INDEPENDENT slow pitch drift, ragged entries up to 50ms apart, linear (bowed)
attacks rather than the exponential snap used elsewhere, a lowpass that OPENS
with the swell so brightness follows bow pressure, vibrato that arrives late at
per-voice rates, and a whisper of bow noise. `strings()`, `horns()`,
`lowBrass()`, `bell()` and `timpaniHit()` are all built on it.

This block was rewritten after the ending was called childish, and it was:
square-wave popper cracks sweeping 900->110Hz (a cartoon "pop"), crowd
whistles, and seven twinkly chime "sparkles" - birthday-party sound design on
a ceremony. All three are gone; the bell replaced the chimes, an air-cannon
whoomph replaced the crack, and the ovation lost its whistles and its
brightness.

Verify audio changes objectively with `audiotest.html` (dev-only, excluded from
the production build): it renders the post-curtain block through an
`OfflineAudioContext` and measures it. Current numbers - peak **0.804** (no
clipping), zero non-finite samples, RMS decaying 0.318 -> 0.183 -> 0.111 -> 0.030
across 8 seconds (a real sustain, not a stop), stereo correlation 0.896, and a
**spectral centroid of 214Hz at the impact / 388Hz at the chord**. That last
number is the whole point: twinkly chimes and whistles push the centroid above
~1800Hz, which is what "childish" measures as.

```bash
npx vite --port 5174   # then open http://localhost:5174/audiotest.html
```

## The music bed and the spectrum

After the reveal, a looping music bed comes up under the clan page and a
beat-reactive spectrum sits in the hero.

**The handover is an overlap, never a gap.** The bed starts rising 4.5 s after
the impact and takes 4 s to reach level, so it is already coming up while the
ovation (ends +5.9 s) and the reveal chord (decays to +8 s) are still dying
away. The Skip and reduced-motion paths start it sooner, with shorter fades.

**Looping.** Deliberately simple: the track plays all the way through, ends,
and restarts from the top. `source.loop = true`, nothing more.

An earlier version looped only the body and crossfaded laps with beat-aligned
equal-power curves. It *measured* well, the seam was statistically
indistinguishable from ordinary music, but it did not **sound** smooth, because
two parts of the same song playing over each other read as a blur rather than a
loop. Letting the song finish is the better call and a fraction of the code.

The one piece of processing kept: the file ends with ~1.25 s of pure digital
silence after the music stops, which would land as a dead gap once a lap.
`loopEnd` sits just past the last audible sample, so the musical outro is heard
in full (measured level 0.0084 across the two seconds before the loop) and only
the dead air is skipped. Verified over two laps offline: lap 2 restarts at full
level with no crossfade.

**The spectrum** (`AudioSpectrum.jsx`) taps an AnalyserNode placed *after* the
master gain, so muting genuinely flattens it rather than leaving bars dancing
over silence. Bars are log-spaced across 40 Hz, 12 kHz (linear bin mapping
crams all the visible movement into the left eighth, which is the usual reason
home-made visualisers look wrong), with peak caps that fall slowly and a
separate 40 to 160 Hz bass envelope driving the baseline glow, so the kick is
visible as well as audible. Drawn in the clan colour.

At silence it renders as a **hairline rule**, the same typographic device used
throughout the page, and the bars grow out of it, so it never looks like a
broken media player.

> Size the canvas from `clientWidth`, **not** `getBoundingClientRect()`. The
> wrapper animates in with `scaleX(0.4)`, and a rect measured through that
> transform sizes the backing store to 40% and never corrects itself, because
> ResizeObserver does not fire for transforms.

The audio file lives in `src/audio/` and is imported as a Vite asset (emitted
to `dist/assets/`). Rights clearance for the track is the sender's to confirm.

## Deploy

Deploy this folder as its own Vercel project (Root Directory =
`clan_reveal_websites`). `vercel.json` rewrites everything to `index.html`,
which client-side routing needs, without it `/r/3184` 404s on refresh.

Then set `REVEAL_BASE` in `../clan_reveal_mails/build_mails.py` to the live
domain and re-run it.

## Checks

```bash
npm run build && npx vite preview --port 4317 &
node scripts/checkall.mjs /tmp/shots http://localhost:4317   # all 8 routes + 404 + mobile
node scripts/timeline.mjs /tmp/shots http://localhost:4317/r/3184 24  # second-by-second build-up
node scripts/capture.mjs  /tmp/shots http://localhost:4317/r/3184   # frame-by-frame of the reveal
```

**Run `timeline.mjs` after any edit to the sequence or the theatre.** It walks
the build-up one second at a time and asserts two invariants that broke once
already: velvet must never be on screen while the titles are still dark ink,
and every text beat must clear 3:1 real luminance contrast against whatever is
actually painted behind it. (The scenery is pointer-events:none, which
elementsFromPoint skips - the script flips that on for the instant it samples.)

`checkall.mjs` asserts each route renders the right clan, the crest loads and
is centred, the right number of leaders appear with Chief first and 5 pointers
each, 3 socials are present, there are no console errors or failed requests,
and the clan name stays on one line at 390px.

`themeshots.mjs` captures gate / hero / leaders / socials in both themes at
1440px and 390px, and reports any horizontal overflow.

## Known

`npm audit` reports a high-severity advisory on react-router 7.18 (RSC-mode
CSRF). This is a static SPA with no server actions or RSC, so it isn't
reachable here; no patched 7.x exists yet.
