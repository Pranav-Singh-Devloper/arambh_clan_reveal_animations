#!/usr/bin/env python3
"""
Normalise leader cut-outs for the clan cards.

WHY THIS EXISTS
The card renders every portrait at a fixed HEIGHT (object-fit: contain,
object-position: bottom center). So the only thing that controls how big a
person's head looks on screen is the ratio  head-height : image-height.
Source photos never agree on that - one arrives as a wide podium shot where the
subject is 40% of the frame, another as a tight 800x800 bust - and dropped in
raw they render at wildly different scales side by side.

So each photo is cropped to a matched bust framing, then scaled to a common
output height. After this, head sizes agree on screen.

Crops are expressed as fractions of the source so they survive a re-export at a
different resolution. Re-run after adding a photo:

    python3 scripts/prep_leader_photos.py
"""
import os
import numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'src', 'about_leads', 'images')
OUT = os.path.join(SRC, 'web')
OUT_HEIGHT = 900          # ~2.3x the 390px display height - retina with headroom
TARGET_ASPECT = 1.03      # width / height of the finished bust crop

# Per photo: the crop box as fractions (left, top, right, bottom) of the source.
#
# The first two were tuned by eye. Everything after them was DERIVED, because
# eyeballing seven of these would not have held together: measure the head (the
# alpha row-width profile peaks at the skull, dips at the neck), then cut the
# bottom edge at a fixed 2.25 head-heights below the crown. That number is not
# arbitrary - it is what the two approved Chola cards already measured, and it
# is the thing that actually governs the match. Auto-fit below then scales
# whatever the crop contains to a fixed height, so "same number of heads in the
# crop" is exactly equivalent to "same head size on the card".
#
# Consequence worth knowing before you re-tune anything: the top edge does not
# matter. Auto-fit re-derives from the alpha bounding box, so transparent
# headroom is discarded. Only the BOTTOM cut sets the scale.
CROPS = {
    # Wide shot at a lectern. Cropped to a bust above the hands, so the podium
    # and microphone do not appear on a portrait card.
    'aabir_sarkar.png': (0.3795, 0.1323, 0.6748, 0.5626),   # above the hands/podium
    # Already a tight bust. Was 0.91, trimmed by eye to "look like" Aabir's;
    # once the head could actually be measured that turned out to be 50% of
    # frame against his 44%, the widest mismatch in the set. His torso already
    # runs off the bottom of the source, so taking the crop to the frame edge is
    # the most body available and closes the gap to ~1.5 points.
    'deepanshu_chaudhary.png': (0.0000, 0.0000, 1.0000, 1.0000),

    # Derived, 2.25 heads. Full-length or three-quarter sources - all of them
    # would have rendered as tiny distant figures if dropped in uncropped.
    # Hand-derived, and worth explaining because the auto-derivation got this
    # one badly wrong. The head detector sizes its search windows as a fraction
    # of the FIGURE height, which assumes a full-body source where the head is
    # about 19% of it. This photo is already a tight bust - head about 36% of
    # the visible figure - so the window stopped at rel 348 while the real neck
    # is at rel 469. It locked onto a dip at the jaw and reported a 244px head
    # instead of 469px; the crop then cut at 2.25 x 244 and produced a floating
    # head with the mask dissolve slicing through his chin.
    # Widening the search to a fixed 600px band finds the true neck.
    'nakul-2.png': (0.0000, 0.0044, 1.0000, 0.8303),               # headH 469px
    'pranav_singh.png': (0.3707, 0.2892, 0.8531, 0.6404),       # headH 486px
    'neelanshu_karan.png': (0.3000, 0.3478, 0.7050, 0.6427),    # headH 185px
    'aaryan_yadav.png': (0.1892, 0.1039, 0.8224, 0.5649),       # headH 271px, seated
    'kushagrah.png': (0.0289, 0.3234, 0.6016, 0.6361),          # headH 157px
}


HEADROOM = 0.04           # transparent gap above the subject, as a fraction


