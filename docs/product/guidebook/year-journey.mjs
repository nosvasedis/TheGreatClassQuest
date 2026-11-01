/**
 * Your Year of Quest: the suggested order for bringing the Quest into a class, one layer at a time.
 * The "Your Year of Quest" chapter (00-year-journey.md + el-chapters.mjs) explains the rules; this file
 * holds the road itself, drawn by build.mjs#yearJourneyHtml.
 *
 * - `at` is the month of the school year counted from the class's first Quest month (0 = the first month).
 *   The page turns it into a calendar month from the "We started in" choice.
 * - `plan` is the lowest plan that has the step: 'starter' (every plan), 'pro' or 'elite'.
 * - `go` points at a chapter and, when given, one of its headings (English and Greek text exactly as written
 *   in the chapter). build.mjs refuses to build when a heading no longer exists, so a renamed heading is caught.
 */

export const YEAR_STAGES = [
  {
    id: 'setup',
    at: -1,
    icon: 'fa-toolbox',
    tone: 'slate',
    when: { en: 'Before the first lesson', el: 'Πριν από το πρώτο μάθημα' },
    title: { en: 'Set the stage', el: 'Στήσε τη σκηνή' },
    lede: {
      en: 'An hour at your desk, once. The children meet a ready world on day one.',
      el: 'Μία ώρα στο γραφείο σου, μία φορά. Τα παιδιά βρίσκουν έτοιμο κόσμο από την πρώτη μέρα.'
    },
    steps: [
      {
        plan: 'starter', icon: 'fa-users',
        name: { en: 'Your classes and heroes', el: 'Τα τμήματα και οι ήρωές σου' },
        what: { en: 'Check each class, its league and its days, and that every child is on the roster.', el: 'Έλεγξε κάθε τμήμα, τη league και τις μέρες του, και ότι κάθε παιδί είναι στη λίστα.' },
        go: { chapter: 'settings', en: 'Manage Students (the roster)', el: 'Manage Students (το μαθητολόγιο)' }
      },
      {
        plan: 'pro', icon: 'fa-house-user',
        name: { en: 'Family logins', el: 'Κωδικοί για τις οικογένειες' },
        what: { en: 'Print the family handouts with the QR codes and send them home in the first week.', el: 'Τύπωσε τα φυλλάδια με τα QR και στείλ’ τα στο σπίτι την πρώτη εβδομάδα.' },
        go: { chapter: 'settings', en: 'Family Access', el: 'Family Access' }
      },
      {
        plan: 'starter', icon: 'fa-tv',
        name: { en: 'Projector Mode', el: 'Projector Mode' },
        what: { en: 'Try it once on the classroom PC: the living sky is the Quest’s waiting room while children come in.', el: 'Δοκίμασέ το μία φορά στον υπολογιστή της τάξης: ο ζωντανός ουρανός είναι η αίθουσα αναμονής του Quest όσο μπαίνουν τα παιδιά.' },
        go: { chapter: 'classroom-chrome', en: 'Projector Mode (classroom wallpaper)', el: 'Projector Mode (ταπετσαρία αίθουσας)' }
      }
    ]
  },
  {
    id: 'core',
    at: 0,
    icon: 'fa-star',
    tone: 'rose',
    when: { en: 'Weeks 1–2', el: 'Εβδομάδες 1–2' },
    title: { en: 'The core: stars and the map', el: 'Ο κορμός: αστέρια και χάρτης' },
    lede: {
      en: 'Four moves carry the first weeks. Nothing else is needed yet.',
      el: 'Τέσσερις κινήσεις κρατούν τις πρώτες εβδομάδες. Τίποτε άλλο δεν χρειάζεται ακόμα.'
    },
    steps: [
      {
        plan: 'starter', icon: 'fa-star',
        name: { en: 'Award Stars for the four virtues', el: 'Award Stars για τις τέσσερις αρετές' },
        what: { en: 'Name the action you saw, then give the star: Teamwork, Creativity, Respect, Focus.', el: 'Πες την πράξη που είδες και μετά δώσε το αστέρι: Teamwork, Creativity, Respect, Focus.' },
        go: { chapter: 'award-stars', en: 'The four reasons', el: 'Τέσσερις αρετές' }
      },
      {
        plan: 'starter', icon: 'fa-user-check',
        name: { en: 'Attendance and Welcome Back', el: 'Παρουσίες και Welcome Back' },
        what: { en: 'Tap who is away. A child who returns after an absence is welcomed back with a small bonus.', el: 'Πάτα ποιος λείπει. Ένα παιδί που επιστρέφει μετά από απουσία το υποδέχεσαι με ένα μικρό μπόνους.' },
        go: { chapter: 'award-stars', en: 'Welcome Back', el: 'Welcome Back' }
      },
      {
        plan: 'starter', icon: 'fa-route',
        name: { en: 'Show the Team Quest map', el: 'Δείξε τον χάρτη του Team Quest' },
        what: { en: 'Every star moves the class token. End the lesson by looking at how far the class walked.', el: 'Κάθε αστέρι κινεί το πιόνι της τάξης. Κλείσε το μάθημα κοιτάζοντας πόσο προχώρησε η τάξη.' },
        go: { chapter: 'team-quest', en: 'What you see', el: 'Τι βλέπεις' }
      },
      {
        plan: 'starter', icon: 'fa-user-graduate',
        name: { en: 'The Hero’s Challenge board', el: 'Ο πίνακας του Hero’s Challenge' },
        what: { en: 'Each child’s month, in the open. Talk about effort, not places.', el: 'Ο μήνας κάθε παιδιού, φανερά. Μίλα για προσπάθεια, όχι για θέσεις.' },
        go: { chapter: 'heros-challenge', en: 'What you see', el: 'Τι βλέπεις' }
      },
      {
        plan: 'pro', icon: 'fa-crown',
        name: { en: 'Crown Today’s Hero', el: 'Crown Today’s Hero' },
        what: { en: 'The last minute of every lesson: the crown, then today’s diary page (write it later if time is short).', el: 'Το τελευταίο λεπτό κάθε μαθήματος: το στέμμα και μετά η σελίδα του ημερολογίου (γράψ’ την αργότερα αν δεν προλαβαίνεις).' },
        go: { chapter: 'adventure-log', en: 'Crown Today’s Hero, then write the page', el: 'Crown Today’s Hero και μετά η σελίδα' }
      },
      {
        plan: 'elite', icon: 'fa-hammer',
        name: { en: 'Avatar Forge, with the children', el: 'Avatar Forge, μαζί με τα παιδιά' },
        what: { en: 'Forge the portraits in class: each child chooses a creature, a colour and a relic while the others watch. A few each lesson until everyone has one.', el: 'Φτιάξτε τα πορτρέτα μέσα στην τάξη: κάθε παιδί διαλέγει πλάσμα, χρώμα και αντικείμενο ενώ οι άλλοι παρακολουθούν. Λίγα σε κάθε μάθημα, ώσπου να έχουν όλοι.' },
        go: { chapter: 'settings', en: 'Avatar Forge', el: 'Avatar Forge' }
      },
      {
        plan: 'starter', icon: 'fa-dice',
        name: { en: 'Fair Picker and Team Maker', el: 'Fair Picker και Team Maker' },
        what: { en: 'Fair turns and fair teams from day one: nobody gets a second turn until everyone has had one.', el: 'Δίκαιες σειρές και δίκαιες ομάδες από την πρώτη μέρα: κανείς δεν παίρνει δεύτερη σειρά πριν πάρουν όλοι.' },
        go: { chapter: 'home', en: 'Team Maker and Fair Picker', el: 'Team Maker και Fair Picker' }
      }
    ]
  },
  {
    id: 'rhythm',
    at: 0,
    icon: 'fa-feather-pointed',
    tone: 'teal',
    when: { en: 'Weeks 3–4', el: 'Εβδομάδες 3–4' },
    title: { en: 'Your lesson rhythm', el: 'Ο ρυθμός του μαθήματός σου' },
    lede: {
      en: 'The tools you will use every week, added while the core settles. The month ends with a sealed lesson.',
      el: 'Τα εργαλεία που θα χρησιμοποιείς κάθε εβδομάδα, όσο ο κορμός κάθεται. Ο μήνας κλείνει με ένα σφραγισμένο μάθημα.'
    },
    steps: [
      {
        plan: 'starter', icon: 'fa-book-open',
        name: { en: 'Quest Assignment with the book chip', el: 'Quest Assignment με το chip του βιβλίου' },
        what: { en: 'Write the homework and confirm the book and unit. Later the Campfire and the Quiz of the Week build on it, so start early.', el: 'Γράψε την εργασία και επιβεβαίωσε βιβλίο και ενότητα. Αργότερα πάνω σε αυτό χτίζουν η Campfire και το Quiz of the Week, γι’ αυτό ξεκίνα νωρίς.' },
        go: { chapter: 'adventure-log', en: 'Quest Assignment (Class tools)', el: 'Quest Assignment (Class tools)' }
      },
      {
        plan: 'starter', icon: 'fa-pen-to-square',
        name: { en: 'Hero’s Chronicle notes', el: 'Σημειώσεις στο Hero’s Chronicle' },
        what: { en: 'One short note when something matters. Months later these notes become the Class Greenhouse and the Oracle’s reading.', el: 'Μια μικρή σημείωση όταν κάτι έχει σημασία. Σε λίγους μήνες αυτές γίνονται το Class Greenhouse και η ανάγνωση του Oracle.' },
        go: { chapter: 'settings', en: 'Hero’s Chronicle', el: 'Hero’s Chronicle' }
      },
      {
        plan: 'starter', icon: 'fa-scroll',
        name: { en: 'Quest Bounties', el: 'Quest Bounties' },
        what: { en: 'A star target against the clock for the whole class. Good for a tidy-up or a reading race.', el: 'Ένας στόχος αστεριών με χρονόμετρο για όλη την τάξη. Ιδανικό για τακτοποίηση ή αγώνα ανάγνωσης.' },
        go: { chapter: 'home', en: 'Posting a Quest Bounty', el: 'Ανέβασμα ενός Quest Bounty' }
      },
      {
        plan: 'pro', icon: 'fa-graduation-cap',
        name: { en: 'Scholar’s Scroll, with the first test', el: 'Scholar’s Scroll, με το πρώτο τεστ' },
        what: { en: 'Log marks after the first test or dictation. A high score brings Starfall, a moment the class sees.', el: 'Πέρασε τους βαθμούς μετά το πρώτο τεστ ή την πρώτη ορθογραφία. Ένας υψηλός βαθμός φέρνει Starfall, μια στιγμή που βλέπει όλη η τάξη.' },
        go: { chapter: 'scholars-scroll', en: 'Log a trial', el: 'Log a trial' }
      },
      {
        plan: 'starter', icon: 'fa-gift',
        name: { en: 'Teacher Boon in the last week', el: 'Teacher Boon την τελευταία εβδομάδα' },
        what: { en: 'Two stars, once per class, for a child the month has not noticed yet.', el: 'Δύο αστέρια, μία φορά ανά τμήμα, για ένα παιδί που ο μήνας δεν έχει προσέξει ακόμα.' },
        go: { chapter: 'award-stars', en: 'Teacher Boon', el: 'Teacher Boon' }
      },
      {
        plan: 'starter', icon: 'fa-lock',
        name: { en: 'The sealed last lesson', el: 'Το σφραγισμένο τελευταίο μάθημα' },
        what: { en: 'On the last lesson of the month the standings hide behind a seal, so the Ceremony keeps its surprise. Tell the class why.', el: 'Στο τελευταίο μάθημα του μήνα η κατάταξη κρύβεται πίσω από μια σφραγίδα, για να κρατήσει η Ceremony την έκπληξη. Πες στην τάξη γιατί.' },
        go: { chapter: 'heros-challenge', en: 'What you see', el: 'Τι βλέπεις' }
      }
    ]
  },
  {
    id: 'first-ceremony',
    at: 1,
    icon: 'fa-trophy',
    tone: 'amber',
    when: { en: 'First lesson of month 2', el: 'Πρώτο μάθημα του 2ου μήνα' },
    title: { en: 'Your first Ceremony of the Month', el: 'Η πρώτη σου Ceremony of the Month' },
    lede: {
      en: 'It arrives by itself. Read the chapter once before the lesson, and give it ten minutes with the projector on.',
      el: 'Έρχεται μόνη της. Διάβασε το κεφάλαιο μία φορά πριν το μάθημα και δώσ’ της δέκα λεπτά με τον projector ανοιχτό.'
    },
    steps: [
      {
        plan: 'starter', icon: 'fa-trophy',
        name: { en: 'Ceremony of the Month', el: 'Ceremony of the Month' },
        what: { en: 'The class’s place in its league, then the Prodigy of the Month. Younger classes get the Growth Festival garden, with no ranks.', el: 'Η θέση της τάξης στη league της και μετά το Prodigy of the Month. Τα μικρά τμήματα έχουν τον κήπο του Growth Festival, χωρίς κατατάξεις.' },
        go: { chapter: 'ceremony', en: 'What you do (teacher)', el: 'Τι κάνεις (δάσκαλος)' }
      }
    ]
  },
  {
    id: 'spend',
    at: 1,
    icon: 'fa-store',
    tone: 'lime',
    when: { en: 'Month 2', el: '2ος μήνας' },
    title: { en: 'Gold to spend, a house to join', el: 'Gold για ψώνια, ένα σπίτι για να ανήκουν' },
    lede: {
      en: 'The children have been saving Gold for a month: now they learn to choose. The guild race runs all year, so sort the houses early and every month counts.',
      el: 'Τα παιδιά μαζεύουν Gold εδώ και έναν μήνα: τώρα μαθαίνουν να διαλέγουν. Ο αγώνας των guilds κρατά όλη τη χρονιά, οπότε μοίρασε νωρίς τα σπίτια και κάθε μήνας μετράει.'
    },
    steps: [
      {
        plan: 'starter', icon: 'fa-gem',
        name: { en: 'Mystic Market: the five relics', el: 'Mystic Market: τα πέντε relics' },
        what: { en: 'Open the Market on the projector for the first shop. Read prices aloud; two legendary buys per child a month.', el: 'Άνοιξε το Market στον projector για το πρώτο ψώνισμα. Διάβασε τις τιμές δυνατά· δύο αγορές legendary ανά παιδί τον μήνα.' },
        go: { chapter: 'market', en: 'Legendary Artifacts (power-ups)', el: 'Legendary Artifacts (power-ups)' }
      },
      {
        plan: 'starter', icon: 'fa-box-open',
        name: { en: 'Trophy Room', el: 'Trophy Room' },
        what: { en: 'Where relics are used and treasures are kept. Show it the first time someone buys.', el: 'Εκεί χρησιμοποιούνται τα relics και φυλάγονται οι θησαυροί. Δείξ’ το την πρώτη φορά που κάποιος αγοράζει.' },
        go: { chapter: 'heros-challenge', en: 'Trophy Room', el: 'Trophy Room' }
      },
      {
        plan: 'starter', icon: 'fa-heart',
        name: { en: 'Hero’s Boon', el: 'Hero’s Boon' },
        what: { en: 'A child spends Gold to lift a classmate who is behind this month. Generosity becomes visible.', el: 'Ένα παιδί ξοδεύει Gold για να ανεβάσει έναν συμμαθητή που μένει πίσω αυτόν τον μήνα. Η γενναιοδωρία γίνεται ορατή.' },
        go: { chapter: 'award-stars', en: 'Hero’s Boon (peer gift)', el: 'Hero’s Boon (peer gift)' }
      },
      {
        plan: 'pro', icon: 'fa-hat-wizard',
        name: { en: 'The Sorting Ceremony', el: 'Η Sorting Ceremony' },
        what: { en: 'A short quiz places each child in one of the four guilds. Make it an event: one lesson, the whole class watching.', el: 'Ένα μικρό quiz βάζει κάθε παιδί σε ένα από τα τέσσερα guilds. Κάν’ το γεγονός: ένα μάθημα, όλη η τάξη να παρακολουθεί.' },
        go: { chapter: 'guild-hall', en: 'Guild Placement Quiz', el: 'Τοποθέτηση — Guild Placement Quiz' }
      },
      {
        plan: 'pro', icon: 'fa-shield-halved',
        name: { en: 'Guild Hall and the Crown Race', el: 'Guild Hall και Crown Race' },
        what: { en: 'From then on every star also feeds a house, with nothing extra for you to do. Each month is a Chapter that wins Crowns; the Crowns are counted in June.', el: 'Από εκεί και πέρα κάθε αστέρι τροφοδοτεί και ένα σπίτι, χωρίς να κάνεις τίποτα παραπάνω. Κάθε μήνας είναι ένα Chapter που κερδίζει Crowns· τα Crowns μετρούν τον Ιούνιο.' },
        go: { chapter: 'guild-hall', en: 'Glory and the Crown Race', el: 'Glory και Crown Race' }
      }
    ]
  },
  {
    id: 'belong',
    at: 2,
    icon: 'fa-dharmachakra',
    tone: 'guild',
    when: { en: 'Month 3', el: '3ος μήνας' },
    title: { en: 'Rituals, paths and promises', el: 'Τελετουργικά, δρόμοι και υποσχέσεις' },
    lede: {
      en: 'The houses are settled. Now give them a weekly ritual, and give each child a path and a small promise of their own.',
      el: 'Τα σπίτια έχουν στρώσει. Τώρα δώσ’ τους ένα εβδομαδιαίο τελετουργικό, και σε κάθε παιδί έναν δικό του δρόμο και μια μικρή υπόσχεση.'
    },
    steps: [
      {
        plan: 'pro', icon: 'fa-dharmachakra',
        name: { en: 'Fortune’s Wheel, every week', el: 'Fortune’s Wheel, κάθε εβδομάδα' },
        what: { en: 'On the last lesson of the week each guild takes its turn on the wheel.', el: 'Στο τελευταίο μάθημα της εβδομάδας κάθε guild γυρίζει τη ρόδα με τη σειρά του.' },
        go: { chapter: 'guild-hall', en: 'Fortune’s Wheel', el: 'Fortune’s Wheel' }
      },
      {
        plan: 'pro', icon: 'fa-hat-wizard',
        name: { en: 'Hero Path and the Hero Class', el: 'Hero Path και Hero Class' },
        what: { en: 'Each child swears a path that matches who they are. Levels open Skill Tree choices.', el: 'Κάθε παιδί ορκίζεται σε έναν δρόμο που του ταιριάζει. Τα επίπεδα ανοίγουν επιλογές στο Skill Tree.' },
        go: { chapter: 'hero-path', en: 'How you assign a class', el: 'Πώς ορίζεις τάξη' }
      },
      {
        plan: 'pro', icon: 'fa-fire',
        name: { en: 'Hero Campfire and Ember Oaths', el: 'Hero Campfire και Ember Oaths' },
        what: { en: 'A two-minute closing by the fire, with the words the class practised. Each child chooses one small promise.', el: 'Ένα κλείσιμο δύο λεπτών δίπλα στη φωτιά, με τις λέξεις που εξασκήθηκαν. Κάθε παιδί διαλέγει μια μικρή υπόσχεση.' },
        go: { chapter: 'hero-campfire', en: 'Ember Oaths', el: 'Ember Oaths' }
      },
      {
        plan: 'pro', icon: 'fa-calendar-days',
        name: { en: 'Quest Events and Day Treasures', el: 'Quest Events και Day Treasures' },
        what: { en: 'Plan a 2× Star Day, a Special Quest or a treasure chest for a special day in the Day Planner.', el: 'Σχεδίασε ένα 2× Star Day, ένα Special Quest ή ένα σεντούκι για μια ξεχωριστή μέρα στο Day Planner.' },
        go: { chapter: 'quest-calendar', en: 'Quest Event', el: 'Quest Event' }
      },
      {
        plan: 'starter', icon: 'fa-khanda',
        name: { en: 'Hero Duels, as a treat', el: 'Hero Duels, ως κέρασμα' },
        what: { en: 'A short projector game for the end of a good lesson. You give the points.', el: 'Ένα σύντομο παιχνίδι στον projector για το τέλος ενός καλού μαθήματος. Εσύ δίνεις τους πόντους.' },
        go: { chapter: 'home', en: 'Hero Duels', el: 'Hero Duels' }
      }
    ]
  },
  {
    id: 'weekly',
    at: 3,
    icon: 'fa-circle-question',
    tone: 'blue',
    when: { en: 'Month 4', el: '4ος μήνας' },
    title: { en: 'Weekly rituals', el: 'Εβδομαδιαία τελετουργικά' },
    lede: {
      en: 'One ritual to open the week, one to close it. The class starts to expect them.',
      el: 'Ένα τελετουργικό ανοίγει την εβδομάδα κι ένα την κλείνει. Η τάξη αρχίζει να τα περιμένει.'
    },
    steps: [
      {
        plan: 'elite', icon: 'fa-circle-question',
        name: { en: 'Quiz of the Week', el: 'Quiz of the Week' },
        what: { en: 'On the first lesson of the week, a short quiz built from the pages you set as homework.', el: 'Στο πρώτο μάθημα της εβδομάδας, ένα σύντομο quiz από τις σελίδες που έβαλες για εργασία.' },
        go: { chapter: 'home', en: 'Quiz of the Week (Elite)', el: 'Quiz of the Week (Elite)' }
      },
      {
        plan: 'elite', icon: 'fa-leaf',
        name: { en: 'Seasonal treasures and Charms', el: 'Εποχιακοί θησαυροί και Charms' },
        what: { en: 'A new stall every month. Treasures collected in sets wake small classroom privileges.', el: 'Νέος πάγκος κάθε μήνα. Οι θησαυροί που μαζεύονται σε σετ ξυπνούν μικρά προνόμια μέσα στην τάξη.' },
        go: { chapter: 'market', en: 'What treasures do: Charms', el: 'Τι κάνουν οι θησαυροί: Charms' }
      },
      {
        plan: 'elite', icon: 'fa-chart-column',
        name: { en: 'The Weekly Report', el: 'Η Weekly Report' },
        what: { en: 'Ten minutes on Friday: what the week looked like, who was not seen, what to try next.', el: 'Δέκα λεπτά την Παρασκευή: πώς ήταν η εβδομάδα, ποιον δεν είδες, τι να δοκιμάσεις μετά.' },
        go: { chapter: 'settings', en: 'Weekly report (Elite)', el: null }
      }
    ]
  },
  {
    id: 'companions',
    at: 4,
    icon: 'fa-egg',
    tone: 'violet',
    when: { en: 'Month 5', el: '5ος μήνας' },
    title: { en: 'Companions and a closer look', el: 'Σύντροφοι και μια πιο προσεκτική ματιά' },
    lede: {
      en: 'The economy is familiar and your notes have grown. Time for companions, and for reading the class.',
      el: 'Η οικονομία είναι πια οικεία και οι σημειώσεις σου έχουν πληθύνει. Ώρα για συντρόφους και για να «διαβάσεις» την τάξη.'
    },
    steps: [
      {
        plan: 'elite', icon: 'fa-egg',
        name: { en: 'Familiars', el: 'Familiars' },
        what: { en: 'Eggs in the Market. A Familiar hatches with the child’s stars and grows through five forms.', el: 'Αυγά στο Market. Ένα Familiar εκκολάπτεται με τα αστέρια του παιδιού και περνά από πέντε μορφές.' },
        go: { chapter: 'market', en: 'Familiars (Elite)', el: 'Familiars (Elite)' }
      },
      {
        plan: 'starter', icon: 'fa-dragon',
        name: { en: 'The Quiet Dragon', el: 'Ο Quiet Dragon' },
        what: { en: 'A noise meter that sleeps while the room works quietly. Nothing is recorded.', el: 'Ένας μετρητής θορύβου που κοιμάται όσο η τάξη δουλεύει ήσυχα. Τίποτα δεν ηχογραφείται.' },
        go: { chapter: 'classroom-chrome', en: 'The Quiet Dragon (noise meter)', el: 'Ο Ήσυχος Δράκος (Quiet Dragon, μετρητής θορύβου)' }
      },
      {
        plan: 'starter', icon: 'fa-seedling',
        name: { en: 'The Class Greenhouse', el: 'Το Class Greenhouse' },
        what: { en: 'Your Chronicle notes, read as a map of the class: who needs you first, and one plan for next lesson.', el: 'Οι σημειώσεις του Chronicle ως χάρτης της τάξης: ποιος σε χρειάζεται πρώτος και ένα σχέδιο για το επόμενο μάθημα.' },
        go: { chapter: 'settings', en: 'Class Greenhouse', el: 'Class Greenhouse' }
      },
      {
        plan: 'starter', icon: 'fa-stamp',
        name: { en: 'Open the Seal Book', el: 'Άνοιξε το Seal Book' },
        what: { en: 'Seals have been pressing quietly since the first lesson. Show each child their own book.', el: 'Οι σφραγίδες πατιούνται αθόρυβα από το πρώτο μάθημα. Δείξε σε κάθε παιδί το δικό του βιβλίο.' },
        go: { chapter: 'heros-challenge', en: 'Hero Seals', el: 'Hero Seals' }
      }
    ]
  },
  {
    id: 'training',
    at: 5,
    icon: 'fa-bullseye',
    tone: 'indigo',
    when: { en: 'Month 6', el: '6ος μήνας' },
    title: { en: 'The Training Grounds', el: 'Τα Training Grounds' },
    lede: {
      en: 'Four class games, one for each virtue. Start with one, add the next when it runs smoothly.',
      el: 'Τέσσερα παιχνίδια τάξης, ένα για κάθε αρετή. Ξεκίνα με ένα και πρόσθεσε το επόμενο όταν κυλά.'
    },
    steps: [
      {
        plan: 'elite', icon: 'fa-feather-pointed',
        name: { en: 'Story Weavers', el: 'Story Weavers' },
        what: { en: 'The class writes a story together, a sentence at a time, around the Word of the Day.', el: 'Η τάξη γράφει μαζί μια ιστορία, πρόταση πρόταση, γύρω από τη Λέξη της Ημέρας.' },
        go: { chapter: 'story-weavers', en: 'Story Weavers (Creativity)', el: 'Story Weavers (Creativity)' }
      },
      {
        plan: 'elite', icon: 'fa-gem',
        name: { en: 'The Vanishing Hoard, the Torn Map, the Round Table', el: 'The Vanishing Hoard, The Torn Map, The Round Table' },
        what: { en: 'Memory, reasoning and talking games in English. Every second won round is a star moment for the class.', el: 'Παιχνίδια μνήμης, σκέψης και συζήτησης στα αγγλικά. Κάθε δεύτερος κερδισμένος γύρος είναι στιγμή αστεριών για την τάξη.' },
        go: { chapter: 'story-weavers', en: 'In class', el: 'Στην τάξη' }
      }
    ]
  },
  {
    id: 'wand',
    at: 6,
    icon: 'fa-wand-magic-sparkles',
    tone: 'purple',
    when: { en: 'Month 7', el: '7ος μήνας' },
    title: { en: 'Your phone as a wand', el: 'Το κινητό σου ως ραβδί' },
    lede: {
      en: 'You know every screen now, so run them from anywhere in the room. Comfortable teachers can start this earlier.',
      el: 'Ξέρεις πια κάθε οθόνη, οπότε τρέξ’ τις από οπουδήποτε στην αίθουσα. Όποιος νιώθει άνετα μπορεί να ξεκινήσει νωρίτερα.'
    },
    steps: [
      {
        plan: 'pro', icon: 'fa-wand-magic-sparkles',
        name: { en: 'Quest Remote', el: 'Quest Remote' },
        what: { en: 'Scan the circle with your phone and award stars, spin the wheel or switch screens while you walk the room.', el: 'Σκάναρε τον κύκλο με το κινητό και δώσε αστέρια, γύρνα τη ρόδα ή άλλαξε οθόνη ενώ περπατάς στην τάξη.' },
        go: { chapter: 'quest-remote', en: 'Waking the Wand', el: 'Ξυπνώντας το Ραβδί' }
      },
      {
        plan: 'pro', icon: 'fa-ranking-star',
        name: { en: 'Showdown Arena', el: 'Showdown Arena' },
        what: { en: 'Team games on the projector, run from your phone.', el: 'Ομαδικά παιχνίδια στον projector, που τα τρέχεις από το κινητό.' },
        go: { chapter: 'quest-remote', en: 'Showdown Arena', el: 'Showdown Arena' }
      }
    ]
  },
  {
    id: 'finale',
    at: 7,
    icon: 'fa-flag-checkered',
    tone: 'amber',
    when: { en: 'To the end of the year', el: 'Ως το τέλος της χρονιάς' },
    title: { en: 'Deepen, and close the year well', el: 'Εμβάθυνε και κλείσε όμορφα τη χρονιά' },
    lede: {
      en: 'Nothing new to learn. Keep the rhythm, use what works for your class, and prepare a good ending.',
      el: 'Τίποτα καινούργιο να μάθεις. Κράτα τον ρυθμό, χρησιμοποίησε ό,τι δουλεύει για την τάξη σου και ετοίμασε ένα ωραίο τέλος.'
    },
    steps: [
      {
        plan: 'pro', icon: 'fa-crown',
        name: { en: 'Legend Quests', el: 'Legend Quests' },
        what: { en: 'When a child finishes a Hero Path, a last personal challenge opens at the top of it.', el: 'Όταν ένα παιδί ολοκληρώσει ένα Hero Path, ανοίγει στην κορυφή του μια τελευταία προσωπική πρόκληση.' },
        go: { chapter: 'hero-path', en: '👑 The Legend Quest — the capstone', el: '👑 Το Legend Quest — η κορυφή' }
      },
      {
        plan: 'pro', icon: 'fa-shield-halved',
        name: { en: 'Grand Guild Ceremony', el: 'Grand Guild Ceremony' },
        what: { en: 'In June one guild is crowned for the year. Plan a full lesson for it.', el: 'Τον Ιούνιο ένα guild στέφεται για όλη τη χρονιά. Κράτα ένα ολόκληρο μάθημα γι’ αυτήν.' },
        go: { chapter: 'guild-hall', en: 'Grand Guild Ceremony', el: 'Grand Guild Ceremony' }
      },
      {
        plan: 'starter', icon: 'fa-certificate',
        name: { en: 'Certificates', el: 'Πιστοποιητικά' },
        what: { en: 'Print a Legend’s Journey certificate for each child before the last lesson.', el: 'Τύπωσε ένα πιστοποιητικό Legend’s Journey για κάθε παιδί πριν το τελευταίο μάθημα.' },
        go: { chapter: 'heros-challenge', en: 'Certificates', el: 'Certificates' }
      }
    ]
  }
];

