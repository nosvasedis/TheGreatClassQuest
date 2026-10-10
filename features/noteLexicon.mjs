// features/noteLexicon.mjs
// The pedagogical lexicon behind the Hero's Chronicle reader and the Class Greenhouse:
// what a teacher of young English learners in Greece writes about a child, in Greek, in
// English or in Greeklish, sorted into themes a teacher can act on.
//
// Sources the themes and the Greek wording were built from:
//   - ΠΥΛΗ teacher rating scales (University of Thessaly, 2025): the disruptive-behaviour and
//     internalising/emotional subscales. Their items give the real Greek a teacher uses:
//     "διακόπτει ή ενοχλεί τους συμμαθητές", "δεν ακολουθεί τις οδηγίες", "κινείται εντός της
//     αίθουσας", "κάνει άσχετα σχόλια", "θέλει να διατάζει", "χάνει εύκολα την ψυχραιμία",
//     "αποφεύγει να μιλάει", "προτιμάει να παίζει μόνος", "αποθαρρύνεται εύκολα", "κάνει
//     υποτιμητικά σχόλια για τον εαυτό του", "εύκολα προσκολλάται στους ενήλικες".
//   - The SDQ (Goodman) domains: conduct, hyperactivity/inattention, emotional, peer, prosocial.
//     They shape the domains below.
//   - EEF, Improving Behaviour in Schools: know the pupil, teach learning behaviours (focus,
//     organisation, independence, perseverance), simple routines, daily report cards.
//   - Classroom practice for young EFL learners (skills, L1 use, pronunciation).
//
// Every theme:
//   id         stable key (stored in teacher corrections and AI readings: never rename)
//   kind       'worry' (a concern by default), 'learning' (a skill: worry or strength by tone),
//              'strength' (good by default), 'context' (private background, never a judgement)
//   sev        how strongly an open worry pulls the teacher's attention (1-2)
//   group      the old grouping the Greenhouse engine reasons with (behaviour, habits,
//              wellbeing, learning, strength)
//   domain     the column it is shown in (NOTE_DOMAINS)
//   en / gr    wording that names the theme: English regex fragments run on the folded
//              text; Greek fragments written in plain Greek, compared by sound (so typos and
//              Greeklish match too). "\<" marks a word start.
//   good       wording that says it is going right ("now brings her book", "πιο ήσυχος")
//   except     collocations that mean something else ("ζωηρή συμμετοχή" is eager, not restless)
//   mirror     a worry this strength is the bright side of: dropped when that worry is "better"
//   techniques seed packets from features/classGreenhousePlaybook.mjs
//   action     the one move for next lesson
//   reframe    the asset view of the same child, for the AI and the Oracle
//   examples   sentences the tests read: [text, tone, category?]
//
// Pure data. Compiled by features/classGreenhouseNotes.mjs with features/noteTextCore.mjs.

export const NOTE_DOMAINS = [
    { id: 'behaviour', label: 'Behaviour', labelEl: 'Συμπεριφορά', icon: 'fa-bolt' },
    { id: 'habits', label: 'Habits', labelEl: 'Συνήθειες μάθησης', icon: 'fa-list-check' },
    { id: 'feelings', label: 'Friends & feelings', labelEl: 'Φίλοι και συναισθήματα', icon: 'fa-heart' },
    { id: 'learning', label: 'Learning English', labelEl: 'Αγγλικά', icon: 'fa-language' },
    { id: 'strengths', label: 'Strengths', labelEl: 'Δυνατά σημεία', icon: 'fa-star' },
    { id: 'background', label: 'Background', labelEl: 'Ιστορικό', icon: 'fa-house' }
];

const P = '(his|her|their)';
const S = '(him|her|them)';

