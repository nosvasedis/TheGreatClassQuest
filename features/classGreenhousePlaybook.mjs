// features/classGreenhousePlaybook.mjs
// The Greenhouse's seed packets: classroom techniques the class reading can point to.
// Each one is short enough to try in the next lesson, written for a young-learner
// ESL classroom (Greek children learning English). Pure data, no DOM.
//
//   id     stable key the engine refers to
//   area   which shelf it sits on (PLAYBOOK_AREAS)
//   time   how long it takes in a lesson
//   how    what to do, in one or two sentences
//   why    what it grows
//   tool   optional: the part of this app that helps (named, never a dead button)

export const PLAYBOOK_AREAS = [
    { id: 'recognition', label: 'Recognition', icon: 'fa-star' },
    { id: 'engagement', label: 'Engagement', icon: 'fa-bolt' },
    { id: 'language', label: 'Language', icon: 'fa-comments' },
    { id: 'support', label: 'Support', icon: 'fa-hand-holding-heart' },
    { id: 'stretch', label: 'Stretch', icon: 'fa-mountain-sun' },
    { id: 'teamwork', label: 'Teamwork', icon: 'fa-users' },
    { id: 'creativity', label: 'Creativity', icon: 'fa-lightbulb' },
    { id: 'respect', label: 'Respect', icon: 'fa-handshake' },
    { id: 'focus', label: 'Focus', icon: 'fa-bullseye' },
    { id: 'assessment', label: 'Assessment', icon: 'fa-clipboard-check' },
    { id: 'attendance', label: 'Attendance', icon: 'fa-door-open' },
    { id: 'wellbeing', label: 'Wellbeing', icon: 'fa-seedling' },
    { id: 'routine', label: 'Routines', icon: 'fa-repeat' }
];

