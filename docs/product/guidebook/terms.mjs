/** Clickable guidebook terms, search aliases, and live-chrome widgets. */

export const TERMS = [
  {
    id: 'award-stars',
    chapter: 'award-stars',
    widget: 'virtues',
    names: { en: 'Award Stars', el: 'Award Stars' },
    aliases: ['award stars', 'stars tab', 'virtue stars'],
    def: {
      en: 'The lesson tab of floating clouds. You award 1, 2, or 3 stars for Teamwork, Creativity, Respect, or Focus. This is the heart of the Quest.',
      el: 'Η καρτέλα του μαθήματος με τα σύννεφα. Δίνεις 1, 2 ή 3 αστέρια για Teamwork, Creativity, Respect ή Focus. Είναι η καρδιά του Quest.'
    },
    confuse: { en: "Scholar's Scroll (tests), Story Weavers (writing stars)", el: "Scholar's Scroll (διαγωνίσματα), Story Weavers (αστέρια γραφής)" }
  },
  {
    id: 'team-quest',
    chapter: 'team-quest',
    widget: 'map',
    names: { en: 'Team Quest', el: 'Team Quest' },
    aliases: ['team quest', 'league map', 'class race', 'map race'],
    def: {
      en: 'Class versus class this month, inside the same Quest League, on the parchment map. Progress is monthly stars toward a fair goal — not a lonely high-scorer.',
      el: 'Τμήμα εναντίον τμήματος αυτόν τον μήνα, μέσα στην ίδια Quest League, στον χάρτη. Η πρόοδος είναι τα μηνιαία αστέρια προς έναν δίκαιο στόχο.'
    },
    confuse: { en: 'Guild Hall (year-long houses)', el: 'Guild Hall (σπίτια όλης της χρονιάς)' }
  },
  {
    id: 'heros-challenge',
    chapter: 'heros-challenge',
    widget: 'nav',
    nav: 'purple',
    names: { en: "Hero's Challenge", el: "Hero's Challenge" },
    aliases: ["hero's challenge", 'heros challenge', 'hero challenge', 'student race'],
    def: {
      en: 'Student versus student ranks this month. The monthly crown here is Prodigy of the Month, archived in the Hall of Prodigies.',
      el: 'Μαθητής εναντίον μαθητή αυτόν τον μήνα. Το μηνιαίο στέμμα είναι ο Prodigy of the Month, στο Hall of Prodigies.'
    },
    confuse: { en: 'Guild ranking, Hero of the Day', el: 'Κατάταξη σπιτιών, Hero of the Day' }
  },
  {
    id: 'ceremony-of-the-month',
    chapter: 'ceremony',
    widget: 'ceremony',
    names: { en: 'Ceremony of the Month', el: 'Ceremony of the Month' },
    aliases: ['ceremony of the month', 'monthly ceremony', 'monthly ritual', 'dual ceremony'],
    def: {
      en: 'The monthly ceremony chooses its gentle or competitive style automatically: Nursery and Pre-Junior use Growth Festival (Enter the Garden); every other valid league uses Classic Arena (Start Ceremony). Then move through it with the labelled next button. Run it once per class per month.',
      el: 'Η μηνιαία τελετή διαλέγει μόνη της το ήρεμο ή το ανταγωνιστικό της ύφος: Nursery και Pre-Junior χρησιμοποιούν Growth Festival (Enter the Garden)· οι υπόλοιπες έγκυρες leagues Classic Arena (Start Ceremony). Μετά προχώρα με το επώνυμο επόμενο κουμπί. Μία φορά ανά τμήμα τον μήνα.'
    },
    confuse: { en: 'Grand Guild Ceremony (June, houses), Hero of the Day (each logged lesson)', el: 'Grand Guild Ceremony (Ιούνιος, σπίτια), Hero of the Day (κάθε καταγεγραμμένο μάθημα)' }
  },
  {
    id: 'classic-arena',
    chapter: 'ceremony',
    widget: 'classic-arena',
    names: { en: 'Classic Arena', el: 'Classic Arena' },
    aliases: ['classic arena'],
    def: {
      en: 'The automatic Ceremony of the Month for every valid league except Nursery and Pre-Junior: Team Quest class ranks, a League Duel, then Hero’s Challenge and Prodigy of the Month.',
      el: 'Η αυτόματη Ceremony of the Month για κάθε έγκυρη league εκτός Nursery και Pre-Junior: κατάταξη τάξεων στο Team Quest, League Duel, μετά Hero’s Challenge και Prodigy of the Month.'
    },
    confuse: { en: 'Growth Festival, Grand Guild Ceremony', el: 'Growth Festival, Grand Guild Ceremony' }
  },
  {
    id: 'great-guild-ceremony',
    chapter: 'guild-hall',
    widget: 'houses',
    names: { en: 'Grand Guild Ceremony', el: 'Grand Guild Ceremony' },
    aliases: ['great guild ceremony', 'grand guild ceremony', 'guild ceremony', 'year-end ceremony', 'june ceremony'],
    def: {
      en: 'The June, end-of-year crowning of houses in Guild Hall. It looks back at the year: Guild Power, prodigies, and Heroes of the Day. It is not the monthly dual ceremony.',
      el: 'Η Ιουνιατική, τέλος-χρονιάς στέψη των σπιτιών στο Guild Hall. Κοιτά όλη τη χρονιά. Δεν είναι η μηνιαία διπλή τελετή.'
    },
    confuse: { en: 'Ceremony of the Month', el: 'Ceremony of the Month' }
  },
  {
    id: 'prodigy',
    chapter: 'ceremony',
    widget: 'ceremony-hero',
    names: { en: 'Prodigy of the Month', el: 'Prodigy of the Month' },
    aliases: ['prodigy of the month', 'prodigy', 'monthly crown', 'reigning prodigy'],
    def: {
      en: 'The monthly student winner in that class. Classic Arena reveals the crown after its student duel; Growth Festival reveals the same child as Golden Bloom without showing scores or ranks.',
      el: 'Ο μηνιαίος νικητής μαθητής του τμήματος. Το Classic Arena αποκαλύπτει το στέμμα μετά το student duel· το Growth Festival παρουσιάζει το ίδιο παιδί ως Golden Bloom χωρίς σκορ ή θέσεις.'
    },
    confuse: { en: 'Hero of the Day (daily), Guild Champion (inside one house)', el: 'Hero of the Day (ημερήσιος), Guild Champion (μέσα σε ένα σπίτι)' }
  },
  {
    id: 'co-prodigy',
    chapter: 'ceremony',
    widget: 'none',
    names: { en: 'Co-Prodigy', el: 'Co-Prodigy' },
    aliases: ['co-prodigy', 'coprodigy', 'shared prodigy'],
    def: {
      en: 'A shared monthly crown when stars and the 3-star / 2-star / unique-reason picture truly match. Name both children out loud.',
      el: 'Κοινό μηνιαίο στέμμα όταν τα αστέρια και η εικόνα 3-άστρων / 2-άστρων / διαφορετικών λόγων ταιριάζουν αληθινά.'
    },
    confuse: { en: 'Two Heroes of the Day', el: 'Δύο Hero of the Day' }
  },
  {
    id: 'hall-of-prodigies',
    chapter: 'heros-challenge',
    widget: 'hall-of-prodigies',
    names: { en: 'Hall of Prodigies', el: 'Hall of Prodigies' },
    aliases: ['hall of prodigies', 'prodigy hall', 'prodigies hall'],
    def: {
      en: 'This school year’s archive of monthly Prodigies (and Co-Prodigies). The × count is this year only. Last year’s plaques stay last year.',
      el: 'Το αρχείο των μηνιαίων Prodigy αυτής της σχολικής χρονιάς. Το × μετράει μόνο φέτος. Οι περσινές πλάκες μένουν πέρσι.'
    },
    confuse: { en: 'Hall of Heroes', el: 'Hall of Heroes' }
  },
  {
    id: 'hero-of-the-day',
    chapter: 'adventure-log',
    widget: 'hero-day',
    names: { en: 'Hero of the Day', el: 'Hero of the Day' },
    aliases: ['hero of the day', 'daily hero', 'reigning hero'],
    def: {
      en: 'Crowned automatically when you Log Today’s Adventure. You do not pick the name by hand. Their first award the next day includes an automatic +1 (“Includes Hero’s Boon”). Shop discounts stack with Hall of Heroes wins.',
      el: 'Στέφεται αυτόματα όταν καταγράφεις το Today’s Adventure. Δεν διαλέγεις το όνομα στο χέρι. Το πρώτο βραβείο την επόμενη μέρα περιλαμβάνει αυτόματο +1.'
    },
    confuse: { en: 'Prodigy of the Month', el: 'Prodigy of the Month' }
  },
  {
    id: 'hall-of-heroes',
    chapter: 'adventure-log',
    widget: 'hall-of-heroes',
    names: { en: 'Hall of Heroes', el: 'Hall of Heroes' },
    aliases: ['hall of heroes', 'heroes hall', 'hero hall'],
    def: {
      en: 'The archive of this school year’s Hero of the Day wins. Shop legend discounts unlock at 3 / 5 / 10 wins this year. Last year’s crowns stay in last year’s hall.',
      el: 'Το αρχείο των νικών Hero of the Day αυτής της σχολικής χρονιάς. Εκπτώσεις στο μαγαζί στα 3 / 5 / 10 wins φέτος. Οι περσινοί στέφανοι μένουν στην περσινή αίθουσα.'
    },
    confuse: { en: 'Hall of Prodigies', el: 'Hall of Prodigies' }
  },
  {
    id: 'heros-boon',
    chapter: 'award-stars',
    widget: 'hero-boon',
    names: { en: "Hero's Boon", el: "Hero's Boon" },
    aliases: ["hero's boon", 'heros boon', 'hero boon', 'peer boon', 'heart button', 'bestow'],
    def: {
      en: 'The heart on a student cloud. A classmate spends 15 Gold to give +0.5 stars (free with Compassion Token). Max 4 per class per day. Receiver must be in the bottom 3 monthly stars or a tie group. No self; not the same classmate twice in a row. Grey broken hearts mean not eligible.',
      el: 'Η καρδιά στο σύννεφο. Ένας συμμαθητής ξοδεύει 15 Gold για +0,5 αστέρια (δωρεάν με Compassion Token). Μέχρι 4 ανά τμήμα ανά μέρα. Ο δέκτης στα 3 χαμηλότερα μηνιαία αστέρια ή σε ισοπαλία. Όχι στον εαυτό· όχι δύο φορές στον ίδιο στη σειρά.'
    },
    confuse: { en: 'Teacher Boon; the automatic +1 on the reigning Hero of the Day’s first award', el: 'Teacher Boon· το αυτόματο +1 στον reigning Hero of the Day' }
  },
  {
    id: 'includes-heros-boon',
    chapter: 'adventure-log',
    widget: 'none',
    names: { en: "Includes Hero's Boon", el: "Includes Hero's Boon" },
    aliases: ["includes hero's boon", 'includes heros boon', '+1 bonus star'],
    def: {
      en: 'Automatic extra star on the reigning Hero of the Day’s first award of the lesson. Not the 15 Gold peer gift.',
      el: 'Αυτόματο έξτρα αστέρι στο πρώτο βραβείο του reigning Hero of the Day. Δεν είναι το δώρο των 15 Gold.'
    },
    confuse: { en: "Hero's Boon (peer heart)", el: "Hero's Boon (καρδιά συμμαθητή)" }
  },
  {
    id: 'teacher-boon',
    chapter: 'award-stars',
    widget: 'teacher-boon',
    names: { en: 'Teacher Boon', el: 'Teacher Boon' },
    aliases: ['teacher boon', "teacher's boon", 'teachers boon', 'wand button'],
    def: {
      en: 'Your gift: 2 stars, once per class per month, only in the last 7 days of the month (from six days before month-end). Named reasons (Leadership, Perseverance, Kindness, Bravery, Helping Others, Remarkable Growth, or your own words). Shows as a ribbon in the Ceremony of the Month. Honour, not a hidden extra rank.',
      el: 'Το δικό σου δώρο: 2 αστέρια, μία φορά ανά τμήμα ανά μήνα, μόνο τις τελευταίες 7 μέρες του μήνα. Φαίνεται ως κορδέλα στην Ceremony of the Month — τιμή, όχι κρυφή θέση.'
    },
    confuse: { en: "Hero's Boon (peer gift)", el: "Hero's Boon (δώρο συμμαθητή)" }
  },
  {
    id: 'welcome-back',
    chapter: 'award-stars',
    widget: 'absence',
    names: { en: 'Welcome Back', el: 'Welcome Back' },
    aliases: ['welcome back', 'welcome-back', 'return bonus'],
    def: {
      en: 'Return bonus after absence. Stars scale with missed lessons (0.5 up to 2.0). Does not lock the cloud — you can still award a virtue the same day.',
      el: 'Μπόνους επιστροφής μετά από απουσία. Τα αστέρια κλιμακώνονται (0,5 έως 2,0). Δεν κλειδώνει το σύννεφο.'
    },
    confuse: { en: 'Nomad path (levels from Welcome Back stars)', el: 'Μονοπάτι Nomad (ανεβαίνει από αυτά τα αστέρια)' }
  },
  {
    id: 'guild-power',
    chapter: 'guild-hall',
    widget: 'guild-power',
    names: { en: 'Guild Power', el: 'Guild Power' },
    aliases: ['guild power', 'house score', 'fair house score'],
    def: {
      en: 'The fair house score Guild Hall ranks by — not raw Total Stars. Mix: 70% season Glory per member, 15% this week’s Glory per member, 10% activity (who earned Glory this week), 5% momentum (this week vs last).',
      el: 'Το δίκαιο σκορ των σπιτιών στο Guild Hall — όχι τα ακατέργαστα Total Stars. 70% Glory σεζόν ανά μέλος, 15% Glory αυτής της εβδομάδας, 10% δραστηριότητα, 5% ορμή.'
    },
    confuse: { en: 'Guild Glory (ledger from stars), Gold', el: 'Guild Glory (κατάστιχο από αστέρια), Gold' }
  },
  {
    id: 'guild-glory',
    chapter: 'guild-hall',
    widget: 'none',
    names: { en: 'Guild Glory', el: 'Guild Glory' },
    aliases: ['guild glory'],
    def: {
      en: 'House ledger: 2 Glory per star, plus Wheel / Quiz / artifact gifts. Feeds Guild Power; it is not Gold.',
      el: 'Κατάστιχο σπιτιού: 2 Glory ανά αστέρι, συν Wheel / Quiz / αντικείμενα. Δεν είναι Gold.'
    },
    confuse: { en: 'Gold, Guild Power', el: 'Gold, Guild Power' }
  },
  {
    id: 'fortunes-wheel',
    chapter: 'guild-hall',
    widget: 'fortunes-wheel',
    names: { en: "Fortune's Wheel", el: "Fortune's Wheel" },
    aliases: ["fortune's wheel", 'fortunes wheel', 'fortune wheel', 'the wheel'],
    def: {
      en: 'Weekly spin on the class’s last lesson of a Monday–Friday week, once per class per week. Guild Hall, Pro.',
      el: 'Εβδομαδιαία περιστροφή στο τελευταίο μάθημα της εβδομάδας Δευτέρα–Παρασκευή, μία φορά ανά τμήμα. Guild Hall, Pro.'
    },
    confuse: { en: 'Quiz of the Week', el: 'Quiz of the Week' }
  },
  {
    id: 'fortune-ledger',
    chapter: 'guild-hall',
    widget: 'fortune-ledger',
    names: { en: 'Fortune Ledger', el: 'Fortune Ledger' },
    aliases: ['fortune ledger', 'wheel ledger', 'wheel history'],
    def: {
      en: 'This school year’s collapsible Wheel history on Guild Hall: Glory swings, omens, and which house was hit. Last year’s spins stay in last year.',
      el: 'Το ιστορικό του Fortune’s Wheel για αυτή τη σχολική χρονιά στο Guild Hall: Glory, οιωνοί, ποιο σπίτι χτυπήθηκε. Οι περιστροφές της προηγούμενης χρονιάς μένουν στην προηγούμενη χρονιά.'
    },
    confuse: { en: 'Adventure Log, Fortune’s Wheel relic', el: 'Adventure Log, το relic του Wheel' }
  },
  {
    id: 'guild-champion',
    chapter: 'guild-hall',
    widget: 'none',
    names: { en: 'Guild Champion', el: 'Guild Champion' },
    aliases: ['guild champion', 'house champion'],
    def: {
      en: 'Top earner inside one guild for the month — not Prodigy of the Month for the class.',
      el: 'Ο κορυφαίος μέσα σε ένα σπίτι αυτόν τον μήνα — όχι ο Prodigy of the Month του τμήματος.'
    },
    confuse: { en: 'Prodigy of the Month', el: 'Prodigy of the Month' }
  },
  {
    id: 'quest-league',
    chapter: 'team-quest',
    widget: 'map',
    names: { en: 'Quest League', el: 'Quest League' },
    aliases: ['quest league', 'junior b', 'difficulty band'],
    def: {
      en: 'Age / curriculum band (Nursery through Proficiency). Team Quest races happen inside one league. Not a guild. Not a Hero Path class.',
      el: 'Ζώνη ηλικίας / προγράμματος (Nursery έως Proficiency). Το Team Quest τρέχει μέσα σε μία league. Δεν είναι guild ούτε Hero Path.'
    },
    confuse: { en: 'Guild, Hero Path / Hero Class, quest difficulty level', el: 'Guild, Hero Path, επίπεδο δυσκολίας χάρτη' }
  },
  {
    id: 'quest-difficulty',
    chapter: 'team-quest',
    widget: 'levels',
    names: { en: 'Quest difficulty', el: 'Επίπεδο δυσκολίας' },
    aliases: ['quest difficulty', 'difficulty level', 'map level', 'level 1', 'difficulty'],
    def: {
      en: 'Stored per class, starts at 0, shown as Level 1. Completing the monthly map adds 1. The goal adds 2.5 stars per student per difficulty step, then applies the holiday / June modifier. Ceremony chips show Levels 1–6.',
      el: 'Αποθηκεύεται ανά τμήμα, ξεκινά από 0, φαίνεται ως Level 1. Η ολοκλήρωση του χάρτη προσθέτει 1. Ο στόχος προσθέτει 2,5 αστέρια ανά μαθητή ανά βήμα, μετά ο τροποποιητής αργιών / Ιουνίου.'
    },
    confuse: { en: 'Quest League (who you race)', el: 'Quest League (με ποιον τρέχεις)' }
  },
  {
    id: 'projector',
    chapter: 'classroom-chrome',
    widget: 'projector',
    names: { en: 'Projector Mode', el: 'Projector Mode' },
    aliases: ['projector mode', 'projector', 'classroom tv', 'the director', 'wallpaper mode', 'projector wallpaper'],
    def: {
      en: 'The TV button on the classroom PC. A living wallpaper you can open whenever it helps the lesson: sky, huge clock, analogue hands, class badge, wisdom line, rotating story cards, and — when they are real — remaining times (lesson Timekeeper, next lesson, bounty countdown). Not on the teacher phone. Sky Theater is a different toy.',
      el: 'Το κουμπί TV στον υπολογιστή τάξης. Ζωντανή ταπετσαρία που ανοίγεις όποτε βοηθά το μάθημα: ουρανός, ρολόι, καρτέλες, και χρόνοι που απομένουν όταν ισχύουν. Όχι στο κινητό. Το Sky Theater είναι άλλο πράγμα.'
    },
    confuse: { en: 'Sky Theater', el: 'Sky Theater' }
  },
  {
    id: 'quiz-of-the-week',
    chapter: 'home',
    widget: 'quiz-week',
    names: { en: 'Quiz of the Week', el: 'Quiz of the Week' },
    aliases: ['quiz of the week', 'weekly quiz', 'qotw'],
    def: {
      en: 'Elite game-show review on Home, first lesson day of the week during lesson time. Question count scales with enrolment (about 0.75×, minimum 5, maximum 15) — not a fixed 7.',
      el: 'Elite παιχνίδι επανάληψης στο Home. Ο αριθμός ερωτήσεων κλιμακώνεται (περίπου 0,75× εγγραφές, ελάχιστο 5, μέγιστο 15) — όχι σταθερά 7.'
    },
    confuse: { en: "Scholar's Scroll test", el: 'Διαγώνισμα Scholar’s Scroll' }
  },
  {
    id: 'family-portal',
    chapter: 'family-portal',
    widget: 'family',
    names: { en: 'Family Portal', el: 'Family Portal' },
    aliases: ['family portal', 'family access', 'parent portal', 'parents'],
    def: {
      en: 'One login per child. Progress, homework, attendance snapshot, calm messages. Pro and Elite.',
      el: 'Μία είσοδος ανά παιδί. Πρόοδος, εργασίες, απουσίες, ήρεμα μηνύματα. Pro και Elite.'
    },
    confuse: { en: 'Teacher app, School Office', el: 'Εφαρμογή δασκάλου, School Office' }
  },
  {
    id: 'school-office',
    chapter: 'school-office',
    widget: 'office',
    names: { en: 'School Office', el: 'School Office' },
    aliases: ['school office', 'secretary', 'secretary admin'],
    def: {
      en: 'Secretary interface: this year’s classes, new students, student placement, holidays, school year, school grading defaults, family messages. Elite. School-wide holiday ranges that shrink Team Quest goals live here — not in teacher My Planning.',
      el: 'Περιβάλλον γραμματείας: τμήματα της χρονιάς, νέοι μαθητές, τοποθέτηση, αργίες, σχολική χρονιά, προεπιλογές βαθμών. Elite. Οι σχολικές αργίες που μικραίνουν τον στόχο Team Quest μπαίνουν εδώ.'
    },
    confuse: { en: 'Teacher Settings, My Planning (class end dates only)', el: 'Teacher Settings, My Planning (μόνο τελευταία μαθήματα)' }
  },
  {
    id: 'adventurers-guide',
    chapter: 'classroom-chrome',
    widget: 'guide',
    names: { en: "Adventurer's Guide", el: "Adventurer's Guide" },
    aliases: ["adventurer's guide", 'adventurers guide', 'game guide', 'in-app guide'],
    def: {
      en: 'The short in-app explainer (the i in the header). This Quest Master’s Guidebook is the full teacher handbook.',
      el: 'Ο σύντομος οδηγός μέσα στην εφαρμογή (το i στην κεφαλίδα). Αυτό το βιβλίο είναι ο πλήρης οδηγός δασκάλου.'
    },
    confuse: { en: 'This guidebook', el: 'Αυτόν τον οδηγό' }
  },
  {
    id: 'mystic-market',
    chapter: 'market',
    widget: 'artifacts',
    names: { en: 'Mystic Market', el: 'Mystic Market' },
    aliases: ['mystic market', 'the market', 'shop'],
    def: {
      en: 'Own tab: spend Gold on legendary artifacts, seasonal shelf, and Familiar eggs. Spending Gold does not lower star rank.',
      el: 'Δική της καρτέλα: ξοδεύεις Gold σε artifacts, εποχιακό ράφι και αυγά Familiar. Το Gold δεν κατεβάζει τα αστέρια.'
    },
    confuse: { en: 'A panel inside Hero’s Challenge (there isn’t one)', el: 'Πάνελ μέσα στο Hero’s Challenge (δεν υπάρχει)' }
  },
  {
    id: 'story-weavers',
    chapter: 'story-weavers',
    widget: 'story-weavers',
    names: { en: 'Story Weavers', el: 'Story Weavers' },
    aliases: ['story weavers', 'story weaver'],
    def: {
      en: 'Elite collaborative writing tab. Milestone stars arrive from this tab — there is no Story Weaver button on Award Stars.',
      el: 'Elite καρτέλα συνεργατικής γραφής. Τα αστέρια οροσήμου έρχονται από εδώ — όχι από κουμπί στο Award Stars.'
    },
    confuse: { en: 'Five-Sentence Saga (calendar event)', el: 'Five-Sentence Saga (γεγονός ημερολογίου)' }
  },
  {
    id: 'scholars-scroll',
    chapter: 'scholars-scroll',
    widget: 'trial-type',
    names: { en: "Scholar's Scroll", el: "Scholar's Scroll" },
    aliases: ["scholar's scroll", 'scholars scroll'],
    def: {
      en: 'Pro tab for tests and dictations. High scores can grant Scholar’s Bonus via Starfall. Not an Award Stars reason button.',
      el: 'Καρτέλα Pro για διαγωνίσματα και υπαγορεύσεις. Οι υψηλοί βαθμοί μπορούν να δώσουν Scholar’s Bonus μέσω Starfall.'
    },
    confuse: { en: 'Award Stars, Quiz of the Week', el: 'Award Stars, Quiz of the Week' }
  },
  {
    id: 'starfall',
    chapter: 'scholars-scroll',
    widget: 'starfall',
    names: { en: 'Starfall', el: 'Starfall' },
    aliases: ['starfall bonus'],
    def: {
      en: 'Bonus stars you confirm after a high test (≥ 95% → +1) or a strong dictation streak (> 85%, with rules). It writes Scholar’s Bonus — not a fifth Award Stars virtue. Lives on Scholar’s Scroll.',
      el: 'Έξτρα αστέρια που επιβεβαιώνεις μετά από υψηλό διαγώνισμα (≥ 95% → +1) ή ισχυρή υπαγόρευση. Είναι Scholar’s Bonus — όχι πέμπτη αρετή στο Award Stars. Ζει στο Scholar’s Scroll.'
    },
    confuse: { en: 'Award Stars virtue buttons', el: 'Κουμπιά αρετών στο Award Stars' }
  },
  {
    id: 'pathfinders-map',
    chapter: 'market',
    widget: 'none',
    names: { en: "Pathfinder's Map", el: "Pathfinder's Map" },
    aliases: ["pathfinder's map", 'pathfinders map'],
    def: {
      en: 'A Market artifact. Once per class per month it grants +10 Team Quest stars so the class token jumps the map. It does not change a student’s personal rank.',
      el: 'Artifact του Market. Μία φορά ανά τμήμα ανά μήνα δίνει +10 αστέρια Team Quest. Δεν αλλάζει την προσωπική κατάταξη.'
    },
    confuse: { en: 'Quest Calendar map, Hero Path', el: 'Χάρτης ημερολογίου, Hero Path' }
  },
  {
    id: 'mask-of-the-protagonist',
    chapter: 'market',
    widget: 'none',
    names: { en: 'The Mask of the Protagonist', el: 'The Mask of the Protagonist' },
    aliases: ['mask of the protagonist', 'the mask of the protagonist'],
    def: {
      en: 'A Market artifact. 75 Gold. Guarantees Hero of the Day on the next Adventure Log. One buy per student per month. You still do not pick the crown by hand.',
      el: 'Artifact του Market. 75 Gold. Εγγυάται Hero of the Day στο επόμενο Adventure Log. Μία αγορά ανά μαθητή ανά μήνα. Δεν διαλέγεις το στέμμα με το χέρι.'
    },
    confuse: { en: 'Picking Hero of the Day, Prodigy of the Month', el: 'Επιλογή Hero of the Day, Prodigy of the Month' }
  },
  {
    id: 'gold',
    chapter: 'market',
    widget: 'gold',
    names: { en: 'Gold', el: 'Gold' },
    aliases: ['gold coins', 'wallet'],
    def: {
      en: 'The spendable wallet. 1 star granted = 1 Gold. Spending Gold in the Market does not lower star rank or Team Quest progress.',
      el: 'Το πορτοφόλι. 1 αστέρι = 1 Gold. Το ξόδεμα στο Market δεν κατεβάζει αστέρια ούτε το Team Quest.'
    },
    confuse: { en: 'Guild Glory, Guild Power', el: 'Guild Glory, Guild Power' }
  },
  {
    id: 'my-planning',
    chapter: 'settings',
    widget: 'none',
    names: { en: 'My Planning', el: 'My Planning' },
    aliases: ['my planning', 'class end dates', 'last lesson dates'],
    def: {
      en: 'Teacher Settings: the last lesson dates for your classes. School-wide holidays that shrink Team Quest goals live in School Office, not here.',
      el: 'Teacher Settings: οι τελευταίες μέρες των τμημάτων σου. Οι σχολικές αργίες που μικραίνουν τον στόχο Team Quest είναι στο School Office.'
    },
    confuse: { en: 'School Office holidays, Quest Calendar', el: 'Αργίες School Office, Quest Calendar' }
  },
  {
    id: 'hero-path',
    chapter: 'hero-path',
    widget: 'hero-classes',
    names: { en: 'Hero Path', el: 'Hero Path' },
    aliases: ['hero path', 'hero class', 'guardian sage paladin'],
    def: {
      en: 'Pro. Seven classroom identities (Guardian, Sage, Paladin, Artificer, Weaver, Scholar, Nomad) and a Skill Tree. Not a Quest League and not a guild.',
      el: 'Pro. Επτά ταυτότητες τάξης και Skill Tree. Δεν είναι Quest League ούτε guild.'
    },
    confuse: { en: 'Quest League (Junior B, Class C…)', el: 'Quest League (Junior B, C…)' }
  },
  {
    id: 'bounties',
    chapter: 'home',
    widget: 'bounty',
    names: { en: 'Bounties', el: 'Bounties' },
    aliases: ['bounty', 'class bounty', 'star vs timer'],
    def: {
      en: 'Class challenges on Home: the whole class races a star goal against a timer. Not a first-student-to-finish contest.',
      el: 'Προκλήσεις τάξης στο Home: όλο το τμήμα κυνηγά στόχο αστεριών απέναντι σε χρονόμετρο. Όχι αγώνας «ποιος πρώτος».'
    },
    confuse: { en: 'Hero’s Challenge ranks', el: 'Κατάταξη Hero’s Challenge' }
  },
  {
    id: 'quest-assignment',
    chapter: 'adventure-log',
    widget: 'none',
    names: { en: 'Quest Assignment', el: 'Quest Assignment' },
    aliases: ['quest assignment', 'homework quest'],
    def: {
      en: 'Next-lesson homework from the Adventure Log / close of class. Optional scheduled test is separate. Not a Quest Event on the calendar.',
      el: 'Εργασία για το επόμενο μάθημα. Δεν είναι Quest Event του ημερολογίου.'
    },
    confuse: { en: 'Quest Event (2× Star Day, Vault…)', el: 'Quest Event' }
  },
  {
    id: 'quest-event',
    chapter: 'quest-calendar',
    widget: 'quest-event',
    names: { en: 'Quest Event', el: 'Quest Event' },
    aliases: ['quest event'],
    def: {
      en: 'A Quest Calendar booking from the Day Planner: a 2× Star Day or Reason Bonus Day, or one of the five Special Quests. Not Quiz of the Week and not Quest Assignment.',
      el: 'Κράτηση στο Quest Calendar από το Day Planner: 2× Star Day ή Reason Bonus Day, ή ένα από τα πέντε Special Quests. Όχι Quiz of the Week και όχι Quest Assignment.'
    },
    confuse: { en: 'Quiz of the Week, Quest Assignment', el: 'Quiz of the Week, Quest Assignment' }
  },
  {
    id: 'double-star-day',
    chapter: 'quest-calendar',
    widget: 'quest-event',
    names: { en: '2× Star Day', el: '2× Star Day' },
    aliases: ['2x star day', '2× star day', 'double star day'],
    def: {
      en: 'A standard Quest Event. Every positive Award Stars gift that day is doubled automatically. You do not run a lesson screen.',
      el: 'Κανονικό Quest Event. Κάθε θετικό δώρο στο Award Stars διπλασιάζεται αυτόματα. Δεν ανοίγεις ξεχωριστή οθόνη μαθήματος.'
    },
    confuse: { en: 'Special Quest completion bonus, Reason Bonus Day', el: 'Bonus ολοκλήρωσης Special Quest, Reason Bonus Day' }
  },
  {
    id: 'reason-bonus-day',
    chapter: 'quest-calendar',
    widget: 'quest-event',
    names: { en: 'Reason Bonus Day', el: 'Reason Bonus Day' },
    aliases: ['reason bonus day'],
    def: {
      en: 'A standard Quest Event. Matching Teamwork, Creativity, Respect, or Focus awards get +1 extra star that day. The app applies it on Award Stars.',
      el: 'Κανονικό Quest Event. Τα matching Teamwork, Creativity, Respect ή Focus παίρνουν +1 έξτρα αστέρι. Το εφαρμόζει το Award Stars.'
    },
    confuse: { en: '2× Star Day, Special Quest', el: '2× Star Day, Special Quest' }
  },
  {
    id: 'special-quest',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: 'Special Quest', el: 'Special Quest' },
    aliases: ['special quest', 'special quests'],
    def: {
      en: 'A one-lesson class quest from the calendar: Vocabulary Vault, Grammar Guardians, The Unbroken Chain, The Scribe’s Sketch, or Five-Sentence Saga. Progress is remembered. Completion pays Stars and the same Gold once.',
      el: 'Quest ενός μαθήματος από το ημερολόγιο: Vocabulary Vault, Grammar Guardians, The Unbroken Chain, The Scribe’s Sketch ή Five-Sentence Saga. Η πρόοδος θυμάται. Η ολοκλήρωση δίνει Stars και το ίδιο Gold μία φορά.'
    },
    confuse: { en: 'Story Weavers, Quiz of the Week, Quest Assignment', el: 'Story Weavers, Quiz of the Week, Quest Assignment' }
  },
  {
    id: 'vocabulary-vault',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: 'Vocabulary Vault', el: 'Vocabulary Vault' },
    aliases: ['vocabulary vault'],
    def: {
      en: 'Special Quest. Default goal 10 valid uses (range 5–30). The teacher screen button is Add Word Gem. Complete Quest stays off until the goal is reached.',
      el: 'Special Quest. Προεπιλεγμένος στόχος 10 έγκυρες χρήσεις (5–30). Το κουμπί είναι Add Word Gem. Το Complete Quest μένει κλειστό μέχρι να πιάσεις τον στόχο.'
    },
    confuse: { en: 'Story Weavers Word of the Day', el: 'Word of the Day στο Story Weavers' }
  },
  {
    id: 'grammar-guardians',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: 'Grammar Guardians', el: 'Grammar Guardians' },
    aliases: ['grammar guardians'],
    def: {
      en: 'Special Quest. Default goal 8 rescued sentences (range 3–20). The teacher screen button is Rescued Sentence.',
      el: 'Special Quest. Προεπιλεγμένος στόχος 8 διασωσμένες προτάσεις (3–20). Το κουμπί είναι Rescued Sentence.'
    },
    confuse: { en: 'Scholar’s Scroll tests', el: 'Διαγωνίσματα Scholar’s Scroll' }
  },
  {
    id: 'unbroken-chain',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: 'The Unbroken Chain', el: 'The Unbroken Chain' },
    aliases: ['unbroken chain', 'the unbroken chain'],
    def: {
      en: 'Special Quest. Default goal 10 successful turns (range 5–30). Buttons are Successful Turn and Chain Broke. A break starts the current chain again; the best chain remains.',
      el: 'Special Quest. Προεπιλεγμένος στόχος 10 επιτυχημένες turns (5–30). Κουμπιά Successful Turn και Chain Broke. Το σπάσιμο ξεκινά ξανά την τρέχουσα αλυσίδα· η καλύτερη μένει.'
    },
    confuse: { en: 'Story Weavers, Quiz of the Week', el: 'Story Weavers, Quiz of the Week' }
  },
  {
    id: 'scribes-sketch',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: "The Scribe's Sketch", el: "The Scribe's Sketch" },
    aliases: ["scribe's sketch", 'scribes sketch', 'the scribes sketch'],
    def: {
      en: 'Special Quest. Four buttons: Step 1: Listen, Step 2: Sketch, Step 3: Add details, Step 4: Reveal & describe. Optional projector prompt, at most 160 characters, shown only if you opt in.',
      el: 'Special Quest. Τέσσερα κουμπιά: Step 1: Listen, Step 2: Sketch, Step 3: Add details, Step 4: Reveal & describe. Προαιρετικό prompt στον projector, έως 160 χαρακτήρες, μόνο με opt-in.'
    },
    confuse: { en: 'Story Weavers, Five-Sentence Saga', el: 'Story Weavers, Five-Sentence Saga' }
  },
  {
    id: 'five-sentence-saga',
    chapter: 'quest-calendar',
    widget: 'special-quest',
    names: { en: 'Five-Sentence Saga', el: 'Five-Sentence Saga' },
    aliases: ['five-sentence saga', 'five sentence saga'],
    def: {
      en: 'Special Quest. Exactly five sentence slots. Submit Sentence locks the previous slot. Each sentence is optional and at most 240 characters.',
      el: 'Special Quest. Ακριβώς πέντε θέσεις πρότασης. Το Submit Sentence κλειδώνει την προηγούμενη. Κάθε πρόταση είναι προαιρετική, έως 240 χαρακτήρες.'
    },
    confuse: { en: 'Story Weavers class tale', el: 'Το ομαδικό παραμύθι στο Story Weavers' }
  },
  {
    id: 'growth-festival',
    chapter: 'ceremony',
    widget: 'growth-festival',
    names: { en: 'Growth Festival', el: 'Growth Festival' },
    aliases: ['growth festival', 'golden bloom', 'parade of blooms', 'league garden', 'our league garden', 'whole class garden'],
    def: {
      en: 'The automatic Ceremony of the Month for Nursery and Pre-Junior: a gentle, non-competitive garden celebration with no public ranks, scores, or podium.',
      el: 'Η αυτόματη Ceremony of the Month για Nursery και Pre-Junior: μια ήπια, μη ανταγωνιστική γιορτή κήπου χωρίς δημόσιες θέσεις, σκορ ή podium.'
    },
    confuse: { en: 'Classic Arena, Grand Guild Ceremony', el: 'Classic Arena, Grand Guild Ceremony' }
  },
  {
    id: 'league-pathfinder',
    chapter: 'ceremony',
    widget: 'league-pathfinder',
    names: { en: 'League Pathfinder', el: 'League Pathfinder' },
    aliases: ['league pathfinder', 'our league pathfinder'],
    def: {
      en: 'The Growth Festival class honour for the class that led the month. Revealed last in Our League Garden. It is not Pathfinder’s Map, the Market artifact.',
      el: 'Η τιμή τάξης στο Growth Festival για την τάξη που ξεχώρισε τον μήνα. Εμφανίζεται τελευταία στο Our League Garden. Δεν είναι το Pathfinder’s Map του Market.'
    },
    confuse: { en: "Pathfinder's Map (Market artifact)", el: "Pathfinder's Map (artifact του Market)" }
  },
  {
    id: 'familiars',
    chapter: 'market',
    widget: 'familiars',
    names: { en: 'Familiars', el: 'Familiars' },
    aliases: ['familiar egg', 'companion egg', 'familiars'],
    def: {
      en: 'Elite companion eggs from the Market. One familiar hatches and evolves. Not an avatar from Avatar Forge.',
      el: 'Elite αυγά συντροφιάς από το Market. Δεν είναι avatar του Avatar Forge.'
    },
    confuse: { en: 'Avatar Forge', el: 'Avatar Forge' }
  },
  {
    id: 'attendance-chronicle',
    chapter: 'adventure-log',
    widget: 'attendance',
    names: { en: 'Attendance Chronicle', el: 'Attendance Chronicle' },
    aliases: ['attendance chronicle', 'month matrix', 'attendance grid'],
    def: {
      en: 'Pro month-grid of presence. The absent / Welcome Back buttons on Award Stars clouds are a different, live-lesson tool.',
      el: 'Pro μηνιαίος πίνακας παρουσιών. Τα κουμπιά απουσίας στο Award Stars είναι άλλο εργαλείο, του ζωντανού μαθήματος.'
    },
    confuse: { en: 'Award Stars absence buttons', el: 'Κουμπιά απουσίας στο Award Stars' }
  },
  {
    id: 'sky-theater',
    chapter: 'classroom-chrome',
    widget: 'none',
    names: { en: 'Sky Theater', el: 'Sky Theater' },
    aliases: ['sky theater', 'emoji flights', 'header flights'],
    def: {
      en: 'Decorative emoji flights across the header sky. Fun, not Projector Mode (the classroom TV).',
      el: 'Διακοσμητικές πτήσεις στην κεφαλίδα. Δεν είναι Projector Mode.'
    },
    confuse: { en: 'Projector Mode', el: 'Projector Mode' }
  },
  {
    id: 'guild-hall',
    chapter: 'guild-hall',
    widget: 'houses',
    names: { en: 'Guild Hall', el: 'Guild Hall' },
    aliases: ['guild hall', 'the guilds', 'four houses'],
    def: {
      en: 'The year-long house tab (Pro). Four houses for life, ranked by Guild Power. Fortune’s Wheel lives here. June’s Grand Guild Ceremony is here — not the monthly dual ceremony.',
      el: 'Η καρτέλα των σπιτιών όλης της χρονιάς (Pro). Τέσσερα σπίτια για ζωή, κατάταξη με Guild Power. Η Grand Guild Ceremony του Ιουνίου είναι εδώ.'
    },
    confuse: { en: 'Team Quest (monthly class map)', el: 'Team Quest (μηνιαίος χάρτης τμημάτων)' }
  },
  {
    id: 'skill-tree',
    chapter: 'hero-path',
    widget: 'skill-tree',
    names: { en: 'Skill Tree', el: 'Skill Tree' },
    aliases: ['skill tree', 'skill branch', 'pending skill'],
    def: {
      en: 'Pro. At each Hero Path level the child picks one of two permanent branches. The purple sitemap on Manage Students pulses when a choice is waiting. Bonus stars move ranks; bonus Gold does not. Matching virtue only.',
      el: 'Pro. Σε κάθε επίπεδο Hero Path διαλέγουν ένα από δύο μόνιμα κλαδιά. Το μωβ κουμπί στο Manage Students πάλλεται όταν περιμένει επιλογή.'
    },
    confuse: { en: 'Quest League, Guild Hall', el: 'Quest League, Guild Hall' }
  },
  {
    id: 'heros-chronicle',
    chapter: 'settings',
    widget: 'chronicle',
    names: { en: "Hero's Chronicle", el: "Hero's Chronicle" },
    aliases: ["hero's chronicle", 'heros chronicle', 'chronicle notes', 'oracle'],
    def: {
      en: 'The student hub card — “Adventure notes & Oracle AI” — and the green book on Manage Students. Private notes (General, Academic, Behavior, Social, Goals). Families do not see them unless you publish. Elite Oracle: Parent Summary, Teacher Strategy, Traits & Trends, Hero’s Goal.',
      el: 'Η κάρτα στο student hub — «Adventure notes & Oracle AI» — και το πράσινο βιβλίο στο Manage Students. Ιδιωτικές σημειώσεις. Οι οικογένειες δεν τις βλέπουν εκτός αν δημοσιεύσεις. Oracle στο Elite.'
    },
    confuse: { en: 'Adventure Log (the class story)', el: 'Adventure Log (η ιστορία της τάξης)' }
  },
  {
    id: 'manage-students',
    chapter: 'settings',
    widget: 'roster',
    names: { en: 'Manage Students', el: 'Manage Students' },
    aliases: ['manage students', 'student roster', 'roster buttons'],
    def: {
      en: 'The class list from My Classes. Same buttons the classroom uses: Guild quiz, Skill Tree, Hero’s Chronicle, Parent Access, Avatar Forge, Certificate, Move, Edit, Delete.',
      el: 'Η λίστα τμήματος από My Classes. Τα ίδια κουμπιά: Guild, Skill Tree, Hero’s Chronicle, Parent Access, Avatar Forge, Certificate, Move, Edit, Delete.'
    },
    confuse: { en: 'Hero’s Challenge ranks (not a roster editor)', el: 'Κατάταξη Hero’s Challenge (δεν είναι μαθητολόγιο)' }
  }
];

