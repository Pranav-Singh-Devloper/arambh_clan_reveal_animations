#!/usr/bin/env python3
"""Builds the design-research document for the Rishihood Clan Reveal."""

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CRIMSON = RGBColor(0x8A, 0x00, 0x22)
INK = RGBColor(0x1C, 0x1A, 0x17)
GREY = RGBColor(0x5A, 0x56, 0x50)

doc = Document()

# ---- page + base styles ----------------------------------------------------
for s in doc.sections:
    s.top_margin = Inches(1.0)
    s.bottom_margin = Inches(1.0)
    s.left_margin = Inches(1.1)
    s.right_margin = Inches(1.1)

normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(10.5)
normal.font.color.rgb = INK
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.line_spacing = 1.18

for name, size, color, before, after in [
    ('Heading 1', 17, CRIMSON, 22, 8),
    ('Heading 2', 13, CRIMSON, 16, 6),
    ('Heading 3', 11, INK, 12, 4),
]:
    st = doc.styles[name]
    st.font.name = 'Georgia'
    st.font.size = Pt(size)
    st.font.color.rgb = color
    st.font.bold = True
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.paragraph_format.keep_with_next = True


def para(text='', style=None, size=None, italic=False, bold=False,
         color=None, align=None, space_after=None):
    p = doc.add_paragraph(style=style)
    if text:
        r = p.add_run(text)
        r.italic = italic
        r.bold = bold
        if size:
            r.font.size = Pt(size)
        if color:
            r.font.color.rgb = color
    if align:
        p.alignment = align
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    return p


def rich(parts, style=None, align=None, space_after=None):
    """parts: list of (text, {bold/italic/mono/color/size})"""
    p = doc.add_paragraph(style=style)
    for text, fmt in parts:
        r = p.add_run(text)
        r.bold = fmt.get('bold', False)
        r.italic = fmt.get('italic', False)
        if fmt.get('mono'):
            r.font.name = 'Consolas'
            r.font.size = Pt(fmt.get('size', 9.5))
        elif fmt.get('size'):
            r.font.size = Pt(fmt['size'])
        if fmt.get('color'):
            r.font.color.rgb = fmt['color']
    if align:
        p.alignment = align
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    return p


def bullet(text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.28 + 0.24 * level)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p


def bullet_rich(parts, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.28 + 0.24 * level)
    p.paragraph_format.space_after = Pt(3)
    for text, fmt in parts:
        r = p.add_run(text)
        r.bold = fmt.get('bold', False)
        r.italic = fmt.get('italic', False)
        if fmt.get('mono'):
            r.font.name = 'Consolas'
            r.font.size = Pt(9.5)
    return p


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), hexcolor)
    tcPr.append(shd)