export const LEXICON_THEMES = [
    // ---------------------------------------------------------------- Behaviour
    { id: 'chatty', kind: 'worry', sev: 1, group: 'behaviour', domain: 'behaviour', label: 'Talks over others', labelEl: 'Φλυαρεί, διακόπτει', icon: 'fa-comment-dots',
        en: ['chatty', 'talkative', 'talks? (a lot|all the time|during|too much|nonstop|non-stop)', 'keeps? talking', 'talking (during|in class|in the lesson|all|a lot|over|nonstop|to ' + P + ' (friend|neighbou?r|partner))', 'chats? (during|in|all|a lot)',
            'calls? out', 'shouts? out', 'blurts? out', 'interrupt', 'disrupt', 'disturbs? (others|the class|classmates|the lesson|' + P + ')', 'won\'?t stop talking', 'can\'?t stop talking', 'speaks? without (raising|putting)'],
        gr: ['φλυαρ', 'μιλαει (στο μαθημα|ολη την ωρα|πολυ|συνεχεια|ολη|ασταματητα|με τον διπλανο|με την διπλανη|χωρις να)', 'μιλα (πολυ|συνεχεια)', 'κουβεντ', 'διακοπτ', 'πεταγεται', 'φωναζει', 'ενοχλει (τους συμμαθητ|τα αλλα παιδια|τον διπλαν|την διπλαν|την ταξη|το μαθημα)',
            'πεταει (σχολια|ατακες|ατακουλες)', 'μουρμουριζ', 'δεν σταματαει να μιλαει', 'φασαρια με (τον|την) διπλαν'],
        good: { en: ['less (chatty|talkative)', 'waits? (for )?' + P + ' turn', 'puts? ' + P + ' hand up', 'raises? ' + P + ' hand (first|before)'],
            gr: ['λιγοτερο φλυαρ', 'περιμενει τη σειρα', 'σηκωνει (πλεον |πια )?το χερι (πριν|για να)', 'μιλαει λιγοτερο'] },
        techniques: ['talking-token', 'quiet-signal', 'good-behaviour-game'],
        action: (n) => `Agree a hand signal with ${n} before the lesson, and star the first time they wait.`,
        reframe: 'Has plenty to say: give the talk a channel (pair rehearsal, a speaking role).',
        examples: [['He keeps talking during the lesson.', 'worry', 'Behavior'], ['Μιλάει συνέχεια με τον διπλανό του.', 'worry'], ['Ενοχλεί τους συμμαθητές του την ώρα του μαθήματος.', 'worry'], ['Less chatty this week, waits for her turn.', 'better']] },

    { id: 'energetic', kind: 'worry', sev: 1, group: 'behaviour', domain: 'behaviour', label: 'Lively, hard to settle', labelEl: 'Ζωηρός, δύσκολα ηρεμεί', icon: 'fa-bolt',
        en: ['hyper\\b', 'hyperactive', 'lively', 'boisterous', 'rowdy', 'unruly', 'naughty', 'restless', 'full of (energy|beans|beanz)', 'bundle of energy', 'too much energy', '(can\'?t|cannot|won\'?t|doesn\'?t|does not) sit still',
            '(out of|leaves|left|gets out of) ' + P + ' (seat|chair|desk|place)', 'gets? up (all the time|constantly|again|from ' + P + ' (seat|chair))', 'walks? around the (class|room)', 'runs? around', 'running around', 'bounc(es|ing) (around|off)',
            'hard to settle', '(won\'?t|doesn\'?t|can\'?t) settle', 'over-?excited', 'wound up', 'climbing (on|the)', 'misbehav', 'mischie?vous', 'fidgety and loud'],
        gr: ['ζωηρ', 'υπερκινητικ', 'ατακτ', 'αταξι', 'σκανταλ', 'φασαρ', 'δεν καθεται (ησυχ|στη θεση|σε μια θεση|καθολου|ακινητ)', 'δεν καθεται', 'σηκωνεται (συνεχεια|απο τη θεση|ολη την ωρα|χωρις)', 'σηκωνεται απο τη θεση',
            'κινειται (στην ταξη|στην αιθουσα|συνεχεια|ολη την ωρα)', 'τριγυριζει (στην ταξη|στην αιθουσα)', 'δεν ησυχαζει', 'δεν ηρεμει', 'σβουρα', 'τρεχει (στην ταξη|μεσα στην ταξη|γυρω γυρω)', 'ανεβαινει (στο θρανιο|στις καρεκλ)', 'εχει (πολλη|πολυ) ενεργεια', 'απειθαρχ\\p{L}* κινησ',
            'δεν μπορει να κατσει', 'δεν κατσε'],
        except: { en: ['lively (discussion|debate|participation|contribution|interest|ideas|imagination|reader|reading|speaker)'],
            gr: ['ζωηρ\\p{L}* (συμμετοχ|ενδιαφερ|φαντασι|συζητησ|ματια)', 'ζωηρο (ενδιαφερ|πνευμα)'] },
        good: { en: ['more settled', 'sits? (still|nicely|quietly) (now|all lesson|the whole lesson)', 'settles? (quickly|well|down quickly)'],
            gr: ['πιο ησυχ', 'καθεται (πλεον|πια|ησυχα|ησυχος|ησυχη)', 'καταφερε να καθισει'] },
        techniques: ['energy-job', 'precorrection', 'good-behaviour-game', 'brain-break'],
        action: (n) => `Give ${n} a moving job early (board writer, handing out), and name the rule just before each change of activity.`,
        reframe: 'Energy is fuel: a job, movement and quick wins turn it into effort.',
        examples: [['Thiseas is ΠΟΛΥ ΖΩΗΡΟΣ', 'worry'], ['Πολύ ζωηρός, δεν κάθεται στη θέση του.', 'worry'], ['poly zwhros kai den kanei tis askhseis', 'worry'], ['Very lively and loud today.', 'worry'], ['Δεν είναι πια ζωηρός.', 'better'], ['Πολύ πιο ήσυχος σήμερα, κάθεται πλέον στη θέση του.', 'better']] },

    { id: 'clowning', kind: 'worry', sev: 1, group: 'behaviour', domain: 'behaviour', label: 'Clowns for attention', labelEl: 'Κάνει τον καραγκιόζη', icon: 'fa-masks-theater',
        en: ['class clown', 'clown(s|ing)? (around|about)', '\\<clowning', 'silly', 'show(s|ing)? off', 'acts? up', 'acting up', 'plays? the fool', 'irrelevant (comments|remarks|jokes)', 'off-?topic (comments|remarks|jokes)', 'funny faces', 'pulls? faces', 'attention[- ]seeking', 'seeks? attention', 'wants? (all the )?attention', 'makes? (silly )?noises', 'giggl'],
        gr: ['καραγκιοζ', 'κανει τον (εξυπνο|αστειο|καραγκιοζη|κλοουν|μαγκα)', 'κανει (πλακες|πλακα|χαζομαρες|σαχλαμαρες|αστεια) (στο μαθημα|συνεχεια|ολη την ωρα)', 'χαζομαρ', 'σαχλαμαρ', 'σαχλ', 'ασχετα σχολια', 'ασχετες ερωτησ', 'τραβαει την προσοχη', 'θελει (την προσοχη|να τραβαει)', 'κανει φιγουρα', 'μορφασμ', 'γκριματσ', 'κανει θορυβους', 'γελαει (συνεχεια|στο μαθημα|χωρις λογο|ολη την ωρα)', 'χαχαν'],
        techniques: ['energy-job', 'specific-praise', 'expert-role'],
        action: (n) => `Give ${n} the spotlight on purpose: a short role (reading a part, demonstrating), and praise the on-task moment straight away.`,
        reframe: 'Wants an audience: give the audience for the right things.',
        examples: [['Κάνει τον καραγκιόζη στο μάθημα.', 'worry'], ['Always making silly jokes and pulling faces.', 'worry'], ['Κάνει άσχετα σχόλια την ώρα του μαθήματος.', 'worry']] },

    { id: 'rules', kind: 'worry', sev: 2, group: 'behaviour', domain: 'behaviour', label: 'Ignores instructions', labelEl: 'Δεν ακολουθεί οδηγίες', icon: 'fa-signs-post',
        en: ['(doesn\'?t|does not|didn\'?t|won\'?t|refuses to) (follow|listen to|do) (the |my )?(instructions|rules|what (i|we) (say|ask))', 'ignores? (the |my )?(instructions|rules|me|what)', 'disobe', 'defian', 'refus(es|ed|ing) to', 'not following (the )?(instructions|rules)', 'breaks? (the )?rules',
            'does (what|whatever) ' + '(he|she|they) wants?', 'does ' + P + ' own thing', 'has to be told (twice|again|several times|many times|over and over)', 'needs? (many|several|constant|lots of) reminders', 'won\'?t listen', 'doesn\'?t listen to me', 'pushes? (the )?boundaries', 'tests? (the )?limits'],
        gr: ['δεν ακολουθει (τις )?οδηγι', 'δεν ακολουθει τους κανον', 'δεν υπακου', 'ανυπακο', 'απειθαρχ', 'δεν τηρει (τους )?κανον', 'παραβιαζει', 'κανει (οτι|ο,τι) θελει', 'κανει του κεφαλιου', 'πρεπει να (του|της) (το )?(πω|λεω) (πολλες|δυο|ξανα|συνεχεια)',
            'θελει (συνεχεις|πολλες|διαρκεις) υπενθυμισ', 'αρνειται', 'αρνηθηκε', 'αρνιεται', 'δεν με ακουει', 'δεν ακουει (οταν|τι) (του|της) (λεω|ζηταω)', 'κανει (το|τα) αντιθετ', 'δοκιμαζει τα ορια', 'ξεπερναει τα ορια', 'ξεφευγει'],
        good: { en: ['follows? (the )?(instructions|rules) (now|well|first time)', 'listens? (the )?first time'], gr: ['ακολουθει (πλεον|πια|τωρα) (τις )?οδηγι', 'ακουει (πλεον|πια) (την πρωτη|με την πρωτη)'] },
        techniques: ['precorrection', 'restorative-chat', 'daily-report-card', 'self-monitoring'],
        action: (n) => `Give ${n} the instruction privately and in one step, ask them to repeat it, and thank them as soon as they start.`,
        reframe: 'A strong will: give real choices inside clear limits.',
        examples: [['Δεν ακολουθεί τις οδηγίες μου.', 'worry'], ['Refused to do the task and ignores the rules.', 'worry'], ['Πρέπει να του το πω πολλές φορές.', 'worry']] },

    { id: 'respect', kind: 'worry', sev: 2, group: 'behaviour', domain: 'behaviour', label: 'Rude or answers back', labelEl: 'Αγένεια, αντιμιλάει', icon: 'fa-hand',
        en: ['rude', 'cheeky', 'disrespect', 'answers? back', 'talks? back', 'swears?\\b', 'swearing', 'bad language', 'rude (words|language|gestures)', 'insolent', 'mocks? (the teacher|me)', 'rolls? ' + P + ' eyes', 'argues? with (me|the teacher)'],
        gr: ['αγενη', 'αγενεια', 'αυθαδ', 'αναιδ', 'θρασ', 'απαντα πισω', 'αντιμιλ', 'ασεβ', 'δεν σεβεται', 'ακαταλληλη γλωσσα', 'ακαταλληλες (λεξεις|εκφρασεις)', 'βριζει', 'βρισιες', 'βρισια', 'κακες λεξεις', 'λογομαχει (μαζι μου|με (τον|την) (δασκαλ|καθηγητ))', 'διαπληκτιζ', 'κοροιδευει (εμενα|τον δασκαλο|την δασκαλα|την καθηγητρια)'],
        good: { en: ['more (polite|respectful)', 'less rude', 'apologi[sz]ed'], gr: ['πιο ευγενικ', 'ζητησε συγγνωμη', 'πιο σεβαστικ'] },
        techniques: ['restorative-chat', 'kind-words-wall', 'precorrection'],
        action: (n) => `Give ${n} a real job in the lesson; one calm private word if it happens again.`,
        examples: [['Ήταν αγενής και αντιμίλησε.', 'worry'], ['He was rude and answered back.', 'worry']] },

    // ---------------------------------------------------------------- Habits and learning behaviours
    { id: 'focus', kind: 'worry', sev: 1, group: 'behaviour', domain: 'habits', label: 'Hard to focus', labelEl: 'Δυσκολία συγκέντρωσης', icon: 'fa-eye',
        en: ['distract', 'loses? focus', 'lack of (focus|concentration|attention)', 'can\'?t (focus|concentrate)', 'not (focused|concentrating|paying attention)', 'daydream', 'fidget', 'in ' + P + ' own world', 'stares? (out of the window|into space)', 'plays? with ' + P + ' (pencil|pen|eraser|rubber|ruler|things)', 'off[- ]task', 'zones? out', 'mind wanders', 'attention span', 'easily distracted', 'switches? off'],
        gr: ['αφηρημεν', 'αφαιρει', 'δεν (προσεχει|συγκεντρων)', 'συγκεντρωση', 'χαζευ', 'ανησυχο παιδι', 'αποσπαται (η προσοχη|ευκολα)', 'ονειροπολ', 'κοιταζει (εξω|απο το παραθυρο|το ταβανι)', 'παιζει με (το|τα|τη|την) (μολυβ|κασετιν|γομ|στυλο|πραγματα)', 'στον κοσμο (του|της)', 'στα συννεφα', 'χανεται', 'χανει την προσοχη', 'δεν ειναι συγκεντρωμεν', 'δεν παρακολουθει'],
        good: { en: ['more (focused|attentive|concentrated)', 'focus(es|ed)? better', 'concentrat\\p{L}* better', 'pays? attention', 'stays? on task'],
            gr: ['πιο (συγκεντρωμ|προσεκτικ)', 'προσεχει (πια|πλεον|περισσοτερο)', 'συγκεντρωνεται (καλυτερα|πλεον|πια)', 'παρακολουθει (πλεον|πια|καλυτερα)'] },
        techniques: ['seat-near', 'countdown-start', 'brain-break', 'self-monitoring'],
        action: (n) => `Seat ${n} near you and give the task in two short steps.`,
        examples: [['Anna is very distracted in class.', 'worry'], ['Είναι αφηρημένη και δεν προσέχει.', 'worry'], ['Much more focused this week, no longer distracted.', 'better']] },

    { id: 'homework', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Homework not done', labelEl: 'Δεν κάνει εργασίες', icon: 'fa-book',
        en: ['(no|didn\'?t do|forgot|forgets|missing|without|incomplete|unfinished|never does|half) (' + P + ' |the )?homework', 'homework (missing|not done|incomplete|again|unfinished|half done)', 'homework.{0,25}(\\<not\\b|n\'t|never|missing|incomplete|unfinished|half)', '(\\<not|n\'t|never|forgot|forgets|without|\\<no) .{0,25}homework', 'unprepared', 'didn\'?t (study|revise|learn (the|' + P + ') words)', 'hasn\'?t studied'],
        gr: ['δεν.{0,20}(εργασι|ασκησ)', 'δεν (εκανε|κανει|εφερε|φερνει|εχει κανει) (την |τις )?(εργασι|ασκησ)', 'ξεχ[αν].{0,20}(εργασι|ασκησ)', '(εργασι|ασκησ)\\p{L}* (λειπ|δεν)', 'μισες (ασκησ|εργασ)', 'ελλιπ\\p{L}* (ασκησ|εργασ)', 'αδιαβαστ', 'δεν (ειχε )?διαβασ', 'δεν διαβαζει (στο σπιτι|καθολου|για)', 'δεν εμαθε τις λεξεις', 'δεν ηξερε τις λεξεις'],
        good: { en: ['(always|now) (does|brings|hands in) (' + P + ' |the )?homework', 'homework (is )?(always )?(done|complete|ready)'], gr: ['κανει (παντα |πλεον |πια )?τις (εργασι|ασκησ)', 'εκανε ολες τις ασκησ', 'διαβασμεν'] },
        techniques: ['homework-checkpoint', 'daily-report-card'],
        action: (n) => `Check ${n}'s homework quietly in the first minute, and praise any part that is done.`,
        examples: [['Forgot her workbook again and the homework was not done.', 'worry'], ['Δεν έκανε πάλι τις ασκήσεις.', 'worry'], ['Ήρθε αδιάβαστος.', 'worry'], ['Κάνει πλέον τις ασκήσεις του.', 'better']] },

    { id: 'materials', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Forgets books and things', labelEl: 'Ξεχνά βιβλία και υλικά', icon: 'fa-bag-shopping',
        en: ['(forg[eo]t|forgets|didn\'?t bring|doesn\'?t bring|without|left) .{0,20}(workbook|copybook|book|notebook|pencil|pen\\b|case|materials|folder|dictionary)'],
        gr: ['ξεχ[αν].{0,25}(βιβλι|τετραδ|μολυβ|κασετιν|υλικ|φακελ|λεξικ)', 'δεν (εφερε|φερνει|εχει) (το |τα |την |τη )?(βιβλι|τετραδ|μολυβ|κασετιν|πραγματα|υλικ)'],
        good: { en: ['(always|now) brings (' + P + ' )?(book|things|materials)'], gr: ['φερνει (πλεον |παντα |πια )?(τα πραγματα|το βιβλι|τα βιβλι)'] },
        techniques: ['ready-kit'],
        action: (n) => `Keep a spare book and pencil ready for ${n}, without a fuss.`,
        examples: [['Δεν έφερε το βιβλίο του πάλι.', 'worry'], ['Forgot her workbook.', 'worry']] },

    { id: 'late', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Arrives late', labelEl: 'Αργεί να έρθει', icon: 'fa-clock',
        en: ['\\<late\\b', 'lateness', 'arrives? late', 'came late'],
        gr: ['αργει (να ερθει|στο μαθημα|παντα|συχνα)', 'αργησε', 'καθυστερ\\p{L}* (στο μαθημα|να ερθει|παλι)', 'αργοπορ', 'ηρθε (αργα|καθυστερημεν)', 'ερχεται (αργα|καθυστερημεν)'],
        good: { en: ['on time', 'punctual'], gr: ['στην ωρα (του|της)', 'ηρθε στην ωρα'] },
        techniques: ['bell-work'],
        action: (n) => `Have a starter task on the desk so ${n} can begin the moment they arrive.`,
        examples: [['Came late again.', 'worry'], ['Άργησε πάλι στο μάθημα.', 'worry']] },

    { id: 'attendance', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Often absent', labelEl: 'Λείπει συχνά', icon: 'fa-calendar-xmark',
        en: ['(often|frequently|keeps (being )?|always) absent', 'misses? (a lot of|many|lots of|so many) lessons', 'missed (two|three|four|several|many|\\d+) lessons', '(lots of|many|too many) absences'],
        gr: ['λειπει (συχνα|πολυ|παλι|ολο|συνεχεια)', 'εχει (πολλες|αρκετες) απουσι', 'εχασε (πολλα|δυο|τρια|αρκετα) μαθηματ', 'δεν ερχεται (συχνα|τακτικα|σταθερα)', 'απουσιαζει (συχνα|πολυ)'],
        techniques: ['welcome-back', 'missed-it-card'],
        action: (n) => `Hand ${n} a short "what you missed" card and welcome them back by name.`,
        examples: [['Λείπει συχνά από το μάθημα.', 'worry'], ['Missed three lessons this month.', 'worry']] },

    { id: 'effort', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Low effort', labelEl: 'Λίγη προσπάθεια', icon: 'fa-battery-quarter',
        en: ['lazy', 'doesn\'?t try', 'does not try', 'no effort', 'little effort', 'unmotivated', 'not interested', 'uninterested', 'can\'?t be bothered', 'minimum effort', 'bare minimum', 'doesn\'?t care', 'switched off', 'gave no effort'],
        gr: ['τεμπελ', 'δεν προσπαθ', 'καμια προσπαθ', 'ελαχιστη προσπαθ', 'αδιαφορ', 'δεν ενδιαφερ', 'δεν εχει ορεξη', 'βαριεται να', 'δεν τον ενδιαφερει', 'δεν την ενδιαφερει', 'δεν δινει σημασια', 'δεν κανει τιποτα', 'δεν δουλευει στην ταξη'],
        good: { en: ['more effort', 'tries harder', 'trying harder', 'more motivated'], gr: ['προσπαθει (περισσοτερο|πλεον|πια|πιο πολυ)', 'πιο πολυ (ορεξη|ενδιαφερον)', 'τωρα προσπαθ'] },
        techniques: ['success-first', 'choice-board', 'two-by-ten'],
        action: (n) => `Start ${n} on a task they can finish in five minutes, then raise it a step.`,
        examples: [['He is lazy and doesn\'t try.', 'worry'], ['Δεν δείχνει ενδιαφέρον, αδιαφορεί.', 'worry']] },

    { id: 'careless', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Rushes, careless mistakes', labelEl: 'Βιαστικός, απρόσεκτα λάθη', icon: 'fa-person-running',
        en: ['careless', 'rush(es|ed|ing)? (through|the|' + P + ')', 'in a (hurry|rush)', 'hurries', 'sloppy', 'messy (work|writing|handwriting)', 'doesn\'?t check ' + P + ' work', 'silly mistakes', 'without checking', 'wants? to finish first'],
        gr: ['βιαζεται', 'βιαστικ', 'απροσεκτ', 'απροσεξ', 'τσαπατσουλ', 'προχειρα (γραμμεν|δουλεμεν|φτιαγμεν)', 'γραφει προχειρα', 'προχειροδουλ', 'δεν ελεγχει', 'χωρις να (ελεγξει|κοιταξει)', 'λαθη (απο )?απροσεξ', 'θελει να τελειωσει πρωτ', 'ανορθογραφα απο βιασυνη'],
        good: { en: ['more careful', 'checks? ' + P + ' work', 'takes? ' + P + ' time'], gr: ['ελεγχει (πλεον|πια) (τα|την|τις)', 'δεν βιαζεται (πια|πλεον)'] },
        techniques: ['error-hunt', 'self-monitoring'],
        action: (n) => `Before ${n} hands in, ask for one "check stop": find and fix one mistake on their own.`,
        examples: [['Rushes through the exercises, lots of careless mistakes.', 'worry'], ['Είναι βιαστικός και τσαπατσούλης.', 'worry']] },

    { id: 'organisation', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Disorganised', labelEl: 'Ανοργάνωτος', icon: 'fa-box-archive',
        en: ['disorgani[sz]ed', 'unorgani[sz]ed', 'loses? ' + P + ' (things|stuff|papers|worksheets|handouts|copybook)', 'lost ' + P + ' (worksheet|copybook|notebook|handout)', 'messy (desk|bag|folder|copybook|notebook)', 'can\'?t find ' + P, 'forgets? (which|what) (page|exercise|homework)'],
        gr: ['ανοργανωτ', 'ακαταστατ', 'χανει (τα πραγματα|τις φωτοτυπ|τα φυλλα|το τετραδ|τα χαρτια)', 'εχασε (τη φωτοτυπ|το φυλλο|το τετραδ)', 'δεν βρισκει (το|τα|τη|την) ', 'σκορπια', 'μπερδευει τις σελιδ', 'δεν ξερει ποια (ασκηση|σελιδα)', 'αδυνατει να μαζεψει', 'δεν μαζευει τα πραγματα'],
        good: { en: ['more organi[sz]ed', 'tidier'], gr: ['πιο (οργανωμεν|τακτοποιημεν)'] },
        techniques: ['ready-kit', 'self-monitoring'],
        action: (n) => `Give ${n} one folder and a two-item checklist ("book open, page written") at the start.`,
        examples: [['Χάνει συνέχεια τις φωτοτυπίες, είναι ανοργάνωτος.', 'worry'], ['Very disorganised, loses his worksheets.', 'worry']] },

    { id: 'independence', kind: 'learning', sev: 1, group: 'habits', domain: 'habits', label: 'Working on their own', labelEl: 'Αυτονομία', icon: 'fa-person-walking',
        en: ['always (needs|asks for|wants) (help|me)', 'needs? (constant|a lot of|lots of|so much) (help|support|reassurance|guidance)', '(can\'?t|cannot|won\'?t|doesn\'?t) work (alone|on ' + P + ' own|independently)', 'waits? for (me|help) (to|before)', 'asks? me (constantly|all the time|again and again)', 'clingy', 'relies on (me|' + P + ' (partner|friend|neighbou?r))'],
        gr: ['ζηταει (συνεχεια|παντα|ολη την ωρα) βοηθει', 'θελει (συνεχεια|παντα) βοηθει', 'δεν (μπορει να )?δουλευει μον', 'δεν δουλευει (αυτονομα|ανεξαρτητα)', 'περιμενει (να του|να της|απο μενα|εμενα)', 'χρειαζεται (συνεχη|συνεχεια|πολλη|διαρκη) (βοηθει|καθοδηγησ|επιβεβαιωσ|στηριξ)', 'προσκολλαται (σε μενα|στους μεγαλους|στους ενηλικ|στη δασκαλα)', 'ακουμπαει (στον|στην) διπλαν'],
        good: { en: ['works? (independently|on ' + P + ' own|alone) (now|well|happily)', 'more independent', 'independent (worker|learner)'], gr: ['δουλευει (πλεον |πια |τωρα )?(μονος|μονη|αυτονομα|ανεξαρτητα)', 'πιο αυτονομ', 'αυτονομ\\p{L}* (μαθητ|πλεον|πια)'] },
        techniques: ['chunk-task', 'self-monitoring', 'think-pair-share'],
        action: (n) => `Give ${n} the first step only, walk away for two minutes, then come back and praise what they did alone.`,
        examples: [['Always needs help, can\'t work on his own.', 'worry'], ['Ζητάει συνέχεια βοήθεια.', 'worry'], ['Δουλεύει πλέον μόνη της.', 'better']] },

    { id: 'copying', kind: 'worry', sev: 1, group: 'habits', domain: 'habits', label: 'Copies answers', labelEl: 'Αντιγράφει', icon: 'fa-copy',
        en: ['cop(y|ies|ied|ying) (from|off) (' + P + ' )?(neighbou?r|partner|friend|classmate|the person)', 'cop(y|ies|ied|ying) (the )?answers', 'cheat(s|ed|ing)?\\b', 'looks? at (' + P + ' )?(neighbou?r|partner)\'?s (paper|answers|test)'],
        gr: ['αντιγραφ', 'αντεγραψ', 'σκονακ', 'κοιταζει (του|της|στου|στης) διπλαν', 'κλεβει (στο|στα|απο) (διαγωνισμα|τεστ)'],
        except: { en: ['cop(y|ies|ied|ying) (from|off) the (board|book)', 'cop(y|ies|ied|ying) the (words|sentences|title|date)'], gr: ['αντιγραφ\\p{L}* (απο τον πινακα|απο το βιβλιο|τις λεξεις|τον τιτλο)'] },
        techniques: ['self-monitoring', 'success-first'],
        action: (n) => `Seat ${n} where you can see the paper, and give a version they can do alone.`,
        examples: [['Αντιγράφει από τον διπλανό του στα τεστ.', 'worry'], ['Copied from his partner in the test.', 'worry']] },

    // ---------------------------------------------------------------- Friends and feelings
    { id: 'conflict', kind: 'worry', sev: 2, group: 'behaviour', domain: 'feelings', label: 'Friction with classmates', labelEl: 'Τσακώνεται με συμμαθητές', icon: 'fa-people-arrows',
        en: ['fight', 'fought', 'argu(es|ed|ing)\\b', 'arguments? with', 'quarrel', 'tease', 'teasing', 'teased', 'bull(y|ies|ied|ying)', 'push(es|ed)? ', 'pushing', 'hit(s|ting)? ', 'kick(s|ed|ing)?\\b', 'punch', 'mean to', 'picks? on', 'calls? (him|her|them) names', 'name[- ]calling', 'falls? out with', 'fell out with', 'excludes? (others|' + S + ')'],
        gr: ['μαλων', 'μαλωσ', 'καβγ', 'καυγ', 'τσακων', 'τσακωθ', 'πειραζ', 'κοροιδ', 'χτυπ', 'κτυπ', 'σπρωχν', 'σπρωξ', 'κλωτσ', 'βρισ', 'εκφοβι', 'μπουλινγκ', 'δεν σεβεται τον (προσωπικο )?χωρο', 'καταστρεφει (τα πραγματα|τα)', 'εχει συγκρουσεις', 'μαρτυρ', 'καρφων'],
        good: { en: ['(gets on|getting on|plays nicely|made up|friends again) with'], gr: ['τα βρηκαν', 'ειναι φιλοι (πια|ξανα)', 'παιζουν (μαζι|ωραια)', 'τα πανε καλα'] },
        techniques: ['restorative-chat', 'seat-plan'],
        action: (n) => `Seat ${n} away from the classmates in your notes, and greet them warmly at the door.`,
        examples: [['Μάλωσε με τον Νίκο στο διάλειμμα.', 'worry'], ['Giorgos argued with Fotis over the cards.', 'worry']] },

    { id: 'bossy', kind: 'worry', sev: 1, group: 'behaviour', domain: 'feelings', label: 'Bossy in groups', labelEl: 'Θέλει να διατάζει', icon: 'fa-crown',
        en: ['bossy', 'bosses (others|the others|everyone)', 'dominat(es|ing)', 'takes? over (the group|group work|the game|the task)', 'orders? (others|everyone|the others) around', 'always wants to be (first|in charge|the leader)', 'sore loser', 'can\'?t lose', 'has to win'],
        gr: ['θελει να διαταζ', 'διαταζει', 'επιβαλλεται', 'αφεντικ', 'κανει κουμαντο', 'θελει να ειναι (παντα )?(πρωτ|αρχηγ)', 'θελει (παντα )?να κερδιζ', 'δεν δεχεται (να )?χαν', 'κακος χαμενος', 'θελει (ολα|τα παντα) οπως', 'δεν αφηνει τους αλλους'],
        techniques: ['numbered-heads', 'expert-role', 'good-behaviour-game'],
        action: (n) => `Give ${n} a group role with a limit (timekeeper, not leader) and praise listening to others.`,
        reframe: 'Wants to lead: teach it as a job with rules.',
        examples: [['Θέλει να διατάζει τους άλλους στην ομάδα.', 'worry'], ['Very bossy in group work.', 'worry']] },

    { id: 'isolated', kind: 'worry', sev: 2, group: 'wellbeing', domain: 'feelings', label: 'Alone or left out', labelEl: 'Μόνος, απομονωμένος', icon: 'fa-user',
        en: ['plays? alone', 'on ' + P + ' own at break', 'left out', 'no friends', 'hasn\'?t (got|made) (any )?friends', 'isolated', 'lonely', 'keeps? to ' + S + 'sel(f|ves)', 'withdrawn', 'excluded', 'nobody (plays|sits|wants to)', '(others|classmates|the class) (don\'?t|won\'?t) (play|sit|work) with'],
        gr: ['παιζει μον', 'μονος του στο', 'μονη της στο', 'απομονων', 'απομονωμεν', 'δεν εχει φιλ', 'δεν κανει (παρεα|φιλ)', 'μοναχικ', 'δεν (τον|την) (παιζουν|θελουν)', '(τον|την) αποκλειουν', 'αποφευγει (τους αλλους|τα αλλα παιδια|τις κοινωνικ)', 'αργει να εξοικειωθ', 'δεν ανταποκρινεται (στους|στα)'],
        good: { en: ['made (a )?(new )?friends?', 'plays? with (the others|everyone|classmates) now'], gr: ['εκανε (καινουργι|νεους )?φιλ', 'παιζει (πλεον|πια) με'] },
        techniques: ['structured-play', 'buddy', 'two-by-ten'],
        action: (n) => `Plan ${n}'s partner for pair work (a kind one) instead of "find a partner".`,
        examples: [['Παίζει μόνος του στο διάλειμμα.', 'worry'], ['Seems lonely, plays alone at break.', 'worry']] },

    { id: 'shy', kind: 'worry', sev: 1, group: 'wellbeing', domain: 'feelings', label: 'Shy to speak', labelEl: 'Ντροπαλός', icon: 'fa-user-secret',
        en: ['\\<shy', 'timid', 'very quiet', 'too quiet', 'hardly (speaks|talks)', 'doesn\'?t (speak|talk|participate)', 'rarely (speaks|participates|answers)', 'reserved', 'hesitant', 'doesn\'?t raise ' + P + ' hand', 'speaks? (very )?(quietly|softly)', 'silent in (class|lessons)', 'afraid to speak'],
        gr: ['ντροπαλ', 'ντρεπεται', 'σιωπηλ', 'διστακτικ', 'δεν μιλα', 'δεν συμμετεχει', 'κλειστο παιδι', 'κλειστη', 'συνεσταλμ', 'αποφευγει να μιλ', 'δεν σηκωνει (το )?χερι', 'μιλαει (πολυ )?σιγα', 'δεν ανοιγεται', 'φοβαται να μιλησει', 'δεν απανταει'],
        good: { en: ['more confident', 'speaks (more|up)', 'less shy', 'participates more', 'raises? ' + P + ' hand', 'opened up', 'is opening up'],
            gr: ['πιο (θαρρετ|σιγουρ|ανοιχτ)', 'συμμετεχει (περισσοτερο|πια|πλεον)', 'μιλαει (πια|πλεον|περισσοτερο)', 'ανοιχτηκε', 'σηκωνει (πλεον|πια) το χερι'] },
        techniques: ['choral-drill', 'think-pair-share'],
        action: (n) => `Let ${n} rehearse with a partner first, then ask them a question you know they can answer.`,
        examples: [['Dora is very shy.', 'worry'], ['Πολύ ντροπαλή, δεν σηκώνει χέρι.', 'worry'], ['More confident with Maria.', 'better']] },

    { id: 'worry', kind: 'worry', sev: 2, group: 'wellbeing', domain: 'feelings', label: 'Anxious or low', labelEl: 'Άγχος, στενοχώρια', icon: 'fa-cloud-rain',
        en: ['anxious', 'anxiety', 'nervous', 'stressed', 'worri(ed|es)', 'afraid', 'scared', 'cries', 'cried', 'crying', 'tearful', 'sad\\b', 'unhappy', 'low confidence', 'lacks? confidence', 'insecure', 'panics?', 'stomach ?aches?', 'headaches? before'],
        gr: ['αγχ', 'φοβαται', 'φοβηθηκε', 'φοβισμεν', 'τρομαγμεν', 'ανησυχει (για|πολυ|οτι|συνεχεια)', 'ανησυχη', 'κλαι', 'εκλαψε', 'στεναχωρ', 'στενοχωρ', 'λυπημεν', 'δυστυχισμεν', 'αυτοπεποιθ', 'ανασφαλ', 'παραπονιεται οτι (ειναι αρρωστ|πονα)', 'πονοκεφαλ', 'πονοκοιλ', 'πανικ'],
        good: { en: ['calmer', 'more relaxed', 'happier', 'more settled', 'smiling more'], gr: ['πιο (ηρεμ|χαρουμεν|χαλαρ)', 'χαμογελαει (πια|πλεον|περισσοτερο)'] },
        techniques: ['calm-corner', 'success-first'],
        action: (n) => `A quiet word with ${n} at the start, and a low-stakes first task.`,
        examples: [['Eleni was anxious before the test and cried.', 'worry'], ['Έχει άγχος πριν τα τεστ.', 'worry']] },

    { id: 'selftalk', kind: 'worry', sev: 2, group: 'wellbeing', domain: 'feelings', label: 'Gives up, "I can\'t"', labelEl: 'Τα παρατάει, «δεν μπορώ»', icon: 'fa-cloud',
        en: ['says? "?i can\'?t', '"i can\'?t','says? (that )?(he|she|they) (can\'?t|is (bad|stupid|useless)|are (bad|stupid))', 'puts? ' + S + 'sel(f|ves) down', 'gives? up (easily|quickly|straight away|at once|immediately)', 'self[- ]esteem', 'thinks? (he|she|they) (is|are) (not good|bad|stupid)', 'negative about ' + S + 'sel', 'easily discouraged', 'discouraged', 'afraid of (making )?mistakes', 'fear of failure'],
        gr: ['λεει .{0,3}δεν (μπορω|ξερω|ειμαι καλ)', 'λεει (οτι )?δεν (μπορει|ξερει|ειναι καλ)', 'υποτιμα τον εαυτο', 'υποτιμητικ\\p{L}* (σχολια )?για τον εαυτο', 'αποθαρρυν', 'απογοητευεται (ευκολα|γρηγορα)', 'τα παραταει', 'τα παρατησε', 'τα παραταω', 'δεν πιστευει (στον|στην) εαυτο', 'φοβαται (το|τα) λαθ', 'φοβαται να κανει λαθ', 'χαμηλη αυτοεκτιμ'],
        good: { en: ['tries again', 'had a go', 'more resilient', 'believes in ' + S + 'self'], gr: ['ξαναπροσπαθ', 'πιστευει (πιο πολυ )?στον εαυτο', 'δεν τα παραταει (πια|πλεον)'] },
        techniques: ['growth-talk', 'success-first', 'specific-praise'],
        action: (n) => `When ${n} says "I can't", add "yet", and set a first step they can win in a minute.`,
        examples: [['Λέει συνέχεια «δεν μπορώ» και τα παρατάει.', 'worry'], ['Gives up easily and puts himself down.', 'worry']] },

    { id: 'temper', kind: 'worry', sev: 2, group: 'wellbeing', domain: 'feelings', label: 'Frustration and temper', labelEl: 'Θυμός, εκνευρισμός', icon: 'fa-fire',
        en: ['frustrat', 'angry', 'anger', 'temper', 'tantrum', 'meltdown', 'outburst', 'upset when', 'gets? (very |really )?upset', 'loses? ' + P + ' (temper|cool)', 'storms? off', 'throws? (things|' + P + ')'],
        gr: ['θυμων', 'θυμωσ', 'θυμωμεν', 'με θυμο', 'νευρ', 'εκνευρ', 'ξεσπα', 'χανει (ευκολα )?την ψυχραιμ', 'αναστατωνεται', 'εκρηκτικ', 'πεταει (τα πραγματα|το μολυβι|το βιβλιο)', 'κανει σκηνη', 'χτυπαει (το θρανιο|τα πραγματα)'],
        good: { en: ['calmer', 'more patient', 'keeps ' + P + ' cool', 'calmed (himself|herself|themselves) down'], gr: ['πιο ηρεμ', 'ηρεμησε', 'πιο υπομονετικ', 'κρατησε την ψυχραιμ'] },
        techniques: ['calm-corner', 'success-first'],
        action: (n) => `Start ${n} on a task they can finish, and offer a calm minute before it boils over.`,
        examples: [['Θυμώνει εύκολα και χάνει την ψυχραιμία του.', 'worry'], ['Had a tantrum when he lost the game.', 'worry']] },

    { id: 'tired', kind: 'worry', sev: 1, group: 'wellbeing', domain: 'feelings', label: 'Tired in lessons', labelEl: 'Κουρασμένος', icon: 'fa-bed',
        en: ['tired', 'sleepy', 'exhausted', 'yawn', 'falls? asleep', 'no energy'],
        gr: ['κουρασμεν', 'κουραση', 'νυσταζ', 'νυσταγμεν', 'νυστα', 'κοιμαται', 'χασμουρ'],
        good: { en: ['more (awake|alert|energetic)'], gr: ['πιο ξεκουραστ'] },
        techniques: ['brain-break', 'tpr-warmup'],
        action: (n) => `Give ${n} an active job early (handing out, board writer).`,
        examples: [['Ήταν κουρασμένος σήμερα.', 'worry'], ['Very tired, yawning all lesson.', 'worry']] },

    // ---------------------------------------------------------------- Background (private)
    { id: 'newcomer', kind: 'context', sev: 1, group: 'wellbeing', domain: 'background', label: 'New to the class', labelEl: 'Νέος στην τάξη', icon: 'fa-door-open',
        en: ['new (student|pupil|to the class|to our class|this year|to the school)', 'just joined', 'joined (us|the class)'],
        gr: ['νεος μαθητ', 'νεα μαθητρ', 'καινουργι(ος|α) (μαθητ|στην ταξη)', 'ηρθε φετος', 'μετεγγραφ', 'νεο παιδι στην ταξη', 'μολις ηρθε'],
        techniques: ['buddy', 'welcome-back'],
        action: (n) => `Pair ${n} with a kind helper for today's pair work.`,
        examples: [['New student, just joined from another school.', 'context']] },

    { id: 'support', kind: 'context', sev: 1, group: 'wellbeing', domain: 'background', label: 'Learning support need', labelEl: 'Μαθησιακή υποστήριξη', icon: 'fa-universal-access',
        en: ['dyslex', 'adhd', 'attention deficit', 'learning (difficult|disabilit|need)', 'special (needs|education)', 'diagnos', 'assessment centre', 'speech therap', 'occupational therap', 'sen\\b support', 'autis', 'asperger'],
        gr: ['δυσλεξ', 'δεπυ', 'μαθησιακ\\p{L}* (δυσκολι|διαταραχ)', 'ειδικ(ες|η) (εκπαιδευτικ|μαθησιακ|αναγκ)', 'διαγνωσ', 'κεδασυ', 'κεπεα', 'κδαυ', 'γνωματευσ', 'λογοθεραπ', 'εργοθεραπ', 'αυτισμ', 'ελλειμματικ'],
        techniques: ['access-adjust', 'chunk-task'],
        action: (n) => `Give ${n} the adjusted version: bigger print, fewer items, a little more time.`,
        examples: [['Has a dyslexia diagnosis from the assessment centre.', 'context'], ['Έχει γνωμάτευση από το ΚΕΔΑΣΥ για δυσλεξία.', 'context']] },

    { id: 'home', kind: 'context', sev: 2, group: 'wellbeing', domain: 'background', label: 'Home or health situation', labelEl: 'Οικογένεια ή υγεία', icon: 'fa-house-chimney-crack',
        en: ['divorc', 'parents (are )?separat', 'separated parents', 'hospital', '\\<ill\\b', 'illness', 'surgery', 'passed away', '\\<died\\b', 'bereave', 'family (problem|issue|situation|crisis)', 'moved house', 'new baby', 'grandparent (died|passed)'],
        gr: ['διαζυγ', 'χωρισαν', 'χωριζουν', 'χωρισμενοι γονεις', 'νοσοκομει', 'αρρωστ', 'εγχειρησ', 'χειρουργ', 'πεθαν', 'απεβιωσ', 'πενθ', 'οικογενειακ(ο|α|ες) (θεμα|θεματα|προβλημ)', 'μετακομισ', 'νεο μωρο'],
        techniques: ['check-in', 'two-by-ten'],
        action: (n) => `A gentle, private check-in with ${n}. No pressure today.`,
        examples: [['Her parents are going through a divorce.', 'context'], ['Οι γονείς του χώρισαν πρόσφατα.', 'context']] },

    // ---------------------------------------------------------------- Learning English
    { id: 'spelling', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Spelling', labelEl: 'Ορθογραφία', icon: 'fa-spell-check', paper: 'dictation',
        en: ['spell', 'misspel'], gr: ['ορθογραφ', 'ανορθογραφ', 'λαθη στις λεξεις'],
        techniques: ['look-cover-write', 'phonics-chunks'],
        action: (n) => `Three tricky words for ${n} with look, say, cover, write, check.`,
        examples: [['Excellent spelling in the dictation!', 'strength'], ['Struggles with spelling, many mistakes.', 'worry'], ['Πολλά ορθογραφικά λάθη στην υπαγόρευση.', 'worry']] },

    { id: 'reading', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Reading', labelEl: 'Ανάγνωση', icon: 'fa-book-open-reader', paper: 'test',
        en: ['reading', 'reads? (slow|well|aloud|fluent|word by word)', 'decod'],
        gr: ['αναγνωσ', 'διαβαζει (πολυ |παρα πολυ |αρκετα |πιο )?(αργα|καλα|δυνατα|συλλαβιστα|κομπιαζ|με ευχερει|ωραια|γρηγορα)', 'διαβασμα (κειμεν|δυνατ)', 'δυσκολευεται να διαβασ', 'κομπιαζ', 'συλλαβιζ'],
        except: { en: [], gr: ['διαβαζ\\p{L}* (στο σπιτι|για (το|τα|τη)|καθολου|τα μαθηματα)'] },
        techniques: ['paired-reading', 'pre-teach'],
        action: (n) => `Pair ${n} with a steady reader for the text, and pre-teach two words.`,
        examples: [['Reads slowly, word by word, and struggles.', 'worry'], ['Διαβάζει πολύ ωραία και με ευχέρεια!', 'strength']] },

    { id: 'writing', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Writing', labelEl: 'Γραφή', icon: 'fa-pen-nib', paper: 'test',
        en: ['writing', 'writes', 'sentences?\\b', 'paragraph', 'composition', 'essay', 'handwriting'],
        gr: ['γραφει (λιγο|ελαχιστ|καλα|ωραια|μονο|προτασ)', 'γραψιμο', 'γραπτ', 'εκθεσ', 'προτασ', 'γραφικο χαρακτηρα', 'παραγραφ'],
        techniques: ['model-text', 'sentence-frames'],
        action: (n) => `Give ${n} a model sentence to copy the shape of, then change two words.`,
        examples: [['Writing in class.', 'worry', 'Academic'], ['Η έκθεσή της ήταν εξαιρετική!', 'strength']] },

    { id: 'speaking', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Speaking', labelEl: 'Προφορικός λόγος', icon: 'fa-comments',
        en: ['speaking', 'speaks', 'fluen', 'oral', 'conversation', 'role ?play'],
        gr: ['προφορικ', 'ομιλια', 'μιλαει αγγλικα', 'μιλα αγγλικα', 'ευχερει\\p{L}* (στον λογο|στα αγγλικα|στην ομιλια)', 'μιλαει με ευχερει'],
        techniques: ['sentence-frames', 'choral-drill'],
        action: (n) => `Give ${n} a sentence frame and a partner rehearsal before speaking.`,
        examples: [['Very good speaking in the role play!', 'strength'], ['Ο προφορικός του χρειάζεται δουλειά.', 'worry']] },

    { id: 'pronunciation', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Pronunciation', labelEl: 'Προφορά', icon: 'fa-volume-high',
        en: ['pronunc', 'accent\\b', 'mispronounc'], gr: ['προφορα', 'προφερει'],
        techniques: ['minimal-pairs', 'choral-drill'],
        action: (n) => `Two minimal pairs with ${n} (ship/sheep) during the warm-up.`,
        examples: [['Pronunciation of th is weak.', 'worry'], ['Πολύ καλή προφορά!', 'strength']] },

    { id: 'grammar', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Grammar', labelEl: 'Γραμματική', icon: 'fa-diagram-project', paper: 'test',
        en: ['grammar', 'tenses?\\b', 'verb forms?', 'present simple', 'past simple', 'irregular verbs', 'third person', 'plurals'],
        gr: ['γραμματικ', 'χρονους', 'χρονων', 'ρηματ', 'ανωμαλα ρηματα', 'τριτο προσωπο', 'πληθυντικ'],
        techniques: ['guided-discovery', 'recast'],
        action: (n) => `Give ${n} three examples of the pattern and let them spot the rule.`,
        examples: [['Mixes up the tenses, grammar is weak.', 'worry'], ['Μπερδεύει τους χρόνους.', 'worry']] },

    { id: 'vocabulary', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Vocabulary', labelEl: 'Λεξιλόγιο', icon: 'fa-font', paper: 'dictation',
        en: ['vocabular', 'new words', 'word(s)? (learn|memor)', '(doesn\'?t|didn\'?t|can\'?t) (know|remember) the words'],
        gr: ['λεξιλογ', 'λεξεις', 'λεξουλ', 'δεν (θυμαται|ξερει|ηξερε) (τις )?λεξ'],
        techniques: ['word-wall', 'retrieval-starter'],
        action: (n) => `Ask ${n} two words from the word wall at the start.`,
        examples: [['Has a rich vocabulary, very good!', 'strength'], ['Δεν θυμάται τις λέξεις.', 'worry']] },

    { id: 'listening', kind: 'learning', sev: 1, group: 'learning', domain: 'learning', label: 'Listening', labelEl: 'Κατανόηση προφορικού', icon: 'fa-headphones',
        en: ['listening', 'understand(s|ing)? (instructions|what)', 'doesn\'?t understand', 'didn\'?t understand', 'needs? (instructions|everything) (in greek|translated)'],
        gr: ['ακουστικ', 'καταλαβαινει', 'δεν καταλαβ', 'κατανοησ', 'δεν καταλαβαινει τις οδηγι', 'θελει (να του|να της) τα (πω|λεω) στα ελληνικα'],
        techniques: ['listen-for-three', 'tpr-warmup'],
        action: (n) => `Check ${n} understood the instruction: ask them to show you the first step.`,
        examples: [['Doesn\'t understand the instructions in English.', 'worry'], ['Καταλαβαίνει πολύ καλά!', 'strength']] },

    { id: 'greek', kind: 'worry', sev: 1, group: 'learning', domain: 'learning', label: 'Falls back on Greek', labelEl: 'Μιλάει ελληνικά', icon: 'fa-language',
        en: ['speaks? (in )?greek', 'in greek', 'answers? in greek', 'translates? (everything|it all|into greek)', 'asks? (me )?to translate', 'uses? greek'],
        gr: ['μιλαει (στα )?ελληνικα', 'απανταει (στα )?ελληνικα', 'ελληνικα στο μαθημα', 'θελει (να του |να της )?μεταφρασ', 'ζηταει (να του |να της )?μεταφρασ', 'μεταφραζει (τα παντα|ολα|καθε λεξη)', 'μιλα ελληνικα'],
        good: { en: ['now (tries|tries hard) (to speak|in) english', 'answers in english', 'speaks? english (now|more)'], gr: ['μιλαει (πλεον|πια|περισσοτερο) αγγλικα', 'απανταει (πλεον|πια) (στα )?αγγλικα'] },
        techniques: ['greek-bridge', 'sentence-frames'],
        action: (n) => `Give ${n} the English frame on a card ("Can I…?", "I think…") and accept the Greek once, then the English.`,
        examples: [['Μιλάει ελληνικά στο μάθημα.', 'worry'], ['Answers in Greek most of the time.', 'worry']] },

    // ---------------------------------------------------------------- Strengths
    { id: 'helper', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Kind helper', labelEl: 'Βοηθά τους άλλους', icon: 'fa-hands-holding-child',
        en: ['helps? (others|everyone|classmates|friends|the class|a classmate|the others|' + P + ' (partner|friend|neighbou?r))', 'helpful', 'kind\\b', 'kindness', 'caring', 'generous', 'shares? (' + P + ' )?(things|pencils|snacks|ideas)', 'supportive', 'thoughtful'],
        gr: ['βοηθα', 'βοηθαει', 'βοηθησε', 'καλοσυνατ', 'προθυμ', 'νοιαζεται', 'μοιραζεται', 'στηριζει (τους|τα) (συμμαθητ|αλλα παιδια)', 'ευαισθητ\\p{L}* (με|στους)', 'καλη καρδια'],
        except: { en: ['(needs|asks for|wants) help', 'kind of'], gr: ['(ζηταει|θελει|χρειαζεται) (συνεχεια |παντα )?βοηθει', 'να (τον|την|τους) βοηθ'] },
        techniques: ['buddy', 'expert-role'],
        examples: [['Helps others with the new words.', 'strength'], ['Βοηθάει πάντα τους συμμαθητές της.', 'strength']] },

    { id: 'polite', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Polite and respectful', labelEl: 'Ευγενικός', icon: 'fa-handshake', mirror: 'respect',
        en: ['polite', 'well-?mannered', 'respectful', 'good manners', 'says? (please|thank you)', 'courteous'],
        gr: ['ευγενικ', 'ευγενεια', 'με τροπους', 'σεβεται (τους|τον|την|τα|ολους)', 'λεει (ευχαριστω|παρακαλω)', 'σεβασμ\\p{L}* (στους|προς)'],
        techniques: ['specific-praise', 'expert-role'],
        examples: [['Πολύ ευγενικό παιδί.', 'strength'], ['Always polite and respectful.', 'strength']] },

    { id: 'leader', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Natural leader', labelEl: 'Ηγετικός', icon: 'fa-flag',
        en: ['leader', 'leads? (the|' + P + ')', '\\<organis(es|ing) (the|' + P + ')', '\\<organiz(es|ing) (the|' + P + ')', 'takes? charge', 'responsible for the group'],
        gr: ['ηγετικ', 'οργανωνει (την|τους|το)', 'συντονιζ', 'αναλαμβανει (πρωτοβουλι|ρολο|την ομαδα)'],
        techniques: ['expert-role', 'numbered-heads'],
        examples: [['A natural leader in group work.', 'strength'], ['Συντονίζει την ομάδα του πολύ ωραία.', 'strength']] },

    { id: 'creative', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Creative', labelEl: 'Δημιουργικός', icon: 'fa-palette',
        en: ['creativ', 'imaginat', 'original ideas', 'artistic', 'inventive'], gr: ['δημιουργικ', 'φαντασια', 'ευρηματικ', 'πρωτοτυπ', 'καλλιτεχνικ'],
        techniques: ['creative-twist', 'draw-describe'],
        examples: [['Very creative story!', 'strength'], ['Έχει μεγάλη φαντασία.', 'strength']] },

    { id: 'eager', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Eager to take part', labelEl: 'Πρόθυμος να συμμετέχει', icon: 'fa-hand-sparkles',
        en: ['eager', 'enthusias', 'participat(es|ed) (a lot|well|actively|enthusiastically)', 'always (ready|volunteers|raises)', 'volunteer', 'motivated', 'keen', 'lively (discussion|participation|contribution|interest)', 'loves? (english|the lessons|the class|coming)'],
        gr: ['ενθουσια', 'συμμετεχει (ενεργα|πολυ|με ορεξη|με ενθουσιασμο|παντα)', 'πρωτος να', 'πρωτη να', 'ορεξη', '\\<ενεργα', '\\<ενεργος', '\\<ενεργη', 'ζωηρ\\p{L}* (συμμετοχ|ενδιαφερ)', 'ζωηρο ενδιαφερ', 'λατρευει τα αγγλικα', 'του αρεσει πολυ το μαθημα', 'της αρεσει πολυ το μαθημα'],
        except: { en: [], gr: ['δεν εχει ορεξη', 'χωρις ορεξη'] },
        techniques: ['expert-role'],
        examples: [['ζωηρή συμμετοχή στο μάθημα', 'strength'], ['A lively discussion, she was very eager.', 'strength'], ['Συμμετέχει ενεργά.', 'strength']] },

    { id: 'ahead', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Ahead, needs stretch', labelEl: 'Προχωρημένος, θέλει πρόκληση', icon: 'fa-rocket',
        en: ['finishes? (early|first|quickly)', 'bored', 'too easy', 'gifted', 'advanced', 'very strong', 'top of the class', 'ahead of', 'needs? (more )?challenge', 'excellent level'],
        gr: ['τελειωνει (πρωτ|γρηγορ|νωρις)', 'βαριεται', 'πολυ ευκολ', 'προχωρημεν', 'ταλεντ', '\\<αριστος', '\\<αριστη', '\\<αριστα(?!\\p{L})', 'αριστουχ', 'χρειαζεται (περισσοτερη )?προκληση', 'πολυ δυνατ(ος|η) μαθητ'],
        except: { en: [], gr: ['βαριεται να'] },
        techniques: ['must-should-could', 'extension-question'],
        examples: [['Finishes early and gets bored, needs a challenge.', 'strength'], ['Τελειώνει πρώτος, θέλει πρόκληση.', 'strength']] },

    { id: 'diligent', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Hard-working', labelEl: 'Επιμελής, εργατικός', icon: 'fa-medal', mirror: 'effort',
        en: ['hard-?working', 'works? (very )?hard', 'diligent', 'conscientious', 'reliable', 'well-?prepared', 'always prepared', 'neat (work|copybook|handwriting)', 'tidy work', 'methodical', 'puts? in (a lot of |great )?effort', 'great effort', '\\<organi[sz]ed (worker|student|learner|and)'],
        gr: ['επιμελ', 'εργατικ', 'συνεπ(ης|ης|η|εια)', 'μεθοδικ', 'υπευθυν', 'προσπαθει πολυ', 'δουλευει (πολυ|σκληρα|συστηματικα)', 'προετοιμασμεν', 'καθαρο τετραδιο', 'ωραια γραμματα', 'φιλοτιμ', 'ευσυνειδητ', 'διαβαζει (παντα|ταχτικα|τακτικα|πολυ)'],
        techniques: ['specific-praise', 'postcard-home'],
        examples: [['Very hard-working and well prepared.', 'strength'], ['Πολύ επιμελής και συνεπής.', 'strength']] },

    { id: 'curious', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Curious, asks questions', labelEl: 'Περιέργεια, ρωτάει', icon: 'fa-magnifying-glass',
        en: ['curious', 'curiosity', 'asks? (lots of|good|great|many|interesting|clever|thoughtful) questions', 'inquisitive', 'wants? to know (more|why|everything)', 'interested in (everything|learning|new words)'],
        gr: ['περιεργεια', 'περιεργ\\p{L}* (για|να μαθ)', 'κανει (ωραιες|εξυπνες|πολλες|καλες) ερωτησ', 'ρωταει (εξυπνα|ωραια πραγματα)', 'θελει να μαθαινει', 'ενδιαφερεται (για|να)', 'δειχνει ενδιαφερον'],
        techniques: ['extension-question', 'expert-role'],
        examples: [['Asks great questions, very curious.', 'strength'], ['Κάνει έξυπνες ερωτήσεις.', 'strength']] },

    { id: 'resilient', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Keeps trying', labelEl: 'Επιμένει, δεν τα παρατάει', icon: 'fa-mountain', mirror: 'selftalk',
        en: ['persever', 'keeps? trying', 'doesn\'?t give up', 'never gives up', 'tries again', 'resilient', 'determined', 'persistent', 'bounces? back', 'does not give up'],
        gr: ['επιμονη', 'επιμονος', 'επιμενει', 'δεν τα παραταει( ποτε)?', 'ποτε δεν τα παραταει', 'δεν το βαζει κατω', 'προσπαθει ξανα', 'ξαναπροσπαθ', 'δεν απογοητευεται', 'δεν τα παρατησε'],
        techniques: ['specific-praise', 'growth-talk'],
        examples: [['Never gives up, keeps trying.', 'strength'], ['Δεν τα παρατάει ποτέ.', 'strength']] },

    { id: 'attentive', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Attentive', labelEl: 'Προσεκτικός', icon: 'fa-bullseye', mirror: 'focus',
        en: ['attentive', 'listens? (carefully|well|attentively)', '(very|always) focused', 'careful worker', 'concentrates? (very )?well'],
        gr: ['προσεκτικ', 'συγκεντρωμεν', 'προσηλωμεν', 'ακουει προσεκτικα', 'παρακολουθει (με προσοχη|προσεκτικα)'],
        techniques: ['expert-role', 'extension-question'],
        examples: [['Always attentive and listens carefully.', 'strength'], ['Πολύ προσεκτική στο μάθημα.', 'strength']] },

    { id: 'progress', kind: 'strength', group: 'strength', domain: 'strengths', label: 'Making progress', labelEl: 'Προοδεύει', icon: 'fa-arrow-trend-up',
        en: ['improv', 'progress', 'much better', 'getting better', 'big step', 'came a long way'], gr: ['βελτιω', 'προοδ', 'πολυ καλυτερ', 'καλυτερευ', 'ανεβηκε'],
        techniques: ['postcard-home'],
        examples: [['Great progress this month!', 'strength'], ['Έχει βελτιωθεί πολύ.', 'strength']] }
];