def process(name, box):
    """Crop away anything that is not the person, then AUTO-FIT: scale so the
    subject occupies the same fraction of the frame in every file, centre it
    horizontally on its own silhouette, and sit it on the floor. Doing this
    from the alpha bounding box (rather than trusting the crop box) is what
    makes head sizes agree on screen and keeps future photos consistent
    without re-tuning by eye."""
    src = os.path.join(SRC, name)
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    l, t, r, b = box
    # PIL pads out-of-bounds crops with transparency, so a negative top is fine
    crop = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))

    bbox = crop.getchannel('A').getbbox()
    if not bbox:
        raise SystemExit(f'{name}: no opaque pixels - is the background removed?')
    subject = crop.crop(bbox)

    # scale the subject to the shared fraction of the output height
    target_h = int(OUT_HEIGHT * (1 - HEADROOM))
    scale = target_h / subject.height
    subject = subject.resize(
        (max(1, int(subject.width * scale)), target_h), Image.LANCZOS)

    out_w = int(OUT_HEIGHT * TARGET_ASPECT)
    canvas = Image.new('RGBA', (out_w, OUT_HEIGHT), (0, 0, 0, 0))
    # A crop that catches wide-out arms scales to a subject wider than the
    # canvas, and alpha_composite at a negative offset raises rather than
    # centring. Say which photo and by how much, instead of failing cryptically.
    if subject.width > out_w:
        raise SystemExit(
            f'{name}: bust is {subject.width}px wide but the canvas is {out_w}px. '
            f'Narrow this photo\'s crop box, or raise TARGET_ASPECT for all of them.')
    canvas.alpha_composite(subject, ((out_w - subject.width) // 2,
                                     OUT_HEIGHT - subject.height))

    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, os.path.splitext(name)[0] + '.webp')
    # Lossy WebP with alpha. A full RGBA PNG of a photo this size runs to
    # ~1 MB each; palette-quantizing it down posterized the skin into visible
    # bands. WebP gives PNG-free file sizes with no banding, and keeps the
    # 8-bit alpha the cut-out needs.
    canvas.save(dst, 'WEBP', quality=88, method=6, exact=False)

    out = Image.open(dst).convert('RGBA')
    a = out.getchannel('A').getbbox()
    cx = (a[0] + a[2]) / 2
    head = head_height(out)
    print(f'{os.path.basename(dst):28} -> {out_w}x{OUT_HEIGHT}  {os.path.getsize(dst)/1024:6.0f} KB   '
          f'head {head/OUT_HEIGHT*100:4.1f}% of frame, '
          f'off-centre {abs(cx - out_w/2):.0f}px, floor gap {OUT_HEIGHT-a[3]}px')
    return head / OUT_HEIGHT


def head_height(im):
    """Head height in pixels, from the alpha row-width profile: it peaks at the
    skull and dips at the neck. This is the number the whole script exists to
    equalise, so it is measured on the OUTPUT rather than assumed - a crop can
    be right in theory and still land wrong."""
    mask = np.array(im.getchannel('A')) > 128
    widths = mask.sum(axis=1)
    ys = np.flatnonzero(widths)
    seg = widths[ys[0]:ys[-1] + 1]
    n = len(seg)
    # Windows are sized for a BUST, where the head is roughly the top 45%. The
    # same code with full-figure windows reads the chest as the neck and reports
    # head sizes that are wrong by a third - which is how a set of crops that
    # were in fact well matched first got flagged as broken.
    peak = int(np.argmax(seg[:max(3, int(n * 0.30))]))
    tail = seg[peak:peak + max(3, int(n * 0.35))]
    return peak + int(np.argmin(tail))


# Which card each photo appears on. Head sizes are checked PER CLAN, because
# that is the only place two portraits are ever seen together - Deepanshu is
# never on screen beside Aaryan, so holding all seven to one number would be
# stricter than the design requires and would flag mismatches nobody can see.
CLAN_OF = {
    'nakul-2.png': 'Rajputana', 'pranav_singh.png': 'Rajputana',
    'neelanshu_karan.png': 'Vijaya',
    'aaryan_yadav.png': 'Maratha', 'kushagrah.png': 'Maratha',
    'aabir_sarkar.png': 'Chola', 'deepanshu_chaudhary.png': 'Chola',
}

if __name__ == '__main__':
    heads = {name: process(name, box) for name, box in CROPS.items()}

    print()
    worst = 0
    for clan in ['Rajputana', 'Vijaya', 'Maratha', 'Chola']:
        vals = [v * 100 for k, v in heads.items() if CLAN_OF.get(k) == clan]
        if not vals:
            continue
        spread = max(vals) - min(vals)
        worst = max(worst, spread)
        note = 'single portrait' if len(vals) < 2 else f'spread {spread:.1f} pts'
        # Side by side, heads disagreeing by more than ~3 points of frame height
        # read as two different photo sizes rather than one set.
        flag = '' if spread <= 3 else '   <-- re-tune, this will look mismatched'
        print(f'  {clan:10} head {"/".join(f"{v:.1f}%" for v in vals):16} {note}{flag}')
    print(f'\n{"all clans matched" if worst <= 3 else "MISMATCH - see above"}; '
          f'written to {os.path.normpath(OUT)}')
