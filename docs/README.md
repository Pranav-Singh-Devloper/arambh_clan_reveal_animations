# Documentation

**`Clan_Reveal_Design_Research.docx`**, the design and research record for the
Clan Reveal: the tension curve, the full beat sheet, sound and motion research,
and the measurements used to verify both.

Regenerate after any change to the experience:

```bash
python3 docs/build_doc.py docs/Clan_Reveal_Design_Research.docx
```

The document quotes exact timings from `RevealSequence.jsx`, exact synthesis
values from `engine.js`, and measured output from `scripts/timeline.mjs` and
`audiotest.html`. **Every one of those numbers was fact-checked against the
source**, which caught several errors in the first draft, a stated runtime that
did not exist in the code, a misdescribed Shepard-riser mechanism, a silence
claimed as three times shorter than it is, and a regression test described as
existing when it did not. If you edit the experience, re-verify rather than
assuming the prose still holds.
