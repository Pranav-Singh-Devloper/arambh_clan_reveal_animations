/* ===========================================================================
   THE ONLY FILE YOU NEED TO EDIT.

   Leader names, roles, pointers, photos and social URLs are all REAL, taken
   from src/about_leads/ (notes, images/ and socials.txt). Run
   `node scripts/content-check.mjs` before sending to list anything still open.

   Clans have a WAR CRY and nothing else - there is no slogan field, and there
   was never a real slogan to put in one. Four invented ones ('Valour Never
   Fades' and friends) sat in the hero until the real cries arrived; they are
   gone. The cry now takes that slot, which is where a clan's own line belongs
   on the page that reveals the clan.

   Two different kinds of empty, and they are not interchangeable:
     null  - this account does not exist. Never rendered, never chased.
     '#'   - a real account whose URL nobody has supplied yet. Never rendered
             either, but content-check.mjs lists it until it is filled in.
   Either way the icon is dropped: a link that goes nowhere is worse than an
   absent one.

   Route codes are deliberately meaningless: /r/3184 tells a recipient nothing
   about which clan they got, and the four codes are non-sequential so nobody
   can guess a sibling link. Changing a code here changes the URL - if you do
   that, re-run clan_reveal_mails/build_mails.py so the mails follow.
   =========================================================================== */

/* Crests are BUNDLED, not hotlinked. They used to load from
   raw.githubusercontent.com, which is not a CDN, is rate-limited, and is a
   third party standing between a student and the single image the whole
   22-second build-up exists to deliver. Measured cold: 0.4-0.7s on a fast
   desktop connection, requested at the exact moment the hero mounts - so on a
   phone the payoff frame would have arrived with an empty space in it. Bundled
   they are same-origin, content-hashed, cached forever, and preloaded during
   the build-up (see RevealPage). The mails still use absolute URLs - email has
   no bundler - so the GitHub copies stay where they are. */
import rajputanaCrest from '../assets/crests/rajputana.jpg'
import vijayaCrest from '../assets/crests/vijaya.jpg'
import marathaCrest from '../assets/crests/maratha.jpg'
import cholaCrest from '../assets/crests/chola.jpg'

/* Leader cut-outs, normalised by scripts/prep_leader_photos.py so every
   subject occupies the same fraction of the frame - the card scales to a fixed
   height, so that ratio is the only thing controlling apparent head size. */
import nakulPhoto from '../about_leads/images/web/nakul-2.webp'
import pranavPhoto from '../about_leads/images/web/pranav_singh.webp'
import neelanshuPhoto from '../about_leads/images/web/neelanshu_karan.webp'
import aaryanPhoto from '../about_leads/images/web/aaryan_yadav.webp'
import kushagrahPhoto from '../about_leads/images/web/kushagrah.webp'
import aabirPhoto from '../about_leads/images/web/aabir_sarkar.webp'
import deepanshuPhoto from '../about_leads/images/web/deepanshu_chaudhary.webp'

/* The music bed, per clan.

   Maratha runs Lose My Mind; the other three run Lush Life. Re-encoded to
   120 kbps to match, because the source was 192 kbps / 4.9 MB and this is a
   background bed heard on a phone speaker - the extra bitrate bought nothing
   audible and cost two megabytes on the one connection that cannot spare them.

   `bass` is a low-shelf lift in dB, applied to that track alone. Masters are
   not interchangeable: Lush Life is a bright TikTok mashup that thins out on a
   phone speaker and wants weight underneath it, while Lose My Mind already
   carries its own low end and would only turn muddy. */
import lushLife from '../audio/Lush Life x Unforgettable (Altego Tiktok Remix Mashup) Zara Larsson x French Montana.mp3'
import loseMyMind from '../audio/lose_my_mind.mp3'

export const MUSIC = {
  lushLife: { src: lushLife, bass: 3.5 },
  loseMyMind: { src: loseMyMind, bass: 0 },
}

/* 'dark' or 'light'. Append ?theme=light (or ?theme=dark) to any URL to preview
   the other one without changing this. */
export const THEME = 'light'

