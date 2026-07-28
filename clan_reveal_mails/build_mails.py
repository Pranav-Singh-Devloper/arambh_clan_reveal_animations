#!/usr/bin/env python3
"""
Builds the 8 clan-reveal emails (4 clans x 2 audiences) from ONE template.

Every mail is byte-for-byte identical except the reveal link, so edit the copy
or the template here and re-run:  python3 build_mails.py

Output: students_<clan>.html and team_<clan>.html in this folder.
"""

import os

# ---------------------------------------------------------------------------
# CONFIG - change these two lines when the reveal sites go live
# ---------------------------------------------------------------------------
REVEAL_BASE = "https://arambh-clan-reveal-animations.vercel.app"   # live, verified

# Reveal-page codes. Deliberately meaningless: /r/3184 tells the recipient
# nothing, and student/team codes for the same clan share no digits. These MUST
# match ROUTES in clan_reveal_websites/src/data/clans.js.
CODES = {
    ("students", "rajputana"): "3184",
    ("students", "vijaya"): "5027",
    ("students", "maratha"): "7362",
    ("students", "chola"): "9415",
    ("team", "rajputana"): "2760",
    ("team", "vijaya"): "4839",
    ("team", "maratha"): "6193",
    ("team", "chola"): "8524",
}

# Where each mail is ALSO published as a web page, on the same deployment, so a
# link can be shared without attaching a file: /m/<code>.
#
# A separate table from CODES on purpose. Reusing the reveal code would mean
# /m/9415 and /r/9415 were the same clan, and anyone who noticed could map one
# space onto the other. The two sets are disjoint - no value appears in both.
#
# (Individual digits do overlap between a mail code and its own reveal code;
# that is coincidence in a four-digit space and carries no information. The
# property that matters is that the sets do not intersect.)
#
# Opaque in themselves, and a leaked mail URL gives away nothing anyway: the
# mails never name a clan, which is the whole reason they can be hosted.
MAIL_CODES = {
    ("students", "rajputana"): "4071",
    ("students", "vijaya"): "6238",
    ("students", "maratha"): "8905",
    ("students", "chola"): "1647",
    ("team", "rajputana"): "5312",
    ("team", "vijaya"): "7486",
    ("team", "maratha"): "2059",
    ("team", "chola"): "3728",
}

# The site's public/ directory is copied verbatim into its build, so writing
# the mails there is all it takes for them to ship with the deployment. One
# source of truth: the file you send and the page you link are byte-identical
# because they are written in the same pass.
WEB_MAIL_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "clan_reveal_websites", "public", "m")

# All images live at the root of the aarambh_images repo and are already up.
_IMG = "https://raw.githubusercontent.com/raindeer-sociaI/aarambh_images/refs/heads/main"
CREST_BASE = _IMG          # crests are <slug>.jpg.jpeg
ICON_BASE = _IMG           # icons are <name>.png
RISHIHOOD_LOGO = f"{_IMG}/rishihood_complete_logo.png"

CLANS = [
    ("rajputana", "Rajputana", "#03923A"),
    ("vijaya",    "Vijaya",    "#FFAF02"),
    ("maratha",   "Maratha",   "#F15002"),
    ("chola",     "Chola",     "#004AAD"),
]