export const TECHNIQUES = [
    // Recognition
    { id: 'name-cards', area: 'recognition', time: '1 min', title: 'Three names in the pocket',
        how: 'Before the lesson, write three quiet names on a sticky note. Your job is to catch each of them doing something right before the break, and say it out loud.',
        why: 'Recognition stops following the loudest hands and reaches the children who never ask for it.',
        tool: 'Award Stars' },
    { id: 'specific-praise', area: 'recognition', time: 'Any time', title: 'Praise the move, not the child',
        how: 'Swap "Well done" for what they did: "You checked your spelling before you handed it in." Name the virtue as you give the star.',
        why: 'Children repeat the behaviour you describe, and the class hears what good looks like.' },
    { id: 'two-by-ten', area: 'recognition', time: '2 min a lesson', title: 'Two minutes for ten lessons',
        how: 'Spend two minutes each lesson chatting with one child about anything except school work (football, a pet, a game), for ten lessons in a row.',
        why: 'A well-known relationship routine: disengaged children re-attach to the class once they feel known.' },
    { id: 'spotlight-rotation', area: 'recognition', time: '30 sec', title: 'Rotating spotlight',
        how: 'Let the app choose who answers, and give the first star of the lesson to a child who has not had one this week.',
        why: 'The spotlight is shared fairly, and the children can see it is fair.',
        tool: 'Fair Picker' },
    { id: 'postcard-home', area: 'recognition', time: '3 min', title: 'Good news home',
        how: 'Send one short, specific good-news line home for a child who is trying hard but rarely shines in marks.',
        why: 'Effort recognised at home is the strongest fuel for the next week.',
        tool: 'Parent Portal' },

    // Engagement
    { id: 'bounty-board', area: 'engagement', time: '1 min', title: 'Post a bounty',
        how: 'Pin a class bounty with a small, visible target for the lesson ("10 full English sentences from the class").',
        why: 'A shared goal pulls drifting children back into the effort without singling anyone out.',
        tool: 'Bounty Board' },
    { id: 'whiteboards-up', area: 'engagement', time: '5 min', title: 'Mini whiteboards, all at once',
        how: 'Ask a question, everyone writes, "3-2-1 boards up!". Scan the room and praise brave attempts, not only right answers.',
        why: 'Every child answers every question; nobody can hide and nobody is exposed alone.' },
    { id: 'tpr-warmup', area: 'engagement', time: '3 min', title: 'Total Physical Response warm-up',
        how: 'Open with a fast "Simon says" using this unit\'s verbs and words ("Simon says: point to something blue").',
        why: 'Movement wakes up tired classes, and young learners remember words they acted out.' },
    { id: 'fresh-goal', area: 'engagement', time: '2 min', title: 'Reset the quest goal',
        how: 'Tell the class exactly how many stars they need to reach the next realm, and write it on the board as a countdown.',
        why: 'A falling star rate usually means the goal feels far away. A near, visible target restarts the race.',
        tool: 'Team Quest' },
    { id: 'choice-board', area: 'engagement', time: '10 min', title: 'Choice of three',
        how: 'Offer three ways to practise the same language: draw and label, write a dialogue, or record a short voice message.',
        why: 'Choice brings back children who switched off from one kind of task.' },

    // Language (ESL)
    { id: 'sentence-frames', area: 'language', time: '2 min prep', title: 'Sentence frames on the board',
        how: 'Write two or three frames for the task ("I think ___ because ___.", "Can I have ___, please?") and point to them while children speak.',
        why: 'Children who have the ideas but not the English can join in straight away.' },
    { id: 'choral-drill', area: 'language', time: '3 min', title: 'Choral, then groups, then one',
        how: 'Drill new language with the whole class, then by rows, then by pairs, and only then invite single voices.',
        why: 'Shy speakers rehearse safely inside the group before they ever speak alone.' },
    { id: 'greek-bridge', area: 'language', time: '2 min', title: 'Greek bridges',
        how: 'Point out cognates and false friends with Greek (telephone / τηλέφωνο, music / μουσική; sympathetic is not συμπαθητικός).',
        why: 'Struggling learners lean on what they already know; the gap to English feels smaller.' },
    { id: 'look-cover-write', area: 'language', time: '5 min', title: 'Look, say, cover, write, check',
        how: 'For tricky spellings: look at the word, say it, cover it, write it, then uncover and check. Three words per lesson is plenty.',
        why: 'The classic spelling routine; it lifts dictation results within a few weeks.' },
    { id: 'recast', area: 'language', time: 'Any time', title: 'Recast instead of correcting',
        how: 'When a child says "He go to school", answer naturally with the right form: "Yes, he goes to school every day!" and move on.',
        why: 'Children hear the correct form without losing face, so they keep speaking.' },
    { id: 'retrieval-starter', area: 'language', time: '5 min', title: 'Retrieval starter',
        how: 'Open the lesson with five quick questions: two from last lesson, two from last week, one from last month.',
        why: 'Spaced recall is the cheapest way to stop marks sliding as units pile up.' },
    { id: 'phonics-chunks', area: 'language', time: '4 min', title: 'Sound chunks',
        how: 'Group this week\'s words by sound pattern (-ight, -ea-, silent e) and clap the chunks before writing them.',
        why: 'Dictation errors are usually patterns; teaching the pattern fixes many words at once.' },

    // Support
    { id: 'pre-teach', area: 'support', time: '3 min', title: 'Pre-teach the key words',
        how: 'Give two or three children the hardest words of the next text a lesson early (a picture card is enough).',
        why: 'They walk into the main task already holding the key, and can lead instead of follow.' },
    { id: 'chunk-task', area: 'support', time: 'In the task', title: 'Chunk the task',
        how: 'Split the exercise into three short steps and tick each one together. Check in after step one, not at the end.',
        why: 'Children who try hard but score low often lose the thread halfway, not at the start.' },
    { id: 'success-first', area: 'support', time: '1 min', title: 'First question is a win',
        how: 'Make sure the first question you ask this child is one you know they can answer, then build up.',
        why: 'An early success changes how the rest of the lesson feels for a struggling learner.' },
    { id: 'check-in', area: 'support', time: '2 min', title: 'Quiet check-in',
        how: 'While the class works, crouch beside the child and ask one open question: "What is tricky today?" Write one line in their Chronicle after.',
        why: 'A falling child is usually a child with a reason. You need the reason before the strategy.',
        tool: "Hero's Chronicle" },
    { id: 'buddy', area: 'support', time: 'Set once', title: 'Learning buddy for one activity',
        how: 'Sit the child next to a patient, steady classmate for one pair task (not a whole-lesson move, and never a guild change).',
        why: 'Peer explanation in simple English often lands better than the teacher\'s.' },

    // Stretch
    { id: 'must-should-could', area: 'stretch', time: '2 min prep', title: 'Must, should, could',
        how: 'Write the task in three layers on the board. Everyone does "must"; strong children go straight for "could".',
        why: 'One worksheet, three levels: the strongest stay challenged and the rest stay safe.' },
    { id: 'expert-role', area: 'stretch', time: 'Set once', title: 'Give them a role',
        how: 'Make a strong child the "word detective" or "spelling checker" for the lesson, helping others before they ask you.',
        why: 'Capable children who get bored become leaders instead of drifters.' },
    { id: 'extension-question', area: 'stretch', time: '1 min', title: 'The why-question',
        how: 'When they finish early, ask one question that needs a reason: "Which is better, and why?" in a full English sentence.',
        why: 'Pushes from correct words to real language use.' },

    // Virtues
    { id: 'think-pair-share', area: 'teamwork', time: '4 min', title: 'Think, pair, share',
        how: 'Ten seconds alone to think, one minute to tell a partner, then pairs report back. Star the pair, not the loudest voice.',
        why: 'Builds teamwork into every question, so Teamwork stars appear naturally.' },
    { id: 'numbered-heads', area: 'teamwork', time: '5 min', title: 'Numbered heads together',
        how: 'Groups of four number themselves 1 to 4; the group agrees on an answer, then you call a number and that child answers for the group.',
        why: 'The group has to make sure everyone can answer, so stronger children teach.' },
    { id: 'creative-twist', area: 'creativity', time: '5 min', title: 'Change one thing',
        how: 'After a reading or dialogue, ask pairs to change one thing (the ending, the place, a character) and act it out.',
        why: 'Gives creativity a regular slot, so it can be recognised as often as focus.' },
    { id: 'draw-describe', area: 'creativity', time: '6 min', title: 'Draw and describe',
        how: 'One child describes a picture in English, the partner draws it without looking. Compare and laugh.',
        why: 'Creative, low-stress speaking practice that quiet children enjoy.' },
    { id: 'talking-token', area: 'respect', time: 'Any time', title: 'Talking token',
        how: 'Only the child holding the token (a ball, a toy) speaks in group discussions; it passes round the circle.',
        why: 'Makes listening visible, so you have clear moments to recognise Respect.' },
    { id: 'kind-words-wall', area: 'respect', time: '3 min', title: 'Kind words in English',
        how: 'Teach two polite phrases a week ("Can you help me, please?", "Good idea!") and star children who use them unprompted.',
        why: 'Respect becomes language practice too.' },
    { id: 'countdown-start', area: 'focus', time: '30 sec', title: 'Countdown start',
        how: 'Start every task with a visible countdown and the same calm phrase. Praise the first table that is ready.',
        why: 'Routine starts save minutes and give you a clear, fair moment to give Focus stars.',
        tool: 'Quest Remote timer' },
    { id: 'quiet-signal', area: 'focus', time: 'Any time', title: 'One quiet signal',
        how: 'Agree one signal for silence (a hand up, a chime) and use it the same way every time. No shouting over the noise.',
        why: 'Noisy classes calm faster with one predictable signal than with many warnings.',
        tool: 'Quiet Dragon' },
    { id: 'brain-break', area: 'focus', time: '2 min', title: 'Brain break',
        how: 'After 15 to 20 minutes of seated work, two minutes of a song or movement in English, then straight back.',
        why: 'Young learners\' attention runs out; a short break buys back the next 15 minutes.' },

    // Assessment
    { id: 'exit-ticket', area: 'assessment', time: '3 min', title: 'Exit ticket',
        how: 'Before they leave, each child writes one thing they learned and one word they still find hard.',
        why: 'You see who is lost today, instead of finding out at the next test.' },
    { id: 'catch-up-paper', area: 'assessment', time: '10 min', title: 'Catch-up paper',
        how: 'Give children who missed a test or dictation a short version at the start of the next lesson while the class does a warm-up.',
        why: 'Gaps in the record become gaps in the picture; a quick catch-up keeps every child\'s progress visible.',
        tool: 'Log New Trial' },
    { id: 'error-hunt', area: 'assessment', time: '8 min', title: 'Error hunt',
        how: 'Show five anonymous mistakes from the last paper on the board. Pairs find and fix them, then explain the rule.',
        why: 'Turns a disappointing paper into the next lesson, without naming anyone.' },
    { id: 'spiral-review', area: 'assessment', time: '1 lesson', title: 'Spiral review lesson',
        how: 'Before the next unit, plan one lesson that mixes the last three units as games and team challenges.',
        why: 'When class averages slide, it is usually old units fading, not the new one being too hard.' },

    // Attendance
    { id: 'welcome-back', area: 'attendance', time: '2 min', title: 'Welcome-back ritual',
        how: 'Greet a returning child by name at the door, tell them one thing they missed in a sentence, and seat them by a buddy.',
        why: 'A child who missed lessons often feels lost and stays away more. A warm return breaks the loop.' },
    { id: 'missed-it-card', area: 'attendance', time: '2 min', title: 'What you missed card',
        how: 'Keep a small card for each lesson with the new words and the homework, ready for anyone who was absent.',
        why: 'Absence costs less learning when catching up takes two minutes.' },
    { id: 'family-check', area: 'attendance', time: '3 min', title: 'Gentle family check',
        how: 'After several absences in a row, send a friendly message home: "We miss X in class. Is everything all right?"',
        why: 'Long absences often have a reason the school should know about.',
        tool: 'Parent Portal' },

    // Wellbeing and routine
    { id: 'promise-chat', area: 'wellbeing', time: '3 min', title: 'A small promise',
        how: 'Agree one tiny, personal promise with the child for the week and check it at the next lesson.',
        why: 'Ownership works better than pressure for children who are drifting.',
        tool: 'Ember Oaths' },
    { id: 'restorative-chat', area: 'wellbeing', time: '3 min', title: 'Restorative chat',
        how: 'After an incident, ask privately: What happened? Who was affected? What can you do to put it right?',
        why: 'Repeated behaviour notes rarely change with punishment alone; repair builds the relationship.' },
    { id: 'chronicle-sweep', area: 'wellbeing', time: '2 min after class', title: 'Chronicle sweep',
        how: 'After each lesson, write one line in the Chronicle for two children you have not written about in a while.',
        why: 'Notes make every reading in this Greenhouse sharper, and nobody disappears from your records.',
        tool: "Hero's Chronicle" },
    { id: 'seat-near', area: 'wellbeing', time: 'Any time', title: 'Teach from near them',
        how: 'Move around the room and teach from beside the child for the first minutes of a task instead of calling across the room.',
        why: 'Proximity calms, refocuses and reassures without a word.' },
    // Read from the Chronicle: routines for what several children share
    { id: 'homework-checkpoint', area: 'routine', time: '2 min', title: 'Homework checkpoint',
        how: 'Homework goes on the desk as children sit down; you walk the rows during the warm-up and tick it. Children who missed it finish one exercise in the first five minutes.',
        why: 'When several children skip homework, a calm daily check works better than reminders, and nobody is told off in front of the class.' },
    { id: 'ready-kit', area: 'routine', time: 'Set once', title: 'The ready kit',
        how: 'Keep a box with spare pencils, rubbers and two old copies of the book. Borrowing costs nothing, but it goes back at the end.',
        why: 'The lesson starts for everyone, and forgetting stops being a way to sit out.' },
    { id: 'bell-work', area: 'routine', time: '5 min', title: 'Bell work',
        how: 'A short task is on the board before the lesson starts (three words to copy and illustrate). Children who arrive start it at once.',
        why: 'Late arrivals slip in without stopping the class, and the first minutes are never lost.' },
    { id: 'seat-plan', area: 'routine', time: 'Set once', title: 'A seating plan with care',
        how: 'Sit children your notes link to friction on different tables, and put each one next to a calm, kind classmate. Guilds stay as they are; this is only where they sit.',
        why: 'Many conflicts are about who sits together. Moving the seat ends them without a word.' },
    { id: 'calm-corner', area: 'wellbeing', time: 'Any time', title: 'A calm minute',
        how: 'Agree a quiet signal a child can give when it is too much: they take one minute at the window or the back table, then rejoin.',
        why: 'Anxious or angry children settle faster when they can step away without a scene.' },
    { id: 'access-adjust', area: 'support', time: '5 min prep', title: 'The adjusted copy',
        how: 'Prepare one version of the worksheet with bigger print, more space, fewer items and the first answer done as an example. Offer a little more time on papers.',
        why: 'Children with dyslexia or attention difficulties show what they know when the page is not the obstacle.' },
    { id: 'interest-hooks', area: 'engagement', time: '1 min prep', title: 'Hooks from their world',
        how: 'Write your examples and questions about the things your notes say they love (football, animals, games): "If Messi has 3 balls…".',
        why: 'Children listen harder to English about their own world, and quiet ones suddenly have something to say.' },

    // Read from the Chronicle: language skills several children share
    { id: 'paired-reading', area: 'language', time: '6 min', title: 'Paired reading',
        how: 'A steady reader and a less confident one read the same text together: together aloud, then the weaker reader alone, with the partner helping on hard words.',
        why: 'Reading practice that is safe and doubles the minutes each child reads aloud.' },
    { id: 'model-text', area: 'language', time: '5 min', title: 'Model, then change it',
        how: 'Show one short model (three sentences). Children copy its shape and change two or three words to make it their own.',
        why: 'Weak writers need the shape of good writing before they can fill it.' },
    { id: 'minimal-pairs', area: 'language', time: '3 min', title: 'Minimal pairs',
        how: 'Say pairs that differ in one sound (ship/sheep, thin/tin, very/berry); children hold up 1 or 2. Then they say them.',
        why: 'Greek speakers mix the same few English sounds; hearing the difference comes before saying it.' },
    { id: 'guided-discovery', area: 'language', time: '6 min', title: 'Spot the rule',
        how: 'Show four example sentences with the pattern; pairs work out the rule and write one more example before you explain.',
        why: 'Grammar children discover themselves sticks longer than grammar they are told.' },
    { id: 'word-wall', area: 'language', time: '2 min a lesson', title: 'The word wall',
        how: 'Each unit\'s key words go on the wall with a picture. Start each lesson by pointing at three: the class says the word, then a sentence.',
        why: 'Vocabulary needs to be met again and again; the wall does it for you.' },
    { id: 'listen-for-three', area: 'language', time: '4 min', title: 'Listen for three',
        how: 'Before an audio or story, give one simple job: "Listen for three animals." Check, then play it again with a harder job.',
        why: 'Children who "don\'t understand" often just don\'t know what to listen for.' },
    { id: 'strength-notes', area: 'wellbeing', time: '2 min after class', title: 'Write the good days too',
        how: 'For every worry you write in the Chronicle, add one line about something that went well, for any child.',
        why: 'A Chronicle of only worries hides the progress you need to see, and it is what the next teacher reads.',
        tool: "Hero's Chronicle" }
];

const TECHNIQUE_BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

export function getTechnique(id) {
    return TECHNIQUE_BY_ID.get(id) || null;
}

export function techniquesForArea(area) {
    return TECHNIQUES.filter((t) => t.area === area);
}

/** Virtue id → techniques that make that virtue easy to see and to reward. */
export const VIRTUE_TECHNIQUES = {
    teamwork: ['think-pair-share', 'numbered-heads'],
    creativity: ['creative-twist', 'draw-describe'],
    respect: ['talking-token', 'kind-words-wall'],
    focus: ['countdown-start', 'quiet-signal', 'brain-break']
};