/* ---------------------------------------------------------------------------
   LEADER PHOTOS
   All seven are in. Do NOT point `photo` at a raw export: every file here comes
   out of scripts/prep_leader_photos.py, which crops each source to the same
   bust framing (a fixed 2.25 head-heights) so heads are the same size on the
   card. Sources disagree wildly - a 4160x2773 lectern shot, an 800x800 bust, a
   720x1280 full-length - and dropped in raw they render at visibly different
   scales beside each other.

   To add or replace one: put the background-removed PNG in about_leads/images/,
   add a crop box to CROPS in that script, run it, import the .webp it writes.
   The script prints each head size and fails loudly if two leaders on the SAME
   clan card disagree by more than 3 points of frame height.

   Leave `photo` as null and the card falls back to a monogram, so nothing
   breaks while a photo is being sorted out.

   POINTERS  (**emphasis** marks the impactful bit)
   Wrap a phrase in **double asterisks** to emphasise it - Leaders.jsx renders
   those as <strong>. Mark only what a first-year would actually find striking:
   the award, the title, the name in the room. Emphasising half a sentence
   emphasises nothing. content-check.mjs enforces at least two per leader.

   Five per leader - Pranav has a sixth, by request - deliberately similar in
   length (16-25 words each; that per-pointer band, not a per-leader total, is
   what the balance check enforces, so a sixth line does not read as drift),
   written from
   the source notes in src/about_leads/. Concrete achievement first - the
   specifics are what a first-year finds aspirational, and generic praise
   ("demonstrating leadership and teamwork") reads as filler and lowers the
   whole card. Nothing here is invented: where the source material ran out,
   the slot is marked TODO rather than filled with something unearned.

   Every pointer was fact-checked line by line against its source note, because
   these are real named students being published to the whole incoming cohort.
   That pass caught two invented claims (a founding claim for SAGE, a working
   method attributed to Aabir) and several inflations - 'exposure' written up
   as 'ships', an interest written up as expertise - all since corrected. If
   you edit these, re-check against src/about_leads/ rather than trusting the
   prose.
   --------------------------------------------------------------------------- */

/* Every one of the seven is on the same programme in the same batch, so this
   is a constant rather than the same string repeated seven times. If a future
   cohort is mixed, move it onto the leader objects. Written with a middot, not
   a hyphen: the copy across this project carries no dashes. */
export const PROGRAMME = 'B.Tech in CS & AI · 2024/2028'