/**
 * Things that arrive by themselves on fixed dates. `months` are calendar months (9 = September … 6 = June)
 * where the moment can fall; `plan` as above.
 */
export const YEAR_MOMENTS = [
  {
    id: 'ceremony', months: [10, 11, 12, 1, 2, 3, 4, 5, 6], plan: 'starter', icon: 'fa-trophy',
    name: { en: 'Ceremony of the Month', el: 'Ceremony of the Month' },
    when: { en: 'Early every month, for the month before (the first is in October)', el: 'Στην αρχή κάθε μήνα, για τον προηγούμενο (η πρώτη τον Οκτώβριο)' },
    go: { chapter: 'ceremony', en: 'When it appears', el: 'Πότε εμφανίζεται' }
  },
  {
    id: 'halloween', months: [10], plan: 'elite', icon: 'fa-ghost',
    name: { en: 'Halloween Festival Stall', el: 'Festival Stall του Halloween' },
    when: { en: 'Late October', el: 'Τέλη Οκτωβρίου' },
    go: { chapter: 'market', en: 'Festival Stall (Elite)', el: 'Festival Stall (Elite)' }
  },
  {
    id: 'winter-raid', months: [12], plan: 'starter', icon: 'fa-snowflake',
    name: { en: 'The Winter Raid', el: 'The Winter Raid' },
    when: { en: 'The week before the Christmas break', el: 'Την εβδομάδα πριν τις διακοπές των Χριστουγέννων' },
    go: { chapter: 'team-quest', en: 'Realm Raid: the whole school on one side', el: 'Realm Raid: όλο το σχολείο στην ίδια πλευρά' }
  },
  {
    id: 'christmas', months: [12, 1], plan: 'elite', icon: 'fa-gifts',
    name: { en: 'Christmas and New Year stalls', el: 'Πάγκοι Χριστουγέννων και Πρωτοχρονιάς' },
    when: { en: 'December and early January', el: 'Δεκέμβριος και αρχές Ιανουαρίου' },
    go: { chapter: 'market', en: 'Festival Stall (Elite)', el: 'Festival Stall (Elite)' }
  },
  {
    id: 'carnival', months: [2, 3], plan: 'starter', icon: 'fa-masks-theater',
    name: { en: 'The Carnival Raid and stall', el: 'The Carnival Raid και ο πάγκος του' },
    when: { en: 'The week before Clean Monday (the stall is Elite)', el: 'Την εβδομάδα πριν την Καθαρά Δευτέρα (ο πάγκος είναι Elite)' },
    go: { chapter: 'team-quest', en: 'Realm Raid: the whole school on one side', el: 'Realm Raid: όλο το σχολείο στην ίδια πλευρά' }
  },
  {
    id: 'easter', months: [4, 5], plan: 'elite', icon: 'fa-egg',
    name: { en: 'Easter and May Day stalls', el: 'Πάγκοι Πάσχα και Πρωτομαγιάς' },
    when: { en: 'Before the Easter break, and around 1 May', el: 'Πριν τις διακοπές του Πάσχα και γύρω από την Πρωτομαγιά' },
    go: { chapter: 'market', en: 'Festival Stall (Elite)', el: 'Festival Stall (Elite)' }
  },
  {
    id: 'summer-raid', months: [6], plan: 'starter', icon: 'fa-sun',
    name: { en: 'The Summer Raid', el: 'The Summer Raid' },
    when: { en: 'The last school week', el: 'Την τελευταία εβδομάδα της χρονιάς' },
    go: { chapter: 'team-quest', en: 'Realm Raid: the whole school on one side', el: 'Realm Raid: όλο το σχολείο στην ίδια πλευρά' }
  },
  {
    id: 'grand', months: [6], plan: 'pro', icon: 'fa-crown',
    name: { en: 'Grand Guild Ceremony', el: 'Grand Guild Ceremony' },
    when: { en: 'June', el: 'Ιούνιος' },
    go: { chapter: 'guild-hall', en: 'Grand Guild Ceremony', el: 'Grand Guild Ceremony' }
  }
];