/** Font Awesome icons that match the classroom UI for guidebook term chips. */
export const TERM_ICONS = {
  'award-stars': 'fa-star',
  'team-quest': 'fa-route',
  'heros-challenge': 'fa-user-graduate',
  'ceremony-of-the-month': 'fa-trophy',
  'classic-arena': 'fa-wand-magic-sparkles',
  'growth-festival': 'fa-seedling',
  'league-pathfinder': 'fa-leaf',
  'great-guild-ceremony': 'fa-shield-alt',
  prodigy: 'fa-trophy',
  'co-prodigy': 'fa-trophy',
  'hall-of-prodigies': 'fa-landmark',
  'hero-of-the-day': 'fa-crown',
  'hall-of-heroes': 'fa-crown',
  'heros-boon': 'fa-heart',
  'includes-heros-boon': 'fa-star',
  'teacher-boon': 'fa-wand-magic-sparkles',
  'welcome-back': 'fa-hand-sparkles',
  'guild-power': 'fa-bolt',
  'guild-glory': 'fa-sun',
  'fortunes-wheel': 'fa-dharmachakra',
  'fortune-ledger': 'fa-scroll',
  'guild-champion': 'fa-medal',
  'quest-league': 'fa-layer-group',
  'quest-difficulty': 'fa-mountain',
  projector: 'fa-tv',
  'quiz-of-the-week': 'fa-question',
  'family-portal': 'fa-house-user',
  'school-office': 'fa-building-shield',
  'adventurers-guide': 'fa-info',
  'mystic-market': 'fa-store',
  'story-weavers': 'fa-feather-alt',
  'scholars-scroll': 'fa-scroll',
  starfall: 'fa-meteor',
  'pathfinders-map': 'fa-map',
  'mask-of-the-protagonist': 'fa-theater-masks',
  'my-planning': 'fa-calendar-check',
  'hero-path': 'fa-hat-wizard',
  bounties: 'fa-bullseye',
  'quest-assignment': 'fa-clipboard-list',
  'quest-event': 'fa-calendar-days',
  'double-star-day': 'fa-star',
  'reason-bonus-day': 'fa-lightbulb',
  'special-quest': 'fa-wand-magic-sparkles',
  'vocabulary-vault': 'fa-book',
  'grammar-guardians': 'fa-shield-alt',
  'unbroken-chain': 'fa-link',
  'scribes-sketch': 'fa-pencil-alt',
  'five-sentence-saga': 'fa-align-left',
  familiars: 'fa-egg',
  'attendance-chronicle': 'fa-user-check',
  'sky-theater': 'fa-cloud-sun',
  'guild-hall': 'fa-shield-alt',
  'skill-tree': 'fa-sitemap',
  'heros-chronicle': 'fa-book-reader',
  'manage-students': 'fa-users',
  gold: 'fa-coins'
};