export const CLANS = {
  rajputana: {
    name: 'Rajputana',
    crest: rajputanaCrest,
    color: '#03923A',
    deep: '#01421A',
    glow: 'rgba(3, 146, 58, 0.55)',
    warCry: 'राजपूताना राज करेगा!',
    music: MUSIC.lushLife,
    leaders: [
      {
        name: 'Nakul Jaglan',
        role: 'Chief',
        photo: nakulPhoto,
        instagram: 'https://instagram.com/nakul.jaglan',
        linkedin: 'https://linkedin.com/in/nakuljaglan',
        email: 'nakul.2024@nst.rishihood.edu.in',
        points: [
          '**Founder** of a **B2B AI startup**, building a company and leading a clan in the same year.',
          'Knows Rishihood’s policies **end to end**, and is the person to ask when you cannot work out how something is meant to work.',
          'Will defend the mess menu to anyone who will listen, which is as good a reason as any to go and talk to him.',
        ],
      },
      {
        name: 'Pranav Singh',
        role: 'Deputy Chief',
        photo: pranavPhoto,
        instagram: 'https://www.instagram.com/pranav_singh_0924/',
        linkedin: 'https://www.linkedin.com/in/pranav-singh-developer/',
        email: 'pranav.singh2024@nst.rishihood.edu.in',
        points: [
          'Selected in Haryana’s delegation to the National Youth Festival 2025, where his idea was pitched directly in front of the **Prime Minister Shri Narendra Modi**.',
          'Represented Rishihood at the NVIDIA AI Summit in Mumbai and met **Jensen Huang**, the founder and CEO of NVIDIA.',
          '**Ex-Secretary of the Google Developer Group**, ran Neutron Hackathon, Ideathon and Visual Vortex end to end, from logistics to operations to sponsorship.',
          '**Winner of DECODE 2025** and a finalist at Mumbai Hacks; his startup raindeer.social was selected for Rishihood’s AI Venture Studio.',
          '**Two internships before second year**: SDE Intern at Profeshare AI, and now LLM Engineering Intern at Slay Health, both early-stage startups.',
          'Part of the **university swimming team** at BOSOM 2025, plays **electric guitar** with Saarang, and has finished the **100 km Walk twice**.',
        ],
      },
    ],
    socials: [
      { platform: 'Instagram', label: 'Rajputana Clan', handle: '@rajputana.clan',
        url: 'https://www.instagram.com/rajputana.clan/' },
      /* The only clan with a LinkedIn page. Supplied as
         .../company/108103435/admin/dashboard/ - that is the page-management
         view, which only page admins can open; every student following it would
         have hit an access error. Public company URL is the id on its own. */
      { platform: 'LinkedIn', label: 'Rajputana Clan', handle: 'Rajputana',
        url: 'https://www.linkedin.com/company/108103435/' },
    ],
  },

  vijaya: {
    name: 'Vijaya',
    crest: vijayaCrest,
    color: '#FFAF02',
    deep: '#6B4600',
    glow: 'rgba(255, 175, 2, 0.55)',
    warCry: 'विजया!',
    music: MUSIC.lushLife,
    // Vijaya has a Chief only - no Deputy. The card is full width like every
    // other, so it never reads as a lone shrunken box.
    leaders: [
      {
        name: 'Neelanshu Karn',
        role: 'Chief',
        photo: neelanshuPhoto,
        instagram: 'https://www.instagram.com/neelanshu_karn/',
        linkedin: 'https://www.linkedin.com/in/neelanshu-karn-05146130a/',
        email: 'neelanshu.2024@nst.rishihood.edu.in',
        points: [
          'Currently doing an **international fellowship**, designing benchmarks and evaluation systems for frontier AI models.',
          '**Founder and President of SAST**, building Rishihood’s space ecosystem: a rover team, NASA Space Apps, and a **CubeSat prototype** showcased at **Bharat Mandapam**.',
          'Leads Project Nebula with **65+ open-source contributors**, and grew the SAST repository into an official Hacktoberfest selection.',
          'Vice President of Arthakram, with **seven hackathon wins** spanning product, design, data and innovation, presented before leaders from Blinkit and J.P. Morgan.',
          'Raised over **₹6 lakh in sponsorship** for flagship events, and runs hackathons, exhibitions and astronomy outreach across campus.',
        ],
      },
    ],
    socials: [
      { platform: 'Instagram', label: 'Vijaya Clan', handle: '@vijaya.clan',
        url: 'https://www.instagram.com/vijaya.clan/' },
      // no clan LinkedIn page exists - nothing to link, so nothing is shown
    ],
  },

  maratha: {
    name: 'Maratha',
    crest: marathaCrest,
    color: '#F15002',
    deep: '#5E1D00',
    glow: 'rgba(241, 80, 2, 0.55)',
    warCry: 'For Victory, For Glory, For Maratha, जय मराठा!',
    music: MUSIC.loseMyMind,
    leaders: [
      {
        name: 'Aaryan Yadav',
        role: 'Chief',
        photo: aaryanPhoto,
        instagram: 'https://www.instagram.com/__aaryan.yadav____/',
        linkedin: 'https://www.linkedin.com/in/aaryan-yadav-272b8a315/',
        email: 'aaryan.yadav2024@nst.rishihood.edu.in',
        points: [
          '**Software development intern** with hands-on industry exposure across software engineering and AI, where the work is practical rather than theoretical.',
          '**District-level badminton and volleyball player**, with the habit of performing when the scoreline is against him.',
          '**Hackathon winner**, with the knack of building something that genuinely works while the deadline is closing in.',
          '**Secretary of the Google Developer Group**, organising events and fostering collaboration and technical learning across the community.',
          'Set on using AI and emerging technology for problems that actually matter, rather than for the sake of the tool.',
        ],
      },
      {
        name: 'Kushagra Maheshwari',
        role: 'Deputy Chief',
        photo: kushagrahPhoto,
        instagram: 'https://www.instagram.com/kushagrraa/',
        linkedin: 'https://www.linkedin.com/in/kushm11/',
        email: 'kushagra.maheshwari2024@nst.rishihood.edu.in',
        points: [
          '**International Basketball Gold Medalist**. He has competed at the highest level and knows exactly what the preparation costs.',
          '**Third Runner-Up at the UCMAS International Abacus Competition**, with concentration and analytical problem-solving built from a young age.',
          '**Prabhakar degree holder in Indian Classical Music**, earned over years of practice in an art that rewards only patience.',
          '**President of the Creators’ Club**, leading a community of filmmakers and creators and mentoring the people inside it.',
          '**Filmmaker** and creative visionary who takes an idea all the way to the screen: story, direction and everything between.',
        ],
      },
    ],
    socials: [
      { platform: 'Instagram', label: 'Maratha Clan', handle: '@maratha_clan',
        url: 'https://www.instagram.com/maratha_clan/' },
      // no clan LinkedIn page exists
    ],
  },

  chola: {
    name: 'Chola',
    crest: cholaCrest,
    color: '#004AAD',
    deep: '#001C42',
    glow: 'rgba(0, 74, 173, 0.60)',
    warCry: 'हर हर महादेव!',
    music: MUSIC.lushLife,
    leaders: [
      {
        name: 'Aabir Sarkar',
        role: 'Chief',
        photo: aabirPhoto,
        instagram: 'https://www.instagram.com/aabirsarkar32/',
        linkedin: 'https://www.linkedin.com/in/aabir-sarkar-2aa54126b/',
        email: 'aabir.sarkar2024@nst.rishihood.edu.in',
        points: [
          '**Winner of seven product hackathons**, a record built by turning an idea into a defensible product, repeatedly, under pressure.',
          '**Building two startups at once** while leading Chola, which tells you most of what you need to know about his standards.',
          'An entrepreneur and **product manager at heart**, with product thinking as the lens he brings to everything he builds.',
          'Follows investing and global markets closely, and will happily talk them through with anyone curious enough to ask.',
          'Passionate about **public speaking**, and glad to make the case for an idea in front of a room.',
        ],
      },
      {
        name: 'Deepanshu Chaudhary',
        role: 'Deputy Chief',
        photo: deepanshuPhoto,
        instagram: null, // he has no Instagram; null = does not exist, so it is
                        // dropped from the card AND not chased by content-check
        linkedin: 'https://in.linkedin.com/in/deepanshu-chaudhary17',
        email: 'deepanshu.chaudhary2024@nst.rishihood.edu.in',
        points: [
          'Third-year B.Tech student in Computer Science and AI, and a **machine learning intern** already building in the field.',
          '**National-level Taekwondo athlete**, university footballer and marathon enthusiast. Whatever the next challenge is, he is already training for it.',
          '**Community Manager at the Esports Federation of India**, where he has led esports initiatives at both national and international level.',
          '**President of SAGE**, holding to a standard he set himself: serve something bigger than you, and stand by your teammates.',
          'Believes **passion beats perfection**, and that in Chola you do not simply participate. **You dominate**. His words, not ours.',
        ],
      },
    ],
    socials: [
      { platform: 'Instagram', label: 'Chola Clan', handle: '@chola_clan',
        url: 'https://www.instagram.com/chola_clan/' },
      // no clan LinkedIn page exists
    ],
  },
}