# ---------------------------------------------------------------------------
# COPY - straight from student_context.md / team_context.md
# ---------------------------------------------------------------------------
STUDENT = {
    "audience": "students",
    "title": "Discover Your Tribe | Rishihood Clans",
    "preheader": "Four Clans. One Rishihood. One of them is already yours. Open to find out which.",
    "eyebrow": "Clan Allotment &bull; 2026",
    "headline": "Welcome to Rishihood:<br />Discover Your Tribe!",
    "hero_sub": "Your Clan has already been allotted. You just don’t know it yet.",
    "intro_kicker": "The allotment is done. The envelope is sealed.",
    "intro": (
        "Somewhere in our records, a Clan already has your name on it: a crest, a colour and a "
        "few hundred people who are about to become your people."
    ),
    "intro_2": "There is only one way to find out which one. <strong>Open it.</strong>",
    "seal_label": "Sealed until you open it",
    "seal_line": "One click. One crest. One family for the next four years.",
    "cta": "Reveal My Clan",
    "cta2": "Reveal My Clan",
    "cta2_kicker": "Still sealed?",
    "sections": [
        ("shield", "WHAT are the Rishihood Clans?", [
            ("Your Campus Identity",
             "The entire Rishihood learner body is divided into 4 distinct Clans: Rajputana, Maratha, Chola &amp; Vijaya."),
            ("More Than Just a Group",
             "Your Clan is your home base for campus rivalries, sports leagues, cultural fests, and lifelong friendships."),
        ]),
        ("clan", "WHY are you assigned a Clan?", [
            ("Instant Connections",
             "Skip the awkward icebreakers; you immediately belong to a tight-knit family of peers and seniors."),
            ("Faculty Mentorship",
             "You’ll share your Clan with faculty members and staff who will cheer for you both in and out of class!"),
        ]),
        ("trophy", "HOW does this enrich your university life?", [
            ("Friendly Competition",
             "Earn Clan points through academics, sports, arts, and community initiatives to win the Clan Glory Cup and much more!"),
            ("Beyond the Classroom",
             "Build leadership skills, collaborate across different majors, and forge bonds that drive incredible classroom synergy."),
            ("A Built-in Support System",
             "Seniors in your Clan are your go-to guides for navigating campus life."),
        ]),
        ("flag", "WHAT should you do right now?", [
            ("Unveil Your Clan", "Click the button above to see where you land!"),
            ("Represent with Pride", "Wear your Clan T-shirts and bring the energy to Orientation Week."),
            ("Connect &amp; Participate",
             "Join your Clan group chat and get ready for the first Clan Competitions of the semester!"),
        ]),
    ],
    
    "closing": "Four Clans. One Rishihood.<br />Let the journey begin!",
    "footnote": "",
    "footer_bar": "Rishihood University &bull; Clan Allotment 2026",
}

TEAM = {
    "audience": "team",
    "title": "Meet Your Clan | Rishihood Clans",
    "preheader": "Four Clans. One Rishihood. Yours is already allotted. Open to find out which.",
    "eyebrow": "Clan Allotment &bull; 2026",
    "headline": "Team Rishihood,<br />Meet Your Clan!",
    "hero_sub": "Your Clan has already been allotted. You just don’t know it yet.",
    "intro_kicker": "The allotment is done. The envelope is sealed.",
    "intro": (
        "Clan spirit is no longer just a learner thing. Every faculty and team member now carries a "
        "crest, a colour and a few hundred colleagues and learners to cheer alongside."
    ),
    "intro_2": "There is only one way to find out which one. <strong>Open it.</strong>",
    "seal_label": "Sealed until you open it",
    "seal_line": "One click. One crest. One side of the rivalry to stand on.",
    "cta": "Reveal My Clan",
    "cta2": "Reveal My Clan",
    "cta2_kicker": "Still sealed?",
    "sections": [
        ("shield", "WHAT is happening?", [
            ("One Community, Four Clans",
             "All Rishihood learners are divided into 4 vibrant Clans to foster competition, collaboration, and community spirit: Vijaya, Rajputana, Chola and Maratha."),
            ("Expanding the Circle",
             "All faculty and team members are divided into these Clans to build a unified Rishihood family!"),
        ]),
        ("clan", "WHY should I know my Clan?", [
            ("Integration with Learning",
             "Incorporate Clan dynamics into your classroom activities, group projects, and team exercises."),
            ("Shared Ownership",
             "Clan spirit isn’t just managed by the Learner Experience Team; it belongs to all of us!"),
        ]),
        ("trophy", "HOW is this helpful for me?", [
            ("Stronger Learner Connection",
             "Connect with learners outside academics, breaking formal barriers."),
            ("Enhanced Classroom Camaraderie",
             "Pre-existing Clan bonds create better engagement, participation, and trust inside the classroom. They have their slogans, rituals and camaraderie!"),
            ("Cross-Departmental Synergy",
             "Team up with colleagues from different departments under your shared Clan banner for classroom activities."),
        ]),
        ("flag", "WHAT can you do next?", [
            ("Find Your Clan", "Click the button above and discover where you belong."),
            ("Wear Your Colours",
             "Represent your Clan during university events, sports days, and campus drives. "
             "Email us at <a href=\"mailto:learnerexperience@rishihood.edu.in\" style=\"color:#DB5527;font-weight:700;text-decoration:none;border-bottom:1px solid rgba(219,85,39,0.4);\">learnerexperience@rishihood.edu.in</a> to get one!"),
            ("Bring it to the Classroom",
             "Design fun icebreakers, quizzes, or team challenges around Clan points!"),
        ]),
    ],
    
    "closing": "Let’s build a stronger,<br />more connected Rishihood together!",
    "footnote": "",
    "footer_bar": "Rishihood University &bull; Clan Allotment 2026",
}