/** Moments that come when the class gets there, whatever the month. */
export const YEAR_TRIGGERS = [
  {
    plan: 'starter', icon: 'fa-dungeon',
    name: { en: 'A class reaches its monthly goal', el: 'Ένα τμήμα φτάνει τον μηνιαίο στόχο' },
    what: { en: 'The Crystal Portal opens and the class steps through.', el: 'Ανοίγει η Crystal Portal και η τάξη περνά μέσα.' },
    go: { chapter: 'team-quest', en: 'Stepping through', el: 'Το πέρασμα' }
  },
  {
    plan: 'starter', icon: 'fa-shield-halved',
    name: { en: 'A class climbs the Quest ranks', el: 'Ένα τμήμα ανεβαίνει στα Quest ranks' },
    what: { en: 'Higher ranks ask for Portal runes, and from Level 4 the Guardian’s riddles.', el: 'Τα ψηλότερα ranks ζητούν ρούνους της Πύλης και από το Level 4 τους γρίφους του Φύλακα.' },
    go: { chapter: 'team-quest', en: 'Quest ranks and Portal runes', el: 'Βαθμίδες (ranks) και ρούνοι της Πύλης' }
  },
  {
    plan: 'pro', icon: 'fa-angles-up',
    name: { en: 'A child levels up on their Hero Path', el: 'Ένα παιδί ανεβαίνει επίπεδο στο Hero Path' },
    what: { en: 'The LEVEL UP! moment, then a choice on the Skill Tree.', el: 'Η στιγμή LEVEL UP! και μετά μια επιλογή στο Skill Tree.' },
    go: { chapter: 'hero-path', en: 'How skills work — the Skill Tree on screen', el: 'Το Skill Tree στην οθόνη' }
  },
  {
    plan: 'elite', icon: 'fa-egg',
    name: { en: 'A Familiar is ready to change', el: 'Ένα Familiar είναι έτοιμο να αλλάξει' },
    what: { en: 'A card offers the Evolution Moment. Play it for the class.', el: 'Μια κάρτα προσφέρει το Evolution Moment. Παίξ’ το για την τάξη.' },
    go: { chapter: 'market', en: 'Familiars (Elite)', el: 'Familiars (Elite)' }
  },
  {
    plan: 'pro', icon: 'fa-fire',
    name: { en: 'A promise is ready to keep', el: 'Μια υπόσχεση είναι έτοιμη να τηρηθεί' },
    what: { en: 'Keep it at the Campfire. It lights a step on the child’s Star Path.', el: 'Κράτησέ τη στη Campfire. Ανάβει ένα βήμα στο Star Path του παιδιού.' },
    go: { chapter: 'hero-campfire', en: 'Ember Oaths', el: 'Ember Oaths' }
  }
];

export const YEAR_PLAN_ORDER = ['starter', 'pro', 'elite'];