/* Shown under every clan's own two, so the footer of the page carries four
   links in total: the clan's Instagram and LinkedIn, then the university's. */
export const UNIVERSITY_SOCIALS = [
  /* Handles read off the real URLs. The placeholders here were @life_at_ru and
     @rishihooduniversity - both plausible, both wrong, and a printed handle
     that does not resolve is its own kind of dead link. */
  { platform: 'Instagram', label: 'Life at Rishihood', handle: '@lifeat_rishihood',
    url: 'https://www.instagram.com/lifeat_rishihood/' },
  { platform: 'Instagram', label: 'Rishihood University', handle: '@rishihooduni',
    url: 'https://www.instagram.com/rishihooduni/' },
]

/* --- route codes -> (clan, audience) -------------------------------------
   8 codes, one per mail. Nothing in the code hints at the clan, and student
   and team codes for the same clan share no digits, so two people comparing
   links learn nothing.                                                      */
export const ROUTES = {
  3184: { clan: 'rajputana', audience: 'students' },
  5027: { clan: 'vijaya', audience: 'students' },
  7362: { clan: 'maratha', audience: 'students' },
  9415: { clan: 'chola', audience: 'students' },

  2760: { clan: 'rajputana', audience: 'team' },
  4839: { clan: 'vijaya', audience: 'team' },
  6193: { clan: 'maratha', audience: 'team' },
  8524: { clan: 'chola', audience: 'team' },
}

export function resolveCode(code) {
  /* hasOwnProperty, not a bare lookup. ROUTES is a plain object literal, so
     /r/constructor and /r/toString resolved to Object.prototype members -
     truthy, spread into a clan with no `color`, and the page died on
     clan.color.replace() with a white screen instead of the not-found page.
     A human will not type those, but a crawler or a mangled mail link will. */
  const entry = Object.prototype.hasOwnProperty.call(ROUTES, code) ? ROUTES[code] : null
  if (!entry) return null
  return { code, ...entry, ...CLANS[entry.clan] }
}

/* Copy that differs between a first-year and a colleague. */
export const AUDIENCE_COPY = {
  students: {
    preTitle: 'Your clan has been allotted',
    welcome: 'You are now one of us.',
    leadersTitle: 'Meet Your Clan Leaders',
    leadersSub: 'The people who set the standard here. Go and find them.',
    socialsSub: 'Follow your clan. The first challenge drops soon.',
  },
  team: {
    preTitle: 'Your clan has been allotted',
    welcome: 'You are now one of us.',
    leadersTitle: 'Meet Your Clan Leaders',
    leadersSub: 'The students leading your clan this year.',
    socialsSub: 'Follow your clan and bring it into the classroom.',
  },
}