/** Icons on Starter / Pro / Elite plan chips (labels may be longer than a single term). */
export const PLAN_CHIP_ICONS = {
  'Award Stars': 'fa-star',
  'Team Quest': 'fa-route',
  "Hero's Challenge": 'fa-user-graduate',
  'Ceremony of the Month': 'fa-trophy',
  'Quest Assignment & attendance': 'fa-clipboard-list',
  Bounties: 'fa-bullseye',
  'Market artifacts': 'fa-gem',
  "Hero's Boon": 'fa-heart',
  'Teacher Boon': 'fa-wand-magic-sparkles',
  'Projector Mode': 'fa-tv',
  'Guild Hall': 'fa-shield-alt',
  'Hero Path': 'fa-hat-wizard',
  "Scholar's Scroll": 'fa-scroll',
  'Adventure Log diary': 'fa-book-open',
  'Family Access': 'fa-house-user',
  'Story Weavers': 'fa-feather-alt',
  'School Office': 'fa-building-shield',
  'Everything in Starter': 'fa-check',
  'Guild Hall, Wheel, Ledger, sorting quiz': 'fa-dharmachakra',
  'Hero Path / Skill Tree': 'fa-sitemap',
  'Quest Calendar / Day Planner': 'fa-calendar-alt',
  "Scholar's Scroll, Starfall, make-ups": 'fa-meteor',
  'Adventure Log, Hero of the Day, Hall of Heroes': 'fa-crown',
  'Attendance Chronicle': 'fa-user-check',
  'My Planning': 'fa-calendar-check',
  'Class grading override': 'fa-sliders-h',
  'Everything in Pro': 'fa-check',
  Familiars: 'fa-egg',
  'Quiz of the Week': 'fa-question',
  'AI: Oracle, Avatar Forge, Restock, nameday, certificates, chronicler, images': 'fa-wand-magic-sparkles',
  'AI chronicler & images': 'fa-feather-alt'
};