def table(headers, rows, widths=None, font=9, header_fill='F2E4E8', mono_cols=()):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(font)
        r.font.color.rgb = CRIMSON
        shade(hdr[i], header_fill)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            r = p.add_run(str(val))
            r.font.size = Pt(font)
            if i in mono_cols:
                r.font.name = 'Consolas'
                r.font.size = Pt(font - 0.5)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def callout(title, body):
    t = doc.add_table(rows=1, cols=1)
    t.style = 'Table Grid'
    c = t.rows[0].cells[0]
    shade(c, 'FBF6EE')
    c.text = ''
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(title)
    r.bold = True
    r.font.size = Pt(10)
    r.font.color.rgb = CRIMSON
    p2 = c.add_paragraph()
    p2.paragraph_format.space_after = Pt(2)
    r2 = p2.add_run(body)
    r2.font.size = Pt(10)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def code(lines):
    t = doc.add_table(rows=1, cols=1)
    t.style = 'Table Grid'
    c = t.rows[0].cells[0]
    shade(c, 'F5F3EF')
    c.text = ''
    for i, ln in enumerate(lines):
        p = c.paragraphs[0] if i == 0 else c.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        r = p.add_run(ln)
        r.font.name = 'Consolas'
        r.font.size = Pt(8.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ============================================================================
# COVER
# ============================================================================
para().paragraph_format.space_after = Pt(60)
para('RISHIHOOD UNIVERSITY', size=11, bold=True, color=GREY,
     align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
p = para('The Clan Reveal', align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
p.runs[0].font.size = Pt(32)
p.runs[0].font.name = 'Georgia'
p.runs[0].font.bold = True
p.runs[0].font.color.rgb = CRIMSON
p = para('Engineering Suspense: A Design & Research Record',
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=30)
p.runs[0].font.size = Pt(13)
p.runs[0].font.name = 'Georgia'
p.runs[0].font.italic = True
p.runs[0].font.color.rgb = INK

para('Sound design, motion design and narrative pacing for the '
     'Clan Allotment 2026 reveal experience', italic=True, color=GREY,
     align=WD_ALIGN_PARAGRAPH.CENTER, space_after=40)

table(
    ['Field', 'Detail'],
    [
        ['Artefact', 'A ~23-second cinematic reveal, delivered as one link per recipient'],
        ['Audience', 'Incoming students and faculty across four clans'],
        ['Clans', 'Rajputana, Vijaya, Maratha, Chola'],
        ['Platform', 'React single-page application; desktop and mobile'],
        ['Audio', 'Fully procedural (Web Audio API) - zero audio files'],
        ['Runtime', '22.5 s build-up; ~30 s including the reveal chord decay'],
    ],
    widths=[1.5, 4.6], font=9.5,
)

doc.add_page_break()

# ============================================================================
# 1. BRIEF
# ============================================================================
doc.add_heading('1.  The Problem', level=1)

para('Every learner and faculty member at Rishihood belongs to one of four clans. '
     'The allotment itself is a spreadsheet operation. The question this project '
     'answers is a different one: how do you make finding out which clan you belong '
     'to feel like a moment worth remembering?')

para('A reveal is a structurally simple thing - a fact is hidden, then it is not. '
     'The entire experience lives in the gap between those two states. That gap is '
     'the design surface, and it is almost entirely a problem of time and '
     'expectation rather than of visuals.')

callout(
    'The governing constraint',
    'The clan must never be inferable before the reveal lands. This rules out '
    'clan colours, crests or names in the email, in the URL, in the page title, '
    'and in any asset loaded before the moment itself. Routes are therefore '
    'opaque numeric codes (/r/3184), and the reveal page paints itself in the '
    'clan colour only at the instant of impact.'
)

doc.add_heading('1.1  Why an "evening at the theatre"', level=2)

para('Suspense needs a frame the audience already understands. A theatre gives one '
     'for free: a curtain is a socially agreed promise that something is behind it, '
     'and everyone already knows the grammar - house lights dim, the orchestra '
     'tunes, the conductor raises a baton, the curtain rises. Borrowing that grammar '
     'means the experience can build tension without ever explaining itself.')

para('It also solves a practical problem. The reveal needs roughly twenty seconds of '
     'held attention, which is a very long time on the web. A theatre justifies the '
     'wait: an audience that believes a performance is being prepared will tolerate '
     'a delay that an audience staring at a loading spinner will not.')

# ============================================================================
# 2. TENSION CURVE
# ============================================================================
doc.add_heading('2.  The Tension Curve', level=1)

para('The first working version of this experience failed in an instructive way. '
     'It built continuously - drums accelerating, a riser climbing, a countdown, '
     'then the reveal. Every element only ever got louder and faster. It was '
     'energetic and completely unsuspenseful.')

callout(
    'The central finding',
    'Tension is not loudness. Tension is unresolved expectation, and expectation '
    'can only be felt against a contrast. A build that only accumulates gives the '
    'listener nothing to measure the peak against, so the peak reads as merely the '
    'loudest part rather than as a release. Suspense required taking something '
    'away, not adding more.'
)

para('The experience was restructured around six phases, with the fifth being the '
     'one that carries the whole piece:')

table(
    ['Phase', 'Window', 'Function'],
    [
        ['Wonder', '0.0 - 8.3 s', 'Establish scale and mystery. A dark house, an unseen audience.'],
        ['Weight', '9.2 - 11.8 s', 'Ceremony. A gong and a formal announcement make it consequential.'],
        ['Dread', '13.4 - 15.6 s', 'Preparation becomes threat. Tuning, baton taps, the roll begins.'],
        ['Acceleration', '16.4 - 19.55 s', 'Metered countdown. Everything intensifies on a predictable pulse.'],
        ['THE CUT', '19.55 - 21.1 s', 'Near-total silence. The expected beat never arrives.'],
        ['Release', '22.3 s +', 'Impact, orchestra, ovation, the clan.'],
    ],
    widths=[1.1, 1.3, 3.7], font=9.5,
)

doc.add_heading('2.1  The Cut', level=2)

para('At 19.55 seconds - 750 milliseconds after "1" - everything stops. The drum '
     'roll, the timpani roll, the riser and the drone are all scheduled to end at '
     'this exact timestamp rather than to run past it, each closing over its own '
     'last few hundred milliseconds so the arrival at silence is clean rather than '
     'abrupt. The program bus is then ducked to -38 dB in 100 milliseconds. The '
     'screen freezes.')

para('The mechanism is a violated expectation. The countdown deliberately establishes '
     'a metronomic pulse - 3 at 16.4 s, 2 at 17.6 s, 1 at 18.8 s, exactly 1.2 seconds '
     'apart. That regularity is a trap: it teaches the listener when the next beat is '
     'due. Instead of delivering it, the world dies. The audience is left holding a '
     'breath they were not told to take.')

para('The silence is not literal. Total digital silence reads as a bug, particularly '
     'on phones, so three things remain audible - each routed through a signal path '
     'that bypasses the duck entirely:')

bullet_rich([('Two heartbeats', {'bold': True}),
             (' at 19.9 s and 20.65 s, completely dry against a reverberant room. '
              'The contrast is deliberate: the hall is enormous, and your pulse is '
              'inside your own head.', {})])
bullet_rich([('One fabric tremor', {'bold': True}),
             (' at 20.7 s - a hand is already on the velvet. It is nearly '
              'inaudible on a first viewing and unmistakable on a second.', {})])
bullet_rich([('An audience inhale', {'bold': True}),
             (' in the final 350 ms, band-passed noise sweeping 800 - 1900 Hz. '
              'The room breathing in.', {})])

# ============================================================================
# 3. BEAT SHEET
# ============================================================================
doc.add_heading('3.  The Beat Sheet', level=1)

para('Audio is scheduled against the Web Audio hardware clock and visuals against '
     'the browser timer, both from a single origin captured when the experience '
     'begins. This matters: a drum roll that drifts against its countdown destroys '
     'the illusion immediately.')

table(
    ['t (s)', 'Beat', 'Sound', 'Picture'],
    [
        ['0.8', 'FOUR CLANS', 'Drone; audience murmur', 'Per-word blur-to-sharp on warm paper'],
        ['2.8', 'ONE RISHIHOOD', 'Murmur continues', 'Second title card'],
        ['4.8', 'The house assembles', 'Curtain-motor rumble', 'Wall, floor, valance, curtains, gilt arch - in sequence'],
        ['6.0', 'Footlights', 'Nine contactor clunks, L to R', 'Lamps strike one at a time with filament flicker'],
        ['8.3', 'Follow-spots', 'Whoosh panning across', 'Beams sweep the house'],
        ['9.2', 'THE ANNOUNCEMENT', 'Tam-tam gong, 8 s tail', '"YOUR CLAN HAS BEEN ALLOTTED"'],
        ['11.4', 'The house hushes', 'Murmur fades out', 'Card clears'],
        ['11.9', 'The orchestra tunes', 'Oboe gives A; strings drift into it', 'Stillness'],
        ['13.4', 'Baton taps', 'Three taps through the tuning', 'Stillness'],
        ['14.4', 'HOLD YOUR BREATH', 'Snare + timpani rolls begin', 'Words slowly pull apart; tremor begins'],
        ['15.6', 'The riser', 'Shepard-Risset infinite rise', 'Vignette begins closing'],
        ['16.4 / 17.6 / 18.8', '3 - 2 - 1', 'Descending hits', 'Slam-settle, shockwave rings, light pops'],
        ['19.55', 'THE CUT', 'Silence. Two heartbeats.', 'Total freeze; spots converge to one pool'],
        ['21.1', 'The curtain', 'Motor, velvet rustle, dark swell', 'Anticipation tug, then the haul'],
        ['22.3', 'IMPACT', 'Sub drop; the reveal chord', 'Warm flash, clan colour floods, confetti'],
        ['22.5', 'The clan', 'Chord decays over 8 s', 'Hero mounts under the flash: crest, then name, then slogan'],
        ['22.8', 'The house rises', 'Ovation builds over 0.5 s', 'Confetti continues to fall'],
    ],
    widths=[0.75, 1.25, 1.75, 2.35], font=8.5, mono_cols=(0,),
)

callout(
    'Where the time went',
    'Total runtime rose from 21 s to 23.4 s, but almost none of that went into new '
    'content. It went into air: 0.8 s of darkness before the first words, 1.2 s to '
    'let the assembled theatre simply be looked at before the lights come up, and '
    '1.55 s of silence. The announcement card was shortened by a full second to pay '
    'for it. Suspense is mostly a budgeting problem.'
)

doc.add_page_break()

# ============================================================================
# 4. SOUND
# ============================================================================
doc.add_heading('4.  Sound Design', level=1)

para('All audio is synthesised at runtime through the Web Audio API. There are no '
     'audio files anywhere in the project.')

para('This began as a practical constraint - nothing to host, nothing to license, '
     'nothing that can fail to load midway through a reveal - but it became a design '
     'advantage. Every sound is a parameter set rather than a recording, so the '
     'countdown can descend in pitch, the timpani can rise across a roll, and the '
     'entire mix can be ducked and restored on a single scheduled curve.')

doc.add_heading('4.1  Building a room', level=2)

para('The single largest improvement in perceived quality was not any individual '
     'sound. It was giving them all somewhere to be.')

para('A convolution reverb was added with an impulse response generated at runtime: '
     '2.8 seconds long, RT60 of 1.9 seconds, exponential decay, with a low-pass '
     'coefficient that falls across the tail to model air absorption, and six '
     'discrete early reflections whose right-channel copies are offset by 3 '
     'milliseconds to create width. Each sound sends a different amount into it.')

para('The sends are where the storytelling happens. The gong and the bells sit deep '
     'in the hall. The sub-bass is sent entirely dry, because reverberated bass is '
     'mud. Most importantly the heartbeat during the cut is also completely dry, '
     'which places it inside the listener rather than in the room.')

doc.add_heading('4.2  Psychoacoustic devices', level=2)

table(
    ['Device', 'Implementation', 'Why it creates tension'],
    [
        ['Shepard-Risset riser',
         'Eight sawtooth voices launched at once, each pre-set to a different phase of a nominal 55 Hz to 1760 Hz sweep, plus one fresh voice every second (eleven in all). Hann loudness window',
         'An auditory illusion of endless ascent. The 8 s sweep is a rate constant, not a duration - the riser itself lives 3.95 s and every voice is cut off at 19.55 s, which is precisely why nothing is ever heard to arrive.'],
        ['Descending countdown',
         '3, 2, 1 pitched at 233, 208 and 185 Hz, each dropping to 58, 52 and 46 Hz',
         'The original ascended, which reads as triumph. Dread descends. Levels rise while pitch falls - louder and heavier at once.'],
        ['Programme duck',
         'Program bus to -38 dB in 100 ms; snaps back 30 ms before impact',
         'A snap restore, never a swell. A gradual return would telegraph the impact and defuse it.'],
        ['Dry against wet',
         'Heartbeat and inhale bypass the reverb and the duck',
         'A vast room that has gone quiet, with your own body still audible in it.'],
        ['Noise decorrelation',
         'Stereo noise buffer, independent per channel, random read offsets',
         'Previously every noise layer read the same buffer from the same offset - which is one sound comb-filtering against itself, not two instruments.'],
        ['Humanised rolls',
         'Timing jitter +/-6 ms, gain jitter +/-20%, alternate-hand accents, exponent-1.6 crescendo',
         'A metronomic roll is a drum machine. Small imperfections read as a player, and a player can be nervous.'],
    ],
    widths=[1.15, 2.2, 2.75], font=8.5,
)

doc.add_heading('4.3  The orchestra problem', level=2)

para('The reveal originally ended in a brass fanfare built from raw sawtooth '
     'oscillators. It was reviewed as childish, and the criticism was correct. '
     'Diagnosing exactly why produced the most transferable finding in the project.')

para('Three specific sounds were responsible, and all three came from the same '
     'sound-world - a birthday party rather than a ceremony:')

table(
    ['Sound', 'What it actually was', 'Replaced with'],
    [
        ['Party poppers', 'A square wave sweeping 900 to 110 Hz - the classic cartoon "boing"',
         'A compressed-air confetti cannon: low-passed whoomph, body thump, paper flutter'],
        ['Crowd whistles', 'Sine tones at 2093 / 2350 / 2637 Hz with vibrato - a sports stadium',
         'Removed. The ovation now builds over half a second instead of erupting'],
        ['Sparkle chimes', 'Seven bell tones after the impact - the mobile-game reward sound',
         'A single ceremonial bell, C2, with inharmonic partials, a 7-second darkening sweep and a 9-second tail'],
    ],
    widths=[1.0, 2.6, 2.5], font=8.5,
)

para('The deeper issue was that synthesised strings and brass sound like a synthesiser '
     'unless the qualities that make a section a section are built in deliberately. '
     'A shared ensemble builder now gives every note:')

bullet('Many detuned voices per note, each with independent slow pitch drift - a real section is never perfectly in tune with itself')
bullet('Ragged entries, with voices starting up to 50 ms apart, like bows landing at slightly different moments')
bullet('Linear attacks rather than exponential ones, because bowing is not plucking')
bullet('A low-pass filter that opens as the note swells, so brightness follows bow pressure')
bullet('Vibrato that arrives late, at slightly different rates per voice')
bullet('A whisper of bow and breath noise beneath the pitch')

para('The ending is now a chord rather than a tune. The whole orchestra lands at once '
     'on a suspended fourth - timpani stroke, ceremonial bell, low brass floor, '
     'strings - the suspension resolves to the major third 550 milliseconds later, '
     'horns bloom over the top at 1.3 seconds, and high strings add a final octave. '
     'It decays across eight seconds, carrying into the clan page so the reveal never '
     'falls into silence.')

doc.add_heading('4.4  Signal chain', level=2)

code([
    'voice -> [StereoPanner] -> program ---> HP 24 Hz',
    '              |                    -> presence  +1.5 dB @ 2.8 kHz',
    '              |                    -> low shelf -1 dB @ 90 Hz',
    '              |                    -> glue compressor  (-18 dB, 3:1, 12 ms)',
    '              |                    -> master   (mute lives here)',
    '              |                    -> tanh soft ceiling',
    '              |                    -> limiter  (-2 dB, 20:1, 1 ms)',
    '              |                    -> output',
    '              +-> send -> 20 ms predelay -> Convolver (generated hall IR)',
    '                       -> HP 180 -> LP 5500 -> return -> program',
])

para('Two details are load-bearing. The duck acts on the program bus, never on the '
     'master, so the cut can never fight the listener\'s own mute control. And a '
     'small set of sounds enter after the program bus, which is what allows the '
     'heartbeat to survive a moment in which everything else has been silenced.')

doc.add_page_break()

# ============================================================================
# 5. VISUALS
# ============================================================================
doc.add_heading('5.  Visual Design', level=1)

doc.add_heading('5.1  Typography', level=2)

para('The display face is Bodoni Moda; text is set in Inter.')

para('Bodoni is the historical playbill and marquee typeface, which makes it both '
     'period-correct for a theatre and, more usefully, expensive-looking. The reason '
     'is stroke contrast: the extreme difference between thick and thin strokes is '
     'what the eye reads as refinement. Headlines are therefore set at weight 500 '
     'rather than bold - increasing the weight of a Didone destroys the very contrast '
     'that makes it work - every display setting in the project is weight 500. '
     'Variable optical sizing thickens the hairlines automatically at smaller sizes '
     'so they do not disappear.')

callout(
    'What was deliberately avoided',
    'Cinzel and Montserrat. Both are the default choices when a brief asks for '
    '"premium", and both are recognisable as exactly that - a template. An earlier '
    'draft of this project used them and read as generic despite near-identical '
    'layout and colour; the change of typeface alone accounted for most of the '
    'improvement. (Recorded here as project history - the superseded draft is not '
    'preserved in the working tree.)'
)

doc.add_heading('5.2  The devices that carry the look', level=2)

table(
    ['Device', 'Instead of', 'Reasoning'],
    [
        ['Letterspaced capitals between hairlines', 'Filled pill labels',
         'A typographic solution reads as considered; a filled pill reads as a UI component'],
        ['Hairline rules between list rows', 'Bullet glyphs',
         'Editorial convention. Bullets belong to documents, rules belong to programmes'],
        ['2 px corner radii on every card, button and chip', '18 - 28 px radii',
         'Large radii read as consumer software; small radii read as print. The two white logo plates are the deliberate exceptions'],
        ['Flat solid fills', 'Gradient buttons',
         'Gradients on interactive elements are a dated skeuomorphic habit'],
        ['Solid ink headlines', 'Gradient-filled text',
         'Gradient fills fight the stroke contrast that justifies the typeface'],
        ['Elevation shadows', 'Coloured glows',
         'Glows describe light sources that are not present in the scene'],
        ['Film grain: 4% flat on the clan page, 5.5% with overlay blending while the reveal owns the screen', 'Flat colour',
         'The single strongest cue separating a printed surface from a digital one. The blend mode is dropped once the page scrolls, because compositing it over a scrolling document is expensive on mobile'],
        ['Circular crop on the crest', 'The square source image',
         'The artwork is already printed on the clan colour, so a circular mask makes the file edge vanish and yields a struck medallion'],
    ],
    widths=[1.75, 1.35, 3.0], font=8.5,
)

doc.add_heading('5.3  Staging the theatre', level=2)

para('The theatre is constructed entirely in CSS - there is no illustration or video '
     'asset. It is painted back to front in a single stacking context: back wall, '
     'raked floor, curtains, follow-spots, footlights, gilt proscenium.')

para('That order is not cosmetic. The spots must fall on the velvet, the footlights '
     'must sit in front of it on the apron, and the arch must frame everything. An '
     'earlier version rendered the curtains last, which covered the entire stage and '
     'made every other element invisible.')

para('The assembly is a sequence rather than a fade. Each element begins as the '
     'previous one is roughly sixty percent settled: the wall arrives, the floor '
     'rises, the valance drops with a sag-settle, the curtain halves close in from '
     'the wings, and the gilt arch appears with a single glint travelling across it. '
     'A whole theatre fading up at once reads as an image being loaded; a theatre '
     'assembling reads as a place being prepared.')

doc.add_heading('5.4  Motion principles', level=2)

bullet_rich([('One element at peak velocity at any moment. ', {'bold': True}),
             ('Overlaps are permitted only while the previous element is in its '
              'settle tail. This is the mechanical definition of "inevitable '
              'rather than busy".', {})])
bullet_rich([('Impulses, not loops. ', {'bold': True}),
             ('The screen shake was originally a linear, horizontal, infinitely '
              'repeating oscillation - which reads as a phone vibrating. It is now '
              'a decaying impulse per countdown hit, with vertical and rotational '
              'components, plus a continuous sub-pixel tremor between hits.', {})])
bullet_rich([('The environment must react. ', {'bold': True}),
             ('Each countdown number is accompanied by two expanding shockwave '
              'rings and a warm light pop, so the room responds to the hit rather '
              'than the number merely appearing.', {})])
bullet_rich([('Light blooms fast and decays slowly. ', {'bold': True}),
             ('Symmetric fades read as synthetic. The follow-spot pool reaches full '
              'brightness in 350 ms and takes 1.2 s to settle.', {})])
bullet_rich([('Heavy things do not bounce. ', {'bold': True}),
             ('The curtain halves get an anticipation tug - the grip taking the '
              'fabric - then a single heavy haul with no rebound. The settle is '
              'placed on the valance instead, where it can actually be seen.', {})])

doc.add_heading('5.5  The visual cut', level=2)

para('The silence has a visual counterpart, and it is mostly subtraction. At 19.55 '
     'seconds the tremor stops instantly, the countdown numeral fades over 220 ms, '
     'the light rays fade out and are removed, the footlights dim by roughly two '
     'thirds, and the two sweeping spots rotate to vertical and converge into a '
     'single pool that becomes smaller and brighter at once. A vignette closes to '
     '85% opacity. The two ambient CSS loops that run throughout - the haze drift '
     'in the spot cones and the out-of-phase footlight twinkle - are paused as '
     'well, so the freeze is total rather than merely mostly still.')

para('Every one of those transitions completes within 450 milliseconds. What follows '
     'is roughly 1.1 seconds in which nothing on screen moves at all. It is the most '
     'expensive-feeling second in the piece and it costs nothing to produce.')

doc.add_page_break()

# ============================================================================
# 6. VERIFICATION
# ============================================================================
doc.add_heading('6.  Verification', level=1)

para('Suspense is subjective; correctness is not. Three automated harnesses check '
     'the properties that would silently break the experience.')

doc.add_heading('6.1  Timeline and legibility', level=2)

para('A script walks the build-up one second at a time and asserts two invariants '
     'that had each already been violated once in development. First, crimson velvet '
     'must never be on screen while the titles are still set in dark ink. Second, '
     'every text beat must clear a 3:1 real luminance contrast ratio against '
     'whatever is actually painted behind it - measured, not judged by eye.')

table(
    ['Beat', 'Background', 'Measured contrast'],
    [
        ['FOUR CLANS / ONE RISHIHOOD', 'Warm paper', '15.4 : 1'],
        ['YOUR CLAN HAS BEEN ALLOTTED', 'Crimson velvet', '10.6 : 1'],
        ['HOLD YOUR BREATH', 'Crimson velvet', '10.6 : 1'],
        ['Countdown 3 / 2 / 1', 'Crimson velvet', '10.6 : 1'],
    ],
    widths=[2.4, 1.7, 1.7], font=9,
)

doc.add_heading('6.2  Audio measurement', level=2)

para('Because the sound cannot be evaluated by listening during development, the '
     'post-curtain block is rendered through an offline audio context and measured '
     'numerically.')

table(
    ['Measurement', 'Result', 'Interpretation'],
    [
        ['Peak, mono sum', '0.775', 'Headroom retained in the summed signal'],
        ['Peak, worst channel', '0.787', 'No clipping in either channel individually'],
        ['Non-finite samples', '0', 'No broken automation anywhere in the graph'],
        ['RMS at impact', '0.315', 'The loudest moment, as intended'],
        ['RMS at 6 - 8 s', '0.111', 'The chord genuinely sustains'],
        ['RMS at 8.5 - 9.5 s', '0.030', 'Graceful decay rather than an abrupt stop'],
        ['Stereo correlation', '0.883', 'Wide, while remaining safe in mono'],
        ['Spectral centroid, impact', '204 Hz', 'Energy sits in the low register'],
        ['Spectral centroid, chord', '378 Hz', 'Strings, horns and timpani'],
    ],
    widths=[1.9, 1.0, 2.9], font=9,
)

callout(
    'Making "childish" measurable',
    'Spectral centroid is the brightness centre of gravity of a sound. Twinkly '
    'chimes and whistles push it above roughly 1800 Hz. After the rewrite the '
    'reveal measures 204 Hz at the impact and 378 Hz across the chord. The '
    'subjective note that the ending "sounded childish" turned out to have a '
    'direct objective correlate, which made the fix verifiable rather than a '
    'matter of taste.'
)

doc.add_heading('6.3  Behavioural checks', level=2)

para('A third harness drives all eight routes end to end and asserts that each '
     'renders the correct clan, that the crest loads and is centred to within two '
     'pixels, that the correct number of leaders appears and the first is the '
     'Chief, that each carries five pointers, that '
     'no console errors or failed requests occur, and that nothing overflows '
     'no uncaught page exceptions and no HTTP response of 400 or worse occurs. A '
     'separate pass reloads one route at 390 pixels and checks that it neither '
     'overflows horizontally nor wraps the clan name.')

para('A dedicated regression test toggles mute ten seconds into the sequence and '
     'asserts that the experience is still mid-countdown with exactly one card on '
     'screen. This guards a defect that once caused the entire soundtrack to be '
     'scheduled a second time, overlapping itself: an unstable object identity was '
     're-running the scheduling effect, and while browser timers could be cleared '
     'and re-armed, audio already committed to the hardware clock could not be.')

# ============================================================================
# 7. FINDINGS
# ============================================================================
doc.add_heading('7.  Findings', level=1)

para('The transferable conclusions, in rough order of how much they changed the '
     'outcome:')

findings = [
    ('Take something away.',
     'The most effective suspense device in the entire piece is 1.55 seconds of '
     'near-silence. Nothing that was added produced a comparable effect.'),
    ('Establish a pulse, then break it.',
     'The metronomic countdown exists to teach the audience when the next beat is '
     'due, so that its absence can be felt. Regularity is the setup, not the payoff.'),
    ('Give sounds a room.',
     'A single shared convolution reverb did more for perceived production value '
     'than any individual sound design decision.'),
    ('Imperfection reads as human, and humans can be nervous.',
     'Timing jitter, ragged section entries and independent pitch drift are what '
     'separate a performer from a machine.'),
    ('Cheapness is usually specific and diagnosable.',
     'Square-wave sweeps, twinkly chimes and crowd whistles are not vaguely wrong; '
     'they are borrowed from a different occasion. Naming the borrowed occasion '
     'points directly at the fix.'),
    ('Sequence beats simultaneity.',
     'A theatre assembling element by element reads as a place being prepared; the '
     'same theatre fading up at once reads as an image loading.'),
    ('Subjective criticism often has an objective correlate.',
     'Finding it - spectral centroid, in this case - turns a matter of taste into '
     'something that can be measured and defended.'),
    ('Write the harness that would have caught it.',
     'Every automated check in section 6 exists because the corresponding defect '
     'shipped at least once first: invisible titles on velvet, a crest drifting '
     'off centre, a soundtrack scheduling itself twice.'),
]
for i, (t, b) in enumerate(findings, 1):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.3)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(f'{i}.  {t}  ')
    r.bold = True
    p.add_run(b)

doc.add_heading('7.1  Open items', level=2)
para('The experience is complete; its content is not. Clan slogans, war cries, the '
     'names and photographs of the seven clan leaders, and the social handles remain '
     'placeholders and must be replaced before the reveal is sent.')

# ============================================================================
# APPENDIX
# ============================================================================
doc.add_heading('Appendix  -  Where things live', level=1)

table(
    ['File', 'Contains'],
    [
        ['src/audio/engine.js', 'The entire procedural sound engine: buses, reverb, every instrument'],
        ['src/components/RevealSequence.jsx', 'The beat sheet and all audio/visual scheduling'],
        ['src/components/Stage.jsx', 'Proscenium, floor, spots, footlights, assembly order'],
        ['src/components/Curtains.jsx', 'Velvet halves, valance, opening physics'],
        ['src/components/ClanHero.jsx', 'The reveal cascade: crest, name, slogan'],
        ['src/styles/global.css', 'Theme variables, theatre materials, motion primitives'],
        ['src/data/clans.js', 'The only file requiring content edits'],
        ['scripts/timeline.mjs / checkall.mjs', 'Assertion harnesses (see section 6)'],
        ['scripts/capture.mjs / themeshots.mjs', 'Screenshot tools for visual review'],
        ['audiotest.html', 'Offline audio rendering and measurement (development only)'],
    ],
    widths=[2.3, 3.8], font=8.5, mono_cols=(0,),
)

para()
para('Prepared for Rishihood University  -  Clan Allotment 2026',
     italic=True, color=GREY, size=9, align=WD_ALIGN_PARAGRAPH.CENTER)

import sys
out = sys.argv[1] if len(sys.argv) > 1 else 'Clan_Reveal_Design_Research.docx'
doc.save(out)
print('written:', out)