// ---------------------------------------------------------------- tone words

/** Words that praise, worry, put the worry on the skill itself, or say it is getting better. */
export const TONE_WORDS = {
    praise: {
        en: ['great', 'excellent', 'well done', 'proud', 'brilliant', 'wonderful', 'fantastic', 'amazing', 'lovely', 'impressive', 'very good', 'good at', 'strong', 'confident', 'superb', 'perfect', 'beautiful', 'fluent'],
        gr: ['μπραβο', 'εξαιρετ', 'τελει', 'πολυ καλ', 'υπεροχ', 'θαυμασ', 'περηφαν', 'δυνατ(ος|η) στ', 'σιγουρ', 'ωραια', 'ωραιο', 'αψογ', 'ευχερει', 'καταπληκτ', 'φοβερ(ος|η|ο) ', 'πολυ ωραι']
    },
    concern: {
        en: ['\\<not\\b', 'n\'t', 'never', 'struggl', 'difficult', 'hard for', 'problem', 'issue', 'weak', 'poor', 'again', 'keeps (forgetting|losing|talking|interrupting|making)', 'refus', 'worse', 'careless', 'mistakes', 'slow', 'behind', 'below', 'needs (help|support|practice|work)'],
        gr: ['αργ(ος|η|α|ει)', 'πισω', 'χρειαζεται (βοηθ|εξασκ|δουλει)', '\\<δεν(?!\\p{L})', 'δυσκολ', 'προβλημα', 'αδυναμ', 'αδυνατ', 'ξανα', 'συνεχεια', 'αρνειται', 'ποτε', 'χειροτερ', 'λαθη', 'απροσεξ', 'μπερδευ', 'παλι']
    },
    skillConcern: {
        en: ['struggl', 'difficult', 'trouble', 'weak', 'poor', 'mistakes', 'errors', 'can\'?t (read|write|spell)', 'mix(es)? up', 'confus'],
        gr: ['δυσκολ', 'λαθη', 'λαθος', 'αδυναμ', 'μπερδευ', 'χρειαζεται δουλει']
    },
    better: {
        en: ['improv', 'better', 'progress', 'more (focused|confident|careful|settled|polite|independent|organi[sz]ed)', 'less (chatty|shy|nervous|rude)', 'now (does|brings|speaks|participates|sits|listens|follows)'],
        gr: ['βελτιω', 'καλυτερ', 'προοδ', 'πιο (συγκεντρωμ|σιγουρ|ηρεμ|προσεκτικ|ησυχ|ευγενικ|αυτονομ|οργανωμεν)', 'λιγοτερο (φλυαρ|ντροπαλ|αγχ)']
    }
};

