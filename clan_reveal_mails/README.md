# Clan Reveal Mails

8 mails = **4 clans × 2 audiences**. Every mail is byte-identical except the link
behind the two "Reveal My Clan" buttons. The mail **never names the clan**, the
reveal happens on the landing page.

Open any of the 8 files in a browser, all images are live, so what you see is
what recipients get.

| File | Send to | Reveal link |
|---|---|---|
| `students_rajputana.html` | New students allotted Rajputana | `/r/3184` |
| `students_vijaya.html` | New students allotted Vijaya | `/r/5027` |
| `students_maratha.html` | New students allotted Maratha | `/r/7362` |
| `students_chola.html` | New students allotted Chola | `/r/9415` |
| `team_rajputana.html` | Team/faculty allotted Rajputana | `/r/2760` |
| `team_vijaya.html` | Team/faculty allotted Vijaya | `/r/4839` |
| `team_maratha.html` | Team/faculty allotted Maratha | `/r/6193` |
| `team_chola.html` | Team/faculty allotted Chola | `/r/8524` |

The codes are opaque so the URL never spoils the clan. They must match `ROUTES`
in `../clan_reveal_websites/src/data/clans.js`, change one, change both.

## Subject lines

- **Students:** `🚀 Welcome to Rishihood: Discover Your Tribe!`
- **Team & Faculty:** `🌟 Team Rishihood, Meet Your Clan!`

Preview text is already baked into the HTML, no need to set it in the sending tool.

## The one thing left before sending

**Point the reveal links at the live domain.** Open `build_mails.py`, set
`REVEAL_BASE` to the real host, and re-run:

```bash
python3 build_mails.py
```

That regenerates all 8 files. Placeholder is `https://arambh-clan-reveal-animations.vercel.app/reveal`.

## Images

All hosted at the root of `raindeer-sociaI/aarambh_images` and verified live:

| Asset | File |
|---|---|
| Crests | `rajputana.jpg.jpeg`, `vijaya.jpg.jpeg`, `maratha.jpg.jpeg`, `chola.jpg.jpeg` |
| Icons | `shield.png`, `clan.png`, `trophy.png`, `flag.png`, `lock.png`, `star.png` |
| Logo | `rishihood_complete_logo.png` |

If a recipient's client blocks images, the mail still holds together: crest tiles
keep their clan colour with the name printed underneath, and the section badges
fall back to plain cream discs. No broken-image boxes, because every decorative
`img` carries an empty `alt`.

## Editing the copy

Edit `build_mails.py` (`STUDENT` / `TEAM` dicts and the template), not the HTML, the generator is what keeps all 8 mails in sync. Re-run it after any change.

## Icons

Custom line icons, no emoji anywhere in the mails. Editable SVG sources live in
`assets/icons/src/` and the rendered PNGs (the ones uploaded) in `assets/icons/`, 24×24 grid, 1.7 stroke, round caps, crimson `#CC0033` (the lock is cream
`#FFE5CD` for the dark card).

| Icon | Used for |
|---|---|
| `shield` | WHAT, what the Clans are |
| `clan` | WHY, you belong to one |
| `trophy` | HOW, points, glory cup, camaraderie |
| `flag` | WHAT NEXT, represent your Clan |
| `lock` | the sealed reveal card |
| `star` | closing ornament |

To re-render a PNG after editing an SVG:

```bash
python3 -c "s=open('assets/icons/src/shield.svg').read().replace('width=\"24\" height=\"24\"','width=\"120\" height=\"120\"'); open('/tmp/i.html','w').write('<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>'+s)"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --default-background-color=00000000 --window-size=120,120 \
  --screenshot=assets/icons/shield.png /tmp/i.html
```

## Design notes

- Rishihood University logo only, no Arambh branding.
- Brand palette: `#CC0033` crimson, `#DB5527` orange, `#FFE5CD` cream, `#333A3D` charcoal.
- Clan colours: Rajputana `#03923A`, Vijaya `#FFAF02`, Maratha `#F15002`, Chola `#004AAD`.
- Table-based, inline-styled, 640px, Outlook-safe buttons, mobile breakpoint at 600px.
- The dark "sealed" card carries the primary CTA; a second CTA sits near the bottom.
- "Best opened with the sound on" sets up the audio on the reveal page.