# ---------------------------------------------------------------------------
# PARTIALS
# ---------------------------------------------------------------------------
def crest_strip(crest_base):
    """Four clan crests side by side - a teaser, never a spoiler.

    alt is empty and the cell carries a min-height, so a missing or blocked
    image leaves a solid clan-coloured tile instead of a collapsed pill with a
    broken-image glyph. The clan name below the tile carries the meaning."""
    cells = []
    for slug, name, colour in CLANS:
        cells.append(f"""              <td width="25%" align="center" valign="top" style="padding: 0 5px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                  style="border-radius: 14px; overflow: hidden; border: 1px solid rgba(51,58,61,0.10);">
                  <tr>
                    <td align="center" height="92" bgcolor="{colour}"
                      style="background-color: {colour}; height: 92px; padding: 0; line-height: 0; font-size: 0;">
                      <img src="{crest_base}/{slug}.jpg.jpeg" alt="" width="132"
                        style="width: 100%; max-width: 132px; height: auto; display: block; border: 0;" />
                    </td>
                  </tr>
                </table>
                <div style="font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; color: {colour}; padding-top: 10px;">{name}</div>
              </td>""")
    return "\n".join(cells)


def button(link, label, dark=False):
    """Bulletproof, Outlook-safe CTA button."""
    bg = "#DB5527"
    shadow = "0 12px 28px rgba(219, 85, 39, 0.35)" if not dark else "0 12px 28px rgba(0, 0, 0, 0.35)"
    return f"""<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                  <tr>
                    <td align="center" bgcolor="{bg}" style="background-color: {bg}; border-radius: 16px; box-shadow: {shadow};">
                      <a href="{link}" target="_blank" rel="noopener"
                        style="display: inline-block; padding: 19px 44px; font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.6px; color: #ffffff; text-decoration: none; border-radius: 16px;">{label} &nbsp;&rarr;</a>
                    </td>
                  </tr>
                </table>"""


def icon_badge(icon, size=40, icon_size=23, bg="#FFE5CD"):
    """Cream disc + line icon. Alt is empty on purpose: if a client blocks
    images the badge degrades to a clean cream disc, never a broken-image box."""
    return f"""<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                        <tr>
                          <td width="{size}" height="{size}" align="center" valign="middle" bgcolor="{bg}"
                            style="background-color: {bg}; width: {size}px; height: {size}px; border-radius: {size // 2}px; line-height: 0; font-size: 0;">
                            <img src="{ICON_BASE}/{icon}.png" alt="" width="{icon_size}"
                              style="width: {icon_size}px; max-width: {icon_size}px; height: auto; display: inline-block; border: 0;" />
                          </td>
                        </tr>
                      </table>"""


def section_block(icon, heading, items):
    rows = []
    for i, (title, body) in enumerate(items):
        top = "0" if i == 0 else "20px"
        rows.append(f"""                  <tr>
                    <td width="40" valign="top" align="center" style="padding: {top} 0 0 0;">
                      <div style="background: #FFE5CD; width: 10px; height: 10px; border-radius: 5px; margin-top: 7px; font-size: 0; line-height: 0;">&nbsp;</div>
                    </td>
                    <td style="padding: {top} 0 0 18px; text-align: left;">
                      <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #CC0033;">{title}</div>
                      <div style="font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif; font-size: 13.5px; line-height: 1.65; color: #6b7280; margin-top: 3px;">{body}</div>
                    </td>
                  </tr>""")

    return f"""            <tr>
              <td class="pad-lg" style="padding: 34px 48px 0 48px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td width="40" valign="middle" align="center">
                      {icon_badge(icon)}
                    </td>
                    <td style="padding-left: 16px; text-align: left;">
                      <h2 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 1.25; font-weight: 700; color: #333A3D;">{heading}</h2>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="pad-lg" style="padding: 18px 48px 0 48px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
{chr(10).join(rows)}
                </table>
              </td>
            </tr>"""