/**
 * Short Greek → English meanings of common teacher words, for the AI prompts: the counsels read
 * the notes themselves, and these words are easy to misread out of a Greek classroom.
 */
export const GREEK_GLOSSARY = [
    ['ζωηρός / ζωηράδα', 'very lively, restless; in teacher notes usually a polite word for hard to settle or disruptive'],
    ['άτακτος, σκανταλιάρης', 'naughty, mischievous'],
    ['υπερκινητικός', 'hyperactive (a description, not a diagnosis)'],
    ['αφηρημένος', 'distracted, daydreaming'],
    ['φλύαρος', 'chatty, talks a lot'],
    ['ντροπαλός, κλειστό παιδί', 'shy, reserved'],
    ['αγχώδης / έχει άγχος', 'anxious'],
    ['επιμελής, εργατικός, συνεπής', 'diligent, hard-working, consistent'],
    ['τεμπέλης, αδιαφορεί', 'lazy, uninterested'],
    ['αδιάβαστος', 'came without studying'],
    ['τσαπατσούλης, βιαστικός', 'sloppy, rushes'],
    ['αντιμιλάει, αυθάδης', 'answers back, cheeky'],
    ['κάνει τον καραγκιόζη', 'clowns around for attention'],
    ['τα παρατάει', 'gives up'],
    ['ΚΕΔΑΣΥ / γνωμάτευση', 'state assessment centre / official assessment report (private)'],
    ['ΔΕΠΥ', 'ADHD (private)']
];
