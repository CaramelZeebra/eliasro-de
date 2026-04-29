// All site content lives here.
// Edit strings, save, the page rebuilds. Prose fields accept inline HTML
// (<i>, <b>, <a>, &mdash;, …) — they are rendered with dangerouslySetInnerHTML.

export const site = {
  // ────────────────────────── global / cover ──────────────────────────
  meta: {
    name: 'Elias Rode',
    subtitle: 'A Brief Index of Personal Works &amp; Correspondence',
    affiliation:
      'Student of Mathematics &amp; Philosophy, Trinity College Dublin',
    abstract:
      'This document collects, in a single volume, the author&rsquo;s biographical sketch (§1), a register of works (§2), a list of writings (§3), an annotated list of recently watched films (§4), an account of recent occupations (§5), a record of subjects studied (§6), an abridged curriculum vit&aelig; (§7), a journal of occasional entries (§8), an index of recommendations from elsewhere on the internet (§9), and the canonical avenues by which one may make contact (§10). The reader is invited to turn the page.',
    compiledDate: '2026&#8209;04&#8209;26',
  },

  // ────────────────────────── pages (TOC + nav) ───────────────────────
  pages: [
    { id: 'title',   num: 'i',  label: 'Title' },
    { id: 'about',   num: '1',  label: 'About' },
    { id: 'works',   num: '2',  label: 'Works' },
    { id: 'writing', num: '3',  label: 'Writing' },
    { id: 'reading', num: '4',  label: 'Reading' },
    { id: 'now',     num: '5',  label: 'Now' },
    { id: 'studies', num: '6',  label: 'Studies' },
    { id: 'cv',      num: '7',  label: 'Curriculum' },
    { id: 'blog',    num: '8',  label: 'Blog' },
    { id: 'links',   num: '9',  label: 'Links' },
    { id: 'contact', num: '10', label: 'Contact' },
    // Hidden from TOC + Contents; navigated to from the account menu (merch)
    // and from the merch store itself (chat).
    { id: 'merch',   num: 'M',  label: 'Store' },
    { id: 'chat',    num: 'C',  label: 'Chat' },
  ] as const,

  // ────────────────────────── §1 about ────────────────────────────────
  about: {
    intro: [
      'I am a student in my penultimate year of studying mathematics, with a minor in philosophy, at Trinity College Dublin. My primary interests are abstract algebra, analysis and game theory. I keep, as a hobby, an eye on the computer science scene and enjoy playing around with scripting, designing, and maintaining useless projects.',
      'Anything I do I insist on doing correctly, and so everything I engage with that sees the light of day is properly typeset, organised, and has received my stamp of approval. I will, however, never write a second draft. My thoughts are received in their most natural state.',
    ],
    inhabitations: {
      num: '1.1',
      title: 'Inhabitations',
      body: 'Having previously resided in Paris, I currently call Dublin home as I study at Trinity College Dublin. I am, however, keeping an eye on different programmes and experiences available across the rest of Europe.',
    },
    pursuits: {
      num: '1.2',
      title: 'Pursuits and Interests',
      paragraphs: [
        'Potentially the biggest fan of Dublin bikes, I can be found cycling along the banks of the Liffey at practically any hour of the day. I enjoy hikes, primarily with friends and/or family. I read books, watch many movies and play games.',
        'In my youth, I obsessed over computer games; today I play board and card games, with a particular interest in poker. The statistics and psychology behind the game only get more interesting the deeper you look.',
      ],
    },
  },

  // ────────────────────────── §2 works ────────────────────────────────
  works: {
    intro:
      'A non&#8209;exhaustive register of programs, scripts, and small curiosities. The reader will note a recurring fondness for problems that sit just on the edge of being useful.',
    items: [
      {
        num: '2.1',
        title: 'Polygonal Approximator',
        meta: '— Python · 2024',
        body:
          'An evolution&#8209;based program, from my days of learning some of the concepts behind machine learning, which attempts to (badly) convert images into the vertices of polygons, or the foci of ellipses. The output was then fed into <a class="latex-link" href="https://www.desmos.com/3d/hdifqltoov" target="_blank" rel="noopener">Desmos</a> for rendering. <a class="latex-link" href="https://www.desmos.com/3d/hdifqltoov" target="_blank" rel="noopener">[fig.&nbsp;2.1]</a>',
      },
      {
        num: '2.2',
        title: 'Quiet Tools',
        meta: '— Bash, Python · ongoing',
        body:
          'A collection of tidbits and scripts, written for the parsing of large databases and the automation of indignities. Most are related to collecting data from around the world into places that I want them, others are simply to use once and never again.',
      },
      {
        num: '2.3',
        title:
          'An Elegant Approach to Session Authentication (And then Session Management)',
        meta: '— Hyprland · 2026',
        body:
          'Configurations for hyprlock, and then a widget to transform the lockscreen and desktop (of compatible systems) into tasteful, LaTeX&#8209;inspired information hubs, which I am told are all the rage amongst the youth these days.',
      },
    ],
  },

  // ────────────────────────── §3 writing ──────────────────────────────
  writing: {
    intro:
      'Notices, occasional essays, and the rare announcement. The author writes infrequently and at length; the reader is invited to subscribe by post.',
    items: [] as Array<{ num: string; title: string; meta: string; blurb: string }>,
  },

  // ────────────────────────── §4 reading ──────────────────────────────
  reading: {
    intro:
      'A register, partial and biased, of recent reading. Unfortunately, the records of books read was lost in a tragic accident and so we will need to substitute for recently watched films. Stars are awarded by the author and should not be trusted.',
    items: [
      ['2026-04-25', '1979', 'Life of Brian',                            '★★★★★', ''],
      ['2026-04-18', '1976', 'Network',                                  '★★★★½', ''],
      ['2026-04-11', '1964', 'Dr. Strangelove',                          '★★★★★', 're-watch'],
      ['2026-02-22', '1957', '12 Angry Men',                             '★★★★½', ''],
      ['2026-02-08', '2013', 'About Time',                               '★★★★½', ''],
      ['2026-01-31', '2019', 'Parasite',                                 '★★★★★', ''],
      ['2026-01-30', '1997', 'Boogie Nights',                            '★★★★½', ''],
      ['2026-01-01', '2004', 'Eternal Sunshine of the Spotless Mind',    '★★★★★', ''],
      ['2025-12-28', '1967', 'The Graduate',                             '★★★★½', ''],
    ] as Array<[date: string, year: string, title: string, rating: string, note: string]>,
    marginNote: '<b>n.b.</b> Recommendations are accepted by the address in §7.',
  },

  // ────────────────────────── §5 now ──────────────────────────────────
  now: {
    intro:
      '<i>An informal note on the present quarter, updated as occasion permits. (Last revised: 26 April 2026.)</i>',
    blocks: [
      { num: '5.1', label: 'Reading',   body: 'Joseph Heller&rsquo;s <i>Catch&#8209;22</i>, slowly. Carrying it about as one carries a pocket&#8209;watch.' },
      { num: '5.2', label: 'Writing',   body: 'Bad jokes, unmemorable quips and uninteresting websites.' },
      { num: '5.3', label: 'Studying',  body: 'Somehow computer science and meta&#8209;ethics. There is little crossover.' },
      { num: '5.4', label: 'Working',   body: 'Summer internship at PwC, and then secret projects with even more secret <a class="latex-link" href="https://matth3wc.github.io/" target="_blank" rel="noopener">friends</a>.' },
      { num: '5.5', label: 'Walking',   body: 'From home to college, daily, and then on the occasional day in which free time manages to sneak into my schedule, a hike.' },
      { num: '5.6', label: 'Listening', body: 'Conversations of students around campus. I&rsquo;m unsure of what is to come of academia.' },
    ],
  },

  // ────────────────────────── §6 studies ──────────────────────────────
  studies: {
    intro:
      'An ordered record of subjects studied at Trinity College Dublin and, prior, in secondary school. These lists are partial; modules which left the author not feeling particularly moved and/or enlightened have been omitted.',
    blocks: [
      {
        num: '6.1',
        title: 'Year I',
        modules: [
          'Single Variable Calculus and Introductory Analysis',
          'Linear Algebra',
          'Analysis on the Real Line',
          'Advanced Calculus',
          'History of Western Philosophy I',
          'Central Problems in Philosophy',
        ],
      },
      {
        num: '6.2',
        title: 'Year II',
        modules: [
          'Ordinary Differential Equations',
          'Introduction to Complex Analysis',
          'Calculus on Manifolds',
          'Analysis in Several Real Variables',
          'Advanced Analysis',
          'Group Theory',
          'Fields, Rings, and Modules',
          'Logic',
          'Epistemology and Philosophy of Science',
          'History of Western Philosophy II',
        ],
      },
      {
        num: '6.3',
        title: 'Year III',
        modules: [
          'Commutative Algebra',
          'Euclidean and Non&#8209;Euclidean Geometry',
          'Fixed Point Theorems and Economic Equilibria',
          'Galois Theory',
          'Introduction to Number Theory',
          'Lie Algebras and Lie Groups',
          'Symbolic Programming',
          'Artificial Intelligence I',
          'Meta&#8209;ethics',
          'Political Philosophy',
          'Logic and Philosophy',
        ],
      },
      {
        num: '6.4',
        title: 'Leaving Certificate',
        modules: [
          'French', 'Spanish', 'Mathematics', 'Applied Maths',
          'Physics', 'Chemistry', 'Engineering', 'English', 'Irish',
        ],
      },
    ],
  },

  // ────────────────────────── §7 cv ───────────────────────────────────
  cv: {
    intro: 'An abridged record.',
    education: {
      num: '7.1',
      title: 'Education',
      rows: [
        {
          when: '2024 &mdash; 2027',
          loc: 'expected',
          place: 'Trinity College Dublin',
          role: 'B.A. Mathematics (Minor: Philosophy). First Class, Y1&ndash;2.',
          detail:
            'Selected: Real &amp; Complex Analysis · Number Theory · ODEs · Symbolic Programming · Logic · Central Problems in Philosophy.',
        },
        {
          when: '2023',
          place: 'Irish Leaving Certificate',
          role: 'French grades are modelled after Dunning&#8209;Kruger for some reason.',
        },
      ],
    },
    experience: {
      num: '7.2',
      title: 'Experience',
      rows: [
        {
          when: '2026 &mdash; 2027',
          place: 'Trinity College Dublin Mathematical Society — <i>Auditor (Chair)</i>',
          role: 'Elected to lead the society&rsquo;s executive committee for the academic year.',
        },
        {
          when: 'Summer 2026',
          place: 'PwC — <i>Intern</i>',
          role: 'What I get up to remains to be seen.',
        },
        {
          when: 'Jun &mdash; Aug 2025',
          place: 'Central Bank of Ireland — <i>Data Analyst (intern)</i>',
          role:
            'Filtered, cleaned and presented survey &amp; questionnaire data, used bank&#8209;wide. Wrote SQL for aggregation across large databases. Maintained core infrastructure.',
        },
        {
          when: 'Jan 2024 &mdash; <i>present</i>',
          place: 'Self&#8209;employed — <i>Private Tutor, Mathematics</i>',
          role:
            'Tutoring secondary&#8209;school students (14&ndash;18), in person and over Teams. Personally manage timetabling, locations and correspondence for up to six clients concurrently.',
        },
      ],
    },
    skills: {
      num: '7.3',
      title: 'Skills',
      rows: [
        { when: 'Programming', value: 'Python · Prolog · Bash · C++ · SQL' },
        { when: 'Tools',       value: 'Git · Linux · LaTeX · Office &amp; Google suites' },
        { when: 'Other',       value: 'Documentation · light AI work · presentation &amp; templating' },
      ],
    },
    languages: {
      num: '7.4',
      title: 'Languages',
      rows: [
        { when: 'English',   value: 'Fluent' },
        { when: 'French',    value: 'Fluent' },
        { when: 'Norwegian', value: 'C1 (Cultural Understanding)' },
        { when: 'Spanish',   value: 'B1' },
      ],
    },
  },

  // ────────────────────────── §9 links ────────────────────────────────
  links: {
    intro:
      'A small index of things from elsewhere on the internet which the author has found worth keeping.',
    items: [
      {
        url: 'https://www.madandmoonly.com/doctormatt/misc.htm',
        title: 'Matthew Conroy — a list of dice problems',
        description: 'of interest to the aspiring probabilist',
      },
      {
        url: 'https://detexify.kirelabs.org/classify.html',
        title: 'Detexify — a LaTeX symbol classifier',
        description: 'the power of artificial intelligence applied to the problem of remembering what a given symbol is called',
      },
      {
        url: 'https://p2r3.github.io/convert/',
        title: 'Convert',
        description: 'convert file A into file B',
      },
      {
        url: 'https://q.uiver.app/',
        title: 'quiver — a commutative diagram editor',
        description: 'with one-click export to LaTeX',
      },
      {
        url: 'https://www.firefox.com/en-US/',
        title: 'Install Firefox',
      },
    ] as Array<{ url: string; title: string; description?: string }>,
  },

  // ────────────────────────── §10 contact ─────────────────────────────
  contact: {
    intro: 'The author may be reached, in order of personal preference, by:',
    items: [
      { key: 'e&#8209;mail', value: '<a class="latex-link" href="mailto:elias.rode@gmail.com">elias.rode@gmail.com</a>' },
      { key: 'e&#8209;mail', value: '<a class="latex-link" href="mailto:rodee@tcd.ie">rodee@tcd.ie</a>' },
      { key: 'github',       value: '<a class="latex-link" href="https://github.com/CaramelZeebra" target="_blank" rel="noopener">github.com/CaramelZeebra</a>' },
      { key: 'linkedin',     value: '<a class="latex-link" href="https://www.linkedin.com/in/elias-rode-37a95a404/" target="_blank" rel="noopener">linkedin.com/in/elias-rode</a>' },
    ],
    mailingList: {
      num: '10.1',
      title: 'Mailing list',
      body:
        'Notes posted by the author, infrequent and at length. To subscribe, send a blank message with subject &lsquo;<i>Subscribe</i>&rsquo; to <a class="latex-link" href="mailto:elias.rode@gmail.com?subject=Subscribe">elias.rode@gmail.com</a>. Alternatively, any form of request which makes it to the author&rsquo;s doorstep indicating the desire to join the mailing list (accompanied by a valid mail address) will suffice.',
    },
    signoff: {
      line: '— with cordial regards,',
      name: 'E. R.',
    },
    colophon:
      '<b>colophon.</b> This document set in faux Computer Modern via system serif fallbacks, compiled to HTML on the 26th of April, 2026.',
  },

  // ────────────── paper preview shown on the desk in the library ──────
  // A miniature version of the title page; shortened so the small paper
  // remains legible. Update to track meta.abstract when that changes.
  paperPreview: {
    abstract:
      'This document collects, in a single volume, the author&rsquo;s biographical sketch, a register of works, recent occupations, an academic record, occasional entries, and the canonical avenues by which one may make contact.',
    section1: {
      num: '1',
      title: 'About',
      body:
        'In my penultimate year reading mathematics and philosophy at Trinity College Dublin. Primary interests: abstract algebra, analysis, game theory.',
    },
    section2: {
      num: '2',
      title: 'Works',
      body:
        'A polygonal image approximator, an assortment of quiet scripts, and a Hyprland desktop typeset like a paper.',
    },
  },
} as const;

export type Site = typeof site;