export const PLAN_EXPLORER = {
  starter: {
    cap: { teachers: '3', classes: '6' },
    has: [
      'Award Stars', 'Team Quest', "Hero's Challenge", 'Ceremony of the Month',
      'Quest Assignment & attendance', 'Bounties', 'Market artifacts',
      "Hero's Boon", 'Teacher Boon', 'Projector Mode'
    ],
    later: ['Guild Hall', 'Hero Path', "Scholar's Scroll", 'Adventure Log diary', 'Family Access', 'Story Weavers', 'School Office']
  },
  pro: {
    cap: { teachers: '6', classes: '10' },
    has: [
      'Everything in Starter', 'Guild Hall, Wheel, Ledger, sorting quiz',
      'Hero Path / Skill Tree', 'Quest Calendar / Day Planner', "Scholar's Scroll, Starfall, make-ups",
      'Adventure Log, Hero of the Day, Hall of Heroes', 'Attendance Chronicle',
      'Family Access', 'My Planning', 'Class grading override'
    ],
    later: ['Story Weavers', 'Familiars', 'Quiz of the Week', 'School Office', 'AI chronicler & images']
  },
  elite: {
    cap: { teachers: 'Unlimited', classes: 'Unlimited' },
    has: [
      'Everything in Pro', 'Story Weavers', 'Familiars', 'Quiz of the Week',
      'School Office', 'AI: Oracle, Avatar Forge, Restock, nameday, certificates, chronicler, images'
    ],
    later: []
  }
};