# ---------------------------------------------------------------------------
# TEMPLATE
# ---------------------------------------------------------------------------
def render(cfg, clan_slug, clan_name, link):
    sections = "\n\n".join(section_block(e, h, i) for e, h, i in cfg["sections"])
    crests = crest_strip(CREST_BASE)

    return f"""<!DOCTYPE html>
<html lang="en">

<!--
  ===========================================================================
  CLAN REVEAL MAIL  |  audience: {cfg['audience'].upper()}  |  clan: {clan_name.upper()}
  ---------------------------------------------------------------------------
  This mail is IDENTICAL to the other 7. The only difference is the link
  behind both "Reveal My Clan" buttons:

      {link}

  Send this file ONLY to the {cfg['audience']} allotted to {clan_name}.
  The mail never names the clan - the reveal happens on the landing page.
  Generated by build_mails.py - edit copy there, not here.
  ===========================================================================
-->

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>{cfg['title']}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
    rel="stylesheet">
  <style>
    body,
    table,
    td,
    a {{
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }}

    table,
    td {{
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }}

    img {{
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      display: block;
    }}

    body {{
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #FFF8F0;
      font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
      color: #333A3D;
    }}

    .container {{
      max-width: 640px;
      margin: 0 auto;
    }}

    .card {{
      background: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(51, 58, 61, 0.08);
      border: 1px solid rgba(204, 0, 51, 0.06);
    }}

    .headline {{
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #CC0033;
    }}

    .bodycopy {{
      font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
      color: #333A3D;
      line-height: 1.8;
    }}

    .pill {{
      display: inline-block;
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(255, 229, 205, 0.18);
      color: #FFE5CD;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.8px;
      text-transform: uppercase;
    }}

    .divider {{
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(204, 0, 51, 0.2), rgba(219, 85, 39, 0.25), transparent);
    }}

    @media screen and (max-width: 600px) {{
      .container {{
        width: 100% !important;
      }}

      .card {{
        border-radius: 0 !important;
      }}

      .pad-lg {{
        padding-left: 24px !important;
        padding-right: 24px !important;
      }}

      .hero-title {{
        font-size: 30px !important;
      }}

      .crest-name {{
        font-size: 9px !important;
      }}
    }}
  </style>
</head>

<body>
  <!-- Inbox preview text -->
  <div
    style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #FFF8F0; opacity: 0;">
    {cfg['preheader']}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <center style="width: 100%;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="max-width: 640px; margin: 0 auto;" class="container">
      <tr>
        <td style="padding: 32px 14px 32px 14px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="card">

            <!-- Hero -->
            <tr>
              <td bgcolor="#CC0033"
                style="background-color: #CC0033; background: radial-gradient(circle at top right, rgba(219, 85, 39, 0.35) 0%, transparent 60%), linear-gradient(180deg, #CC0033 0%, #8A0022 100%); padding: 48px 32px 46px 32px; text-align: center;">
                <div style="max-width: 520px; margin: 0 auto;">

                  <!-- Rishihood logo on a clean white plate -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
                    style="margin: 0 auto 26px auto;">
                    <tr>
                      <td bgcolor="#ffffff" align="center"
                        style="background-color: #ffffff; border-radius: 14px; padding: 14px 22px;">
                        <img src="{RISHIHOOD_LOGO}" alt="Rishihood University" width="150"
                          style="width: 150px; max-width: 150px; height: auto; display: block;" />
                      </td>
                    </tr>
                  </table>

                  <div class="pill" style="margin-bottom: 22px;">{cfg['eyebrow']}</div>

                  <h1 class="hero-title"
                    style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 38px; line-height: 1.18; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">
                    {cfg['headline']}</h1>

                  <div
                    style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 17px; line-height: 1.6; color: rgba(255, 255, 255, 0.92);">
                    {cfg['hero_sub']}</div>
                </div>
              </td>
            </tr>

            <!-- Intro -->
            <tr>
              <td class="pad-lg" style="padding: 44px 48px 0 48px;">
                <div
                  style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 1.5; font-weight: 700; color: #CC0033; margin-bottom: 14px;">
                  {cfg['intro_kicker']}</div>
                <p class="bodycopy" style="margin: 0; font-size: 16px;">{cfg['intro']}</p>
                <p class="bodycopy" style="margin: 16px 0 0 0; font-size: 16px;">{cfg['intro_2']}</p>
              </td>
            </tr>

            <!-- Sealed reveal card + primary CTA -->
            <tr>
              <td class="pad-lg" style="padding: 32px 48px 0 48px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#333A3D"
                  style="background-color: #333A3D; background: radial-gradient(circle at 50% 0%, rgba(219, 85, 39, 0.30) 0%, transparent 62%), #333A3D; border-radius: 26px; box-shadow: 0 14px 34px rgba(51, 58, 61, 0.16);">
                  <tr>
                    <td align="center" style="padding: 38px 28px 36px 28px;">
                      <img src="{ICON_BASE}/lock.png" alt="" width="44"
                        style="width: 44px; max-width: 44px; height: auto; display: inline-block; border: 0; margin-bottom: 18px;" />
                      <div
                        style="font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #DB5527; margin-bottom: 12px;">
                        {cfg['seal_label']}</div>
                      <div
                        style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; line-height: 1.45; color: #ffffff; max-width: 380px; margin: 0 auto 28px auto;">
                        {cfg['seal_line']}</div>
                      {button(link, cfg['cta'], dark=True)}
                      <div
                        style="font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 18px;">
                        Best opened with the sound on.</div>
                      <div
                        style="font-family: 'Montserrat', Arial, sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.3px; color: #DB5527; margin-top: 6px;">
                        Turn your volume up to 100%.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 36px 48px 0 48px;">
                <div class="divider"></div>
              </td>
            </tr>

            <!-- Four crests -->
            <tr>
              <td class="pad-lg" style="padding: 34px 48px 0 48px; text-align: center;">
                <h2
                  style="margin: 0 0 6px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #333A3D;">
                  Four Clans. One Rishihood.</h2>
                <p
                  style="margin: 0 0 24px 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 13.5px; color: #6b7280;">
                  One of these crests is already yours.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
{crests}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 34px 48px 0 48px;">
                <div class="divider"></div>
              </td>
            </tr>

{sections}

            <!-- Divider -->
            <tr>
              <td style="padding: 36px 48px 0 48px;">
                <div class="divider"></div>
              </td>
            </tr>

            <!-- Secondary CTA -->
            <tr>
              <td class="pad-lg" style="padding: 36px 48px 0 48px; text-align: center;">
                <div
                  style="font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #DB5527; margin-bottom: 14px;">
                  {cfg['cta2_kicker']}</div>
                {button(link, cfg['cta2'])}
              </td>
            </tr>

            <!-- Closing -->
            <tr>
              <td class="pad-lg" style="padding: 46px 48px 0 48px; text-align: center;">
                <img src="{ICON_BASE}/star.png" alt="" width="22"
                  style="width: 22px; max-width: 22px; height: auto; display: inline-block; border: 0; margin-bottom: 14px;" />
                <div
                  style="font-family: Georgia, 'Times New Roman', serif; font-size: 21px; line-height: 1.5; font-weight: 700; color: #CC0033;">
                  {cfg['closing']}</div>
              </td>
            </tr>

            <!-- Bottom logo -->
            <tr>
              <td style="padding: 40px 48px 44px 48px; text-align: center;">
                <img src="{RISHIHOOD_LOGO}" alt="Rishihood University" width="140"
                  style="width: 140px; max-width: 140px; height: auto; display: inline-block;" />
              </td>
            </tr>

            <!-- Footer bar -->
            <tr>
              <td bgcolor="#CC0033"
                style="background-color: #CC0033; background: linear-gradient(90deg, #CC0033 0%, #DB5527 100%); padding: 18px 24px; text-align: center;">
                <div
                  style="font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.95); font-weight: 600;">
                  {cfg['footer_bar']}</div>
              </td>
            </tr>

          </table>

          <div style="text-align: center; padding: 20px 8px 0 8px;">
            <div style="font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #8b5e4b; opacity: 0.85;">
              &copy; 2026 Rishihood University. All rights reserved.</div>
          </div>
        </td>
      </tr>
    </table>
  </center>
</body>

</html>
"""


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(WEB_MAIL_DIR, exist_ok=True)

    # anything stale in public/m would keep being deployed forever
    for old in os.listdir(WEB_MAIL_DIR):
        if old.endswith(".html"):
            os.remove(os.path.join(WEB_MAIL_DIR, old))

    built = []
    for cfg in (STUDENT, TEAM):
        for slug, name, _ in CLANS:
            audience = cfg["audience"]
            link = f"{REVEAL_BASE}/r/{CODES[(audience, slug)]}"
            html = render(cfg, slug, name, link)

            path = os.path.join(here, f"{audience}_{slug}.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(html)

            code = MAIL_CODES[(audience, slug)]
            with open(os.path.join(WEB_MAIL_DIR, f"{code}.html"), "w", encoding="utf-8") as fh:
                fh.write(html)

            built.append((os.path.basename(path), link, f"{REVEAL_BASE}/m/{code}"))

    width = max(len(n) for n, _, _ in built)
    for name, link, page in built:
        print(f"{name.ljust(width)}  ->  {link}")
    print(f"\n{len(built)} mails written to {here}")
    print(f"and published as pages in {os.path.normpath(WEB_MAIL_DIR)}:\n")
    for name, _, page in built:
        print(f"  {name.ljust(width)}  ->  {page}")


if __name__ == "__main__":
    main()