export const CHAPTER_SEARCH = {
  'why-we-quest': ['philosophy', 'ethos', 'pedagogy', 'why', 'virtues', 'belonging', 'quest master'],
  'the-quest': ['orientation', 'daily loop', 'three interfaces', 'ten tabs'],
  'classroom-chrome': ['header', 'projector', 'wallpaper', 'weather', 'sky theater', 'mobile', 'wisdom dock', 'the director', 'timekeeper'],
  'home': ['quiz of the week', 'bounties', 'dashboard'],
  'team-quest': ['map', 'league', 'difficulty', 'holidays', 'june', 'bronze', 'goal', 'pathfinder'],
  'heros-challenge': ['prodigy', 'trophy', 'hall of prodigies'],
  'ceremony': ['monthly ritual', 'dual', 'teacher boon ribbon', 'co-prodigy', 'league duel', 'hero duel', 'growth festival', 'classic arena', 'golden bloom'],
  'quest-calendar': ['holidays', 'day planner', 'quest event', 'special quest', 'vocabulary vault'],
  'market': ['gold', 'artifacts', 'familiars', 'eggs', 'mask'],
  'guild-hall': ['guild ceremony', 'great guild ceremony', 'grand guild ceremony', 'wheel', 'glory', 'guild power', 'fortune ledger', 'momentum'],
  'award-stars': ['boon', 'teacher boon', 'hero boon', 'welcome back', 'virtues', 'heart'],
  'adventure-log': ['hero of the day', 'hall of heroes', 'diary', 'attendance chronicle'],
  'scholars-scroll': ['starfall', 'tests', 'dictation', 'make-up'],
  'story-weavers': ['writing', 'elite'],
  'settings': ['my classes', 'roster', 'quiz setup', 'manage students', "hero's chronicle", 'oracle'],
  'hero-path': ['guardian', 'skill tree', 'nomad', 'paladin', 'sage', 'weaver', 'scholar', 'artificer'],
  'school-office': ['secretary', 'holidays', 'school details', 'new student', 'student placement'],
  'family-portal': ['parents', 'family access'],
  'glossary': ['names', 'confuse'],
  'plans': ['starter', 'pro', 'elite', 'at a glance', 'caps']
};
