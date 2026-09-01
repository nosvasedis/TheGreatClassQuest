/**
 * Central tier feature metadata for Starter / Pro / Elite.
 * Single source of truth for gated tabs, upgrade prompts, and tier copy.
 */

/** Human-readable feature definitions: flag key → { name, emoji, description, tier, teacherExplain, studentExplain } */
export const FEATURE_DEFINITIONS = {
    guilds: {
        name: 'Guilds',
        emoji: '🏰',
        description: 'Full Guild system and sorting quiz',
        tier: 'Pro',
        teacherExplain: 'Split students into four Guilds — Dragon Flame, Grizzly Might, Owl Wisdom, and Phoenix Rising — with a story-style sorting quiz. Stars, relics, Quiz of the Week, and Fortune\'s Wheel write Guild Glory. Houses rank by Guild Power: 70% season Glory per member, 15% this week\'s Glory per member, 10% activity (who earned Glory this week), 5% momentum (this week vs last). Fair per member, not raw Total Stars. Spin the Wheel on the class\'s last lesson of the week, once per class. June ends with the Grand Guild Ceremony. 🏆',
        studentExplain: 'You belong to a Guild — your House in the Quest world! 🏰 Your stars and special rewards build Guild Glory for your team. Guild Power compares teams fairly, so every hero matters no matter how big the guild is!'
    },
    calendar: {
        name: 'Calendar & Day Planner',
        emoji: '📅',
        description: 'Schedule, holidays, Quest Events',
        tier: 'Pro',
        teacherExplain: 'Quest Calendar shows lesson days, cancellations, and Quest Events (2× Star Day, Reason Bonus Day, Vocabulary Vault, and more). Cancel a class or add a one-time lesson from the Day Planner. School-wide holiday ranges are set in the School Office (Secretary). You can still mark a single unexpected closure as a school holiday from the Day Planner. 📋✨',
        studentExplain: 'See what\'s coming up in your Quest! 📅 Your teacher can schedule special events, celebrations and surprises — all visible in the calendar so you\'re always in the loop!'
    },
    scholarScroll: {
        name: "Scholar's Scroll",
        emoji: '📜',
        description: 'Tests, dictations, performance charts',
        tier: 'Pro',
        teacherExplain: "Log tests and dictations, watch the performance chart, and keep Pending Makeups for students who still need a grade. Outstanding tests (≥95%) can offer Starfall (+1 Scholar's Bonus); strong dictations can offer +0.5 with monthly caps. You confirm Starfall — nothing is forced. 📊",
        studentExplain: "Your Scholar's Scroll is your academic trophy wall! 📜 See your test scores, how you've improved over time, and challenge yourself to beat your own record. Every good grade is proof of your growing power! 💪"
    },
    storyWeavers: {
        name: 'Story Weavers',
        emoji: '📖',
        description: 'Collaborative story and Word of the Day',
        tier: 'Elite',
        teacherExplain: "The class writes ONE story, sentence by sentence, with a Word of the Day and an illustration on each lock-in. Every second addition can award the whole class +0.5 Story Weaver stars. Print the finished tale as a PDF storybook. Separate from Five-Sentence Saga (a one-day calendar quest). ✍️🌟",
        studentExplain: "The whole class writes ONE story — and you're part of it! 📖 Each lesson you can add a sentence, use the Word of the Day, and watch the story grow into a real book together! ✨"
    },
    heroProgression: {
        name: 'Hero Classes & Skill Tree',
        emoji: '⚔️',
        description: 'Class identity, leveling, and skill branches',
        tier: 'Pro',
        teacherExplain: "Assign a class from Manage Students → Edit → the Hero Path tab (seven archetype cards, or No Class). They level by earning stars in that class's matching virtue (not generic XP). Each level offers one of two Skill Tree branches (extra Gold, bonus stars, or help for classmates/guildmates). Matching awards also grant +10 Gold. The first class is free; changing later locks the path. ⚔️🧙",
        studentExplain: "Who is your hero? ⚔️ Choose your Hero Class — Guardian, Sage, Paladin, Artificer, Scholar, Weaver, or Nomad — and level up by earning stars in your specialty. Each level unlocks a new skill on your Skill Tree. Your adventure is YOUR adventure! 🌟"
    },
    adventureLog: {
        name: 'Adventure Log',
        emoji: '📓',
        description: 'Manual diary entries, Hero of the Day, Hall of Heroes, teacher notes',
        tier: 'Pro',
        teacherExplain: "End the lesson with Log Today's Adventure (once per class per day, after stars). Pro: you write the diary. Elite: AI writes it and paints a storybook picture — you can still edit. Every log automatically crowns Hero of the Day. Hall of Heroes is the archive of those daily crowns — not the monthly Prodigy list. Quest Assignment and Attendance live here too. ✨",
        studentExplain: "The Adventure Log is your class's story book! 📓 See what happened in today's lesson, discover who became Hero of the Day, and find your name in the Hall of Heroes when you have worn that crown. 🏆"
    },
    schoolYearPlanner: {
        name: 'My Planning',
        emoji: '🗓️',
        description: 'Class end dates (holidays live in the School Office)',
        tier: 'Pro',
        teacherExplain: "Teacher Settings → My Planning sets each class's final lesson day so the calendar and Team Quest goals know when the group finishes. School-wide holiday ranges (Christmas, Easter, breaks) belong to the School Office (Secretary, Elite). 🗓️🎯",
        studentExplain: "Your school calendar — holidays, last days, and special events — is built into the Quest so ceremonies and goals match real school time. 🌟"
    },
    makeupTracking: {
        name: 'Pending Makeups',
        emoji: '🔄',
        description: 'Track missing test grades',
        tier: 'Pro',
        teacherExplain: "On Scholar's Scroll, Pending Makeups lists students who still need a grade after a class test. Log the result or dismiss the row. This is academic catch-up — not a separate make-up-lesson register. ✅📋",
        studentExplain: "If you missed a test, your teacher can still record your makeup grade on the Scholar's Scroll so your adventure stays complete! 💪"
    },
    advancedAttendance: {
        name: 'Advanced Attendance',
        emoji: '📋',
        description: 'Chronicle and extra controls',
        tier: 'Pro',
        teacherExplain: "The Attendance Chronicle is a month × students matrix: present, absent, monthly %, and the option to drop a column as No Lesson (or a school holiday). You can also mark today from Award Stars clouds (including Welcome Back). 📋📊",
        studentExplain: "Showing up consistently is part of being a true Hero! 📋 Your attendance is tracked in the Quest — heroes who keep coming earn extra respect! ⭐"
    },
    eliteAI: {
        name: 'AI Magic ✨',
        emoji: '🤖',
        description: 'AI stories, editing, Hero Chronicle Oracle, story images',
        tier: 'Elite',
        teacherExplain: "Elite AI: Adventure Log chronicler + storybook image, Story Weavers illustrations, Avatar Forge, Nameday Lookup, class reports, certificates, Hero's Chronicle Oracle (Parent Summary, Teacher Strategy, Strengths/Weaknesses, Goal Suggestion), and Market Restock for seasonal treasures. You still decide every star. 🤖✨🎨",
        studentExplain: "Your teacher has an AI Oracle inside Hero's Chronicle! 🤖✨ It helps your teacher understand your progress and support you better — like a magical advisor on your hero's journey! 🌟"
    },
    familiars: {
        name: 'Familiars',
        emoji: '🐉',
        description: 'Magical creature companions that hatch and evolve',
        tier: 'Elite',
        teacherExplain: "Each student may own one Familiar. Buy an egg in the Mystic Market (30–50 Gold). It hatches after 20 stars earned since purchase, then evolves at 60 and 140 stars since hatch. Displayed beside the avatar. 🐉🥚",
        studentExplain: "Your Familiar is your magical companion — one egg, then it hatches and evolves as you earn stars! 🐉🥚 Feed it with your hard work and watch it grow. Don't let it down — it's counting on you!"
    },
    parentAccess: {
        name: 'Family Portal',
        emoji: '👨‍👩‍👧',
        description: 'Curated parent access, homework, and family messaging',
        tier: 'Pro',
        teacherExplain: "Create one Family Portal login per student (Teacher Settings → Family Access). Families see progress, homework from Quest Assignment, attendance snapshot, and calm messages — never your private Chronicle. 👨‍👩‍👧📘",
        studentExplain: "Your family can follow your progress, homework, and special moments in a safe portal made just for them. They get to cheer you on without sitting in the teacher tools! 🌟"
    },
    secretaryAccess: {
        name: 'School Office',
        emoji: '🏛️',
        description: 'School-wide admin access with full oversight',
        tier: 'Elite',
        teacherExplain: "The School Office (Secretary) owns the school year, holiday ranges, school-wide grading defaults, and family messages. Teachers still run the lesson; the office keeps the calendar honest. Open it from the header shield when your school has Secretary access. 🏛️🗂️",
        studentExplain: "Your school office keeps holidays, the school year, and messages organised behind the scenes so every hero's Quest stays in sync. 🏛️"
    },
    quizOfTheWeek: {
        name: 'Quiz of the Week',
        emoji: '❓',
        description: 'Weekly curriculum quiz game-show',
        tier: 'Elite',
        teacherExplain: "Configure in Teacher Settings → Quiz (grammar, vocabulary, or mix). The app writes multiple-choice questions that scale with class size (about three-quarters of the roster, between 5 and 15). Play from Home on the class's first lesson day of the week during lesson time. Students are picked at random; rewards follow first-try accuracy. Not a Scholar's Scroll test. ❓🏆",
        studentExplain: "Quiz of the Week is your class's weekly challenge! ❓ Heroes get picked at random to answer — and if your class does well, you unlock rewards. It feels like a game show, but it makes your English stronger every week. 🏆"
    }
};

/**
 * Guide Sections for the Adventurer's Guide accordion.
 * Each section groups related features for teacher and student views.
 * Returns sections for a given perspective ('teacher' | 'student') with tier-aware items.
 */
export function getGuideSections(perspective) {
    if (perspective === 'teacher') {
        return [
            {
                id: 'economy',
                emoji: '⭐',
                title: 'Stars, Rewards & Economy',
                color: 'amber',
                intro: 'The heart of The Great Class Quest — the motivation engine that keeps every student engaged every single lesson.',
                features: [
                    { emoji: '⭐', name: 'Award Stars', tier: 'starter', teacherExplain: 'The heart of every lesson. On floating clouds, award 1, 2, or 3 stars for one of four life skills: Teamwork, Creativity, Respect, or Focus. Welcome Back greets a child who was away. Scholar\'s Bonus comes from Starfall; Story Weaver stars come from Story Weavers. Each star also grants 1 Gold. ✨', why: 'The fastest honest way to name virtue in action and fuel the whole Quest.' },
                    { emoji: '💰', name: 'Mystic Market', tier: 'starter', teacherExplain: 'Its own tab. Students spend Gold (not stars — rank never drops when they shop) on 15 Legendary Artifacts with fixed prices. Two legendary buys per student per month. On Elite, Restock fills seasonal treasures and Familiar eggs. You do not set those prices. Reigning Hero of the Day gets 25% off the seasonal shelf. 🛒✨', why: 'Teaches delayed gratification without selling leaderboard rank.' },
                    { emoji: '🎁', name: "Hero's Boon", tier: 'starter', teacherExplain: "A classmate spends 15 Gold to give +0.5 stars (free all month with Compassion Token). Max 4 gifts per class per day. The receiver must be in the bottom 3 monthly stars or in a tie group. No self-gift; cannot gift the same classmate twice in a row. Grey hearts mean not eligible. Distinct from Teacher Boon and from the Hero of the Day's automatic +1. 🎁💫", why: 'Teaches generosity with fairness rules the class can see.' },
                    { emoji: '🎗️', name: 'Teacher Boon', tier: 'starter', teacherExplain: 'In the last 7 days of the month, gift 2 stars once per class with a named reason (Leadership, Perseverance, Kindness, Bravery, Helping Others, Remarkable Growth, or your own words). It appears in the Ceremony of the Month. 🎗️', why: 'Names character the four virtue buttons cannot quite capture.' },
                    { emoji: '🏹', name: 'Quest Bounties', tier: 'starter', teacherExplain: 'A short class challenge: reach X stars in Y minutes for a stated reward (for example five minutes of free time). Post mainly from Home. Progress shows on Award Stars and Projector Mode. Time Warp Hourglass adds +5 minutes to active timers. 🏹⏱️', why: 'Turns a slice of the lesson into a shared race against the clock.' },
                    { emoji: '🐉', name: 'Familiars', tier: 'elite', key: 'familiars', teacherExplain: FEATURE_DEFINITIONS.familiars.teacherExplain, why: 'Long-term progression that makes every star feel like it matters beyond today.' },
                    { emoji: '🎉', name: 'Ceremony of the Month', tier: 'starter', teacherExplain: 'A dual ritual when a new month begins: Team Quest league ranks for classes, then Prodigy of the Month for the selected class (Co-Prodigy allowed). Tabs pulse until you run it. Hall of Prodigies archives monthly crowns. The Grand Guild Ceremony in June is a different, year-end house crowning. 🎉🏆', why: 'Creates an emotional peak without mixing daily heroes with monthly prodigies.' },
                ]
            },
            {
                id: 'identity',
                emoji: '🧙',
                title: 'Hero Identity & Growth',
                color: 'violet',
                intro: 'Every student becomes a unique Hero. Their identity, class, and progression make them feel genuinely invested in every lesson.',
                features: [
                    { emoji: '🧙', name: 'Hero Classes', tier: 'pro', key: 'heroProgression', teacherExplain: FEATURE_DEFINITIONS.heroProgression.teacherExplain, why: 'Students who identify with their hero class are more likely to stay in character — focused, participatory, and proud.' },
                    { emoji: '🌳', name: 'Skill Tree', tier: 'pro', key: 'heroProgression', teacherExplain: 'At each Hero Path level the student chooses one of two permanent skills tied to their class virtue — extra Gold for themselves, bonus stars, or a gift to classmates or guildmates. A button on the roster pulses when a new choice is waiting. From level 3 the avatar gains a class-coloured aura. 🌳⬆️', why: 'Makes improvement visible and tied to real classroom virtues, not generic combat stats.' },
                    { emoji: '🏰', name: 'Guilds & Sorting Quiz', tier: 'pro', key: 'guilds', teacherExplain: FEATURE_DEFINITIONS.guilds.teacherExplain, why: 'Team dynamics transform individual effort into collective pride.' },
                ]
            },
            {
                id: 'academics',
                emoji: '📊',
                title: "Academics & Scholar's Records",
                color: 'teal',
                intro: 'Beautiful, clear academic tracking that turns boring grade records into a living progress story for each student.',
                features: [
                    { emoji: '📜', name: "Scholar's Scroll", tier: 'pro', key: 'scholarScroll', teacherExplain: FEATURE_DEFINITIONS.scholarScroll.teacherExplain, why: "Replaces paper grade sheets with a visual, satisfying record system you'll actually want to open." },
                    { emoji: '❓', name: "Quiz of the Week", tier: 'elite', key: 'quizOfTheWeek', teacherExplain: FEATURE_DEFINITIONS.quizOfTheWeek.teacherExplain, why: 'A weekly review ritual that feels like a game show — not a test.' },
                    { emoji: '📓', name: "Hero's Chronicle", tier: 'starter', teacherExplain: "Private notes per student from My Classes → Manage Students → the green book. Categories: General, Academic, Behavior, Social, Goals. Families never see this notebook unless you publish. On Elite, the Oracle can write Parent Summary, Teacher Strategy, Traits & Trends, and Hero's Goal from notes, trials, and stars. 📓✨", why: 'Keep detailed records without drowning in paperwork — and let AI help you spot patterns on Elite.' },
                    { emoji: '🔄', name: 'Pending Makeups', tier: 'pro', key: 'makeupTracking', teacherExplain: FEATURE_DEFINITIONS.makeupTracking.teacherExplain, why: 'Missing test grades stay visible until you log them or dismiss the row.' },
                    { emoji: '📋', name: 'Advanced Attendance', tier: 'pro', key: 'advancedAttendance', teacherExplain: FEATURE_DEFINITIONS.advancedAttendance.teacherExplain, why: 'Professional-grade records that protect you and inform parents with clarity.' },
                ]
            },
            {
                id: 'planning',
                emoji: '🗓️',
                title: 'Planning & Attendance',
                color: 'rose',
                intro: 'Everything you need to stay organised across the whole school year — all in one place.',
                features: [
                    { emoji: '📅', name: 'Calendar & Day Planner', tier: 'pro', key: 'calendar', teacherExplain: FEATURE_DEFINITIONS.calendar.teacherExplain, why: 'Brings your teaching plan and the Quest world into perfect sync — no separate tools needed.' },
                    { emoji: '🗓️', name: 'My Planning', tier: 'pro', key: 'schoolYearPlanner', teacherExplain: FEATURE_DEFINITIONS.schoolYearPlanner.teacherExplain, why: 'Class end dates keep Team Quest goals honest after a group finishes.' },
                    { emoji: '👑', name: 'Hero of the Day', tier: 'pro', key: 'adventureLog', teacherExplain: "Crowned automatically when you Log Today's Adventure — you do not pick the name by hand. Mask of the Protagonist wins if pending; otherwise a fair rotation among present students. Perks: +1 on their first award that day (labelled Includes Hero's Boon), 25% off seasonal Market, and lifetime legend discounts. Distinct from Prodigy of the Month. 👑📓", why: 'A daily spotlight with real perks — without stealing the monthly crown.' },
                    { emoji: '📓', name: 'Adventure Log', tier: 'pro', key: 'adventureLog', teacherExplain: FEATURE_DEFINITIONS.adventureLog.teacherExplain, why: 'Turns the hour into a story the class owns — and crowns Hero of the Day.' },
                ]
            },
            {
                id: 'community',
                emoji: '🏫',
                title: 'Families, School Office & Ranks',
                color: 'emerald',
                intro: 'The same school year, three interfaces. Students never log in — they see the Quest on the classroom screen.',
                features: [
                    { emoji: '🏆', name: "Hero's Challenge", tier: 'starter', teacherExplain: 'Student vs student ranks (By Class or Global, Monthly or Total). Trophy Room holds inventory. Certificates and Hall of Prodigies live here. Guild badges on rows are identity; guild ranking is Guild Hall. 🏆', why: 'Personal accountability beside the class map race.' },
                    { emoji: '👨‍👩‍👧', name: 'Family Portal', tier: 'pro', key: 'parentAccess', teacherExplain: FEATURE_DEFINITIONS.parentAccess.teacherExplain, why: 'Families follow homework and growth without seeing teacher-only notes.' },
                    { emoji: '🏛️', name: 'School Office', tier: 'elite', key: 'secretaryAccess', teacherExplain: FEATURE_DEFINITIONS.secretaryAccess.teacherExplain, why: 'One person owns holidays and the school year so every teacher calendar matches.' },
                ]
            },
            {
                id: 'creative',
                emoji: '✍️',
                title: 'Creative English Tools',
                color: 'cyan',
                intro: 'Story writing, vocabulary, and creative expression tools designed specifically for English language teachers.',
                features: [
                    { emoji: '📖', name: 'Story Weavers', tier: 'elite', key: 'storyWeavers', teacherExplain: FEATURE_DEFINITIONS.storyWeavers.teacherExplain, why: 'Makes creative writing collaborative, exciting, and something students actually want to do.' },
                    { emoji: '💬', name: 'Word of the Day', tier: 'elite', key: 'storyWeavers', teacherExplain: "On Story Weavers, lock a Word of the Day (type it or ask Elite AI to suggest) before the next sentence so the class must use it in the tale. Vocabulary Vault on the calendar is a different, one-day speaking quest. 💬📚", why: 'Vocabulary sticks when it has to live in the next sentence of a shared book.' },
                    { emoji: '🗺️', name: 'Team Quest', tier: 'starter', teacherExplain: 'Class vs class this month on the League Map: Bronze Meadows → Silver Peaks → Golden Citadel → Crystal Realm. Position is monthly stars versus a goal that already allows for holidays and cancelled lessons. This is not Guild Hall (year-long houses). 🗺️⚔️', why: 'Belonging: the whole class travels together.' },
                    { emoji: '🖥️', name: 'Projector Mode', tier: 'starter', teacherExplain: "The TV icon on the classroom PC — not on the phone. Open it whenever it helps the lesson: a living wallpaper (sky, huge clock, analogue hands, class badge, wisdom line). Floating Director cards change about once a minute. When those clocks are real, the room also sees remaining time. Award stars on your teacher screen; the TV is for showing. Sky Theater in the header is separate decoration. 🖥️🎬", why: 'Turns the classroom display into the Quest the children walk into.' },
                ]
            },
            {
                id: 'ai',
                emoji: '🤖',
                title: 'AI Magic ✨',
                color: 'indigo',
                intro: 'The most advanced frontier of The Great Class Quest — AI-powered tools that save you time and spark creativity.',
                features: [
                    { emoji: '🔮', name: "Hero's Chronicle Oracle", tier: 'elite', key: 'eliteAI', teacherExplain: "Inside each student's Hero's Chronicle (the green book on Manage Students), the Oracle writes four pages: Parent Summary, Teacher Strategy, Traits & Trends, and Hero's Goal. It reads notes, trial scores, and stars. You still choose what to publish to the Family Portal. 🔮✨", why: 'Saves hours of analysis and helps you support every student as an individual.' },
                    { emoji: '✍️', name: 'AI Adventure Log Writer', tier: 'elite', key: 'eliteAI', teacherExplain: 'On Elite, Log Today\'s Adventure can write the diary and a storybook image from the lesson. You can edit before (and after) it is saved. Pro teachers write the same ritual by hand. ✍️🤖', why: 'Keeps the closing ritual rich without stealing the teacher\'s last word.' },
                    { emoji: '🎨', name: 'AI Story Images', tier: 'elite', key: 'eliteAI', teacherExplain: 'Story Weavers generates an illustration when you lock in a sentence. Adventure Log on Elite paints a storybook picture for the day. 🎨🖼️', why: 'Children take home proof that English made a picture-book, not only a worksheet.' },
                    { emoji: '🦸', name: 'AI Avatar Generator', tier: 'elite', key: 'eliteAI', teacherExplain: 'Students create unique AI-generated avatars! They choose a creature type, colour scheme, and accessory, and the AI creates a personalised chibi-style character just for them. Each avatar is completely unique — no two heroes look the same! 🦸✨', why: 'Students feel genuinely attached to their unique identity in the Quest world.' },
                    { emoji: '📄', name: 'AI Reports & Certificates', tier: 'elite', key: 'eliteAI', teacherExplain: 'Generate AI-powered weekly class reports with insights and suggestions, plus beautifully styled certificates with AI-generated personalised text for each student. Perfect for parent meetings and celebrating achievements! 📄🏅', why: 'Professional, personalised output that impresses parents and saves hours of writing.' },
                    { emoji: '🌟', name: 'AI Seasonal Shop', tier: 'elite', key: 'eliteAI', teacherExplain: "Every month, use AI to restock the Mystic Market with brand-new themed seasonal treasures — fantasy items crafted to the current season and your students' age group. Click the \u2018Restock\u2019 button in the Mystic Market and AI generates a fresh batch in seconds. Students love discovering what's new each month! 🛒✨", why: 'Fresh monthly items keep students excited to check the shop and earn more gold every single lesson.' },
                ]
            },
        ];
    }

    // Student perspective
    return [
        {
            id: 'economy',
            emoji: '⭐',
            title: 'Stars, Gold & Rewards',
            color: 'amber',
            intro: 'The beating heart of your Quest — earn stars, build your treasure, and become the most powerful hero in the class!',
            features: [
                { emoji: '⭐', name: 'Earning Stars', tier: 'starter', studentExplain: 'Stars are your hero points! 🌟 Your teacher awards them for Teamwork, Creativity, Respect, or Focus. Every star also gives you 1 Gold. Stars move your class on the Team Quest map and can change your rank in Hero\'s Challenge!', why: 'Every star is proof that you\'re growing as an English hero! 💪' },
                { emoji: '🛒', name: 'Mystic Market', tier: 'starter', studentExplain: 'Spend Gold (not stars!) in the Mystic Market. 🛒✨ Legendary Artifacts with special powers are always there. On Elite, new seasonal treasures appear each month, plus Familiar eggs. Buying things never lowers your star rank.', why: 'Every item you buy is proof of how much you\'ve participated and grown! 🏆' },
                { emoji: '🎁', name: "Hero's Boon", tier: 'starter', studentExplain: "A Hero's Boon is a gift of +0.5 stars to a classmate who needs a lift. 🎁💫 It costs 15 Gold. The Quest only lets you gift classmates who are near the bottom this month (or tied) — that keeps it fair. You cannot gift yourself.", why: "It's a way to celebrate friends and practise generosity! ✨" },
                { emoji: '🏹', name: 'Quest Bounties', tier: 'starter', studentExplain: 'When your teacher posts a Bounty, the whole class races to earn enough stars before the timer ends! 🏹⏱️ Hit the target together and claim the reward (like extra free time).', why: 'A shared race that makes the room buzz! 🌟' },
                { emoji: '🐉', name: 'Your Familiar', tier: 'elite', studentExplain: FEATURE_DEFINITIONS.familiars.studentExplain, why: "A growing creature that's entirely YOURS, reflecting your entire journey. 💫" },
            ]
        },
        {
            id: 'identity',
            emoji: '🧙',
            title: 'Your Hero Identity',
            color: 'violet',
            intro: "This isn't just a class — it's your origin story. Discover who your hero is!",
            features: [
                { emoji: '⚔️', name: 'Your Hero Class', tier: 'pro', studentExplain: 'Who is your hero? ⚔️ Choose your Hero Class — Guardian, Sage, Paladin, Artificer, Scholar, Weaver, or Nomad — and level up by earning stars in your specialty. Each level unlocks new skills on your Skill Tree, making your hero more powerful. Your adventure is YOUR adventure! 🌟', why: 'Your class defines your strengths and gives you a unique identity in the Quest! 🌟' },
                { emoji: '🌳', name: 'Skill Tree', tier: 'pro', studentExplain: 'As you level up, you choose branches on your personal Skill Tree! 🌳✨ Skills might give extra Gold, bonus stars, or a gift to your classmates or guild when you play to your class\'s strength. Your tree tells the story of how you grow as an English hero.', why: 'Levelling up means YOU are visibly, undeniably getting stronger. 💪' },
                { emoji: '🏰', name: 'Your Guild', tier: 'pro', studentExplain: FEATURE_DEFINITIONS.guilds.studentExplain, why: 'Being part of a team makes every star you earn feel even more important! 🏆' },
            ]
        },
        {
            id: 'learning',
            emoji: '📚',
            title: 'Learning & Adventure',
            color: 'teal',
            intro: 'English class becomes an actual adventure — stories, vocabulary, challenges, and achievements that are genuinely exciting.',
            features: [
                { emoji: '❓', name: 'Quiz of the Week', tier: 'elite', key: 'quizOfTheWeek', studentExplain: FEATURE_DEFINITIONS.quizOfTheWeek.studentExplain, why: 'A weekly challenge that helps you remember what you learned — and win rewards!' },
                { emoji: '📖', name: 'Story Weavers', tier: 'elite', studentExplain: FEATURE_DEFINITIONS.storyWeavers.studentExplain, why: "Your sentences become part of a REAL story your whole class writes together! ✍️" },
                { emoji: '💬', name: 'Word of the Day', tier: 'elite', studentExplain: "On Story Weavers there is a special Word of the Day! 💬📚 Learn it, then use it in the next sentence of the class story. Over the year your vocabulary becomes a superpower!", why: 'Small daily words = huge vocabulary by the end of the year. 🌟' },
                { emoji: '📜', name: "Scholar's Scroll", tier: 'pro', studentExplain: FEATURE_DEFINITIONS.scholarScroll.studentExplain, why: 'Watching your own scores improve is incredibly motivating! 📈' },
                { emoji: '🗺️', name: 'Team Quest Map', tier: 'starter', studentExplain: 'The Team Quest map shows your class\'s journey this month! 🗺️⚔️ Earn stars together to travel Bronze Meadows, Silver Peaks, Golden Citadel, and Crystal Realm. It is your class vs other classes — not the Guild race.', why: 'Progress feels REAL when you can see it on a map! 🌍' },
            ]
        },
        {
            id: 'celebrations',
            emoji: '🎉',
            title: 'Events & Celebrations',
            color: 'rose',
            intro: "The Quest isn't just about lessons — it's about those legendary moments you remember forever!",
            features: [
                { emoji: '🎉', name: 'Ceremony of the Month', tier: 'starter', studentExplain: "When a new month begins, your class holds the Ceremony of the Month! 🎉🏆 First the classes on Team Quest are ranked, then one student becomes Prodigy of the Month (sometimes a Co-Prodigy shares the crown). Guild Champions and the Grand Guild Ceremony are a different, house story.", why: 'Your hard work deserves a real celebration every single month! 🌟' },
                { emoji: '👑', name: 'Hero of the Day', tier: 'pro', studentExplain: "When the teacher logs today's adventure, one present student is automatically crowned Hero of the Day! 👑 You get a spotlight, a shop discount on seasonal treasures, and +1 star on your first award that day. This is not the same as Prodigy of the Month.", why: 'A daily spotlight makes each lesson feel like it could become YOUR legendary moment.' },
                { emoji: '🏆', name: 'Hall of Heroes', tier: 'pro', studentExplain: "The Hall of Heroes remembers every Hero of the Day crown. 🏆👑 Getting in means you wore that daily spotlight — it is not the Hall of Prodigies (those are monthly crowns).", why: 'True daily legends get remembered — could your name be there? ✨' },
                { emoji: '📅', name: 'Quest Events', tier: 'pro', studentExplain: "Your teacher plans special Quest Events — competitions, challenges, and celebrations baked into the Quest calendar! 📅🎊 Some events give bonus rewards, others unlock special ceremonies. Keep your eyes open for what\'s coming up!", why: "There's always something exciting to look forward to in the Quest! 🌟" },
                { emoji: '📓', name: 'Adventure Log', tier: 'pro', studentExplain: FEATURE_DEFINITIONS.adventureLog.studentExplain, why: 'Your class story is being written every lesson — and you\'re in it! 📖' },
            ]
        },
        {
            id: 'ai',
            emoji: '🤖',
            title: 'AI Magic ✨',
            color: 'indigo',
            intro: 'The most advanced features in the Quest universe — powered by AI to make your class stories and experiences truly extraordinary.',
            features: [
                { emoji: '🔮', name: "Hero's Chronicle Oracle", tier: 'elite', studentExplain: "Your teacher has a special AI Oracle inside your Hero's Chronicle! 🔮✨ The Oracle looks at all your progress — stars, tests, and achievements — and helps your teacher understand how to support you better. It's like having a magical advisor watching over your hero's journey!", why: 'The Oracle helps make sure every hero gets the support they need! 🌟' },
                { emoji: '🎨', name: 'AI Story Images', tier: 'elite', studentExplain: "Your class stories get AI-generated illustrated covers — real artwork made just for YOUR class's adventure! 🎨🖼️ These images are completely unique and make your story feel like a real published fantasy book.", why: 'Your class story deserves a cover worthy of a legendary tale! ✨' },
                { emoji: '🦸', name: 'AI Avatar Generator', tier: 'elite', studentExplain: 'Create your own unique AI-generated avatar! 🦸✨ Choose your creature type, colour, and accessory, and the AI makes a personalised chibi-style hero just for you. No two avatars are the same — yours will be completely unique!', why: 'Your hero is unique. Make them look the part! ✨' },
            ]
        },
    ];
}

/** Gated tab config: tabId → { feature, tier, message } for showUpgradePrompt */
export const GATED_TABS = {
    'guilds-tab': {
        feature: FEATURE_DEFINITIONS.guilds.name,
        tier: 'Pro',
        message: 'Unlock the full Guild system and sorting quiz.'
    },
    'calendar-tab': {
        feature: FEATURE_DEFINITIONS.calendar.name,
        tier: 'Pro',
        message: 'Manage your schedule, one-day closures, and Quest Events.'
    },
    'scholars-scroll-tab': {
        feature: FEATURE_DEFINITIONS.scholarScroll.name,
        tier: 'Pro',
        message: 'Track tests, dictations, and performance charts.'
    },
    'reward-ideas-tab': {
        feature: FEATURE_DEFINITIONS.storyWeavers.name,
        tier: 'Elite',
        message: 'Collaborative story writing and Word of the Day — available on the Elite plan.'
    }
};

/** Tab ID → feature flag key (for canUseFeature) */
export const TAB_FEATURE_FLAGS = {
    'guilds-tab': 'guilds',
    'calendar-tab': 'calendar',
    'scholars-scroll-tab': 'scholarScroll',
    'reward-ideas-tab': 'storyWeavers'
};

/** Upgrade prompt copy per target tier */
export const UPGRADE_MESSAGES = {
    Pro: {
        default: 'This feature is available on the Pro plan. Contact me to upgrade.',
        schoolYearPlanner: 'My Planning (class end dates) unlocks with Pro. School-wide holidays live in the School Office.',
        advancedAttendance: 'The Attendance Chronicle (month view and history) is available on the Pro plan.',
        heroProgression: 'Hero Classes and Skill Tree progression are available on the Pro plan.',
        maxClasses: 'You have reached your plan limit. Upgrade to add more classes.',
        maxTeachers: 'Your school has reached the teacher limit. Upgrade to add more teachers.'
    },
    Elite: {
        default: 'AI-powered features unlock on the Elite plan. Contact me to upgrade.',
        adventureLog: 'The AI-powered diary and storybook image are on the Elite plan. Pro still has the full manual log and Hero of the Day.',
        storyWeavers: 'Story Weavers and Word of the Day are available on the Elite plan. Contact me to upgrade.',
        familiars: 'Familiars — one companion egg that hatches and evolves — are available on the Elite plan. Contact me to upgrade.',
        quizOfTheWeek: 'Quiz of the Week is available on the Elite plan. Configure it in Teacher Settings → Quiz and play from Home.'
    }
};

/**
 * Options/Guide tier summary: badge, title, body, cta, isTopTier
 * @param {string} rawTier - 'starter' | 'pro' | 'elite'
 */
export function getTierSummary(rawTier) {
    const t = rawTier || 'starter';
    if (t === 'elite') {
        return {
            badge: 'Top Tier',
            title: 'You are on Elite — the full magical toolkit.',
            body: 'All Elite tools unlocked: Hero\'s Chronicle Oracle, Avatar Forge, AI reports & certificates, Story Weavers images, AI Adventure Log, Market Restock, Familiars, Quiz of the Week, Family Portal, School Office, guilds, Hero Path, and every classroom ritual.',
            cta: 'Thank you for being a founding legend of The Great Class Quest.',
            isTopTier: true
        };
    }
    if (t === 'pro') {
        return {
            badge: 'Pro Power',
            title: 'Pro unlocks guilds, planners and advanced logs.',
            body: "You have Guild Hall, Hero Path & Skill Tree, Quest Calendar, My Planning (class end dates), Scholar's Scroll, Family Access, Attendance Chronicle, and the full Adventure Log with manual diary, Hero of the Day, and Hall of Heroes.",
            cta: 'Upgrade to Elite for Story Weavers, Familiars, Quiz of the Week, AI chronicler and images, the School Office, and early-access experiments.',
            isTopTier: false
        };
    }
    return {
        badge: 'Starter',
        title: 'Starter keeps things simple and safe.',
        body: 'Perfect for trying the core experience: Award Stars (four virtues), Team Quest, Hero\'s Challenge, Ceremony of the Month, Quest Assignment & Attendance, Bounties, Mystic Market artifacts, Hero\'s Boon, Teacher Boon, and Projector Mode.',
        cta: 'Upgrade to Pro for guilds, Hero Path, calendar, Scholar\'s Scroll, the full Adventure Log, Family Portal — or Elite for AI, Familiars, Quiz of the Week, and the School Office.',
        isTopTier: false
    };
}

/**
 * Tagline for current plan (e.g. in Adventurer's Guide header)
 * @param {string} rawTier - 'starter' | 'pro' | 'elite'
 */
export function getTierTagline(rawTier) {
    const t = rawTier || 'starter';
    if (t === 'elite') return 'All features unlocked – enjoy the full quest!';
    if (t === 'pro') return 'Guilds, planners and advanced tools active.';
    return 'Core quest experience – perfect starting point.';
}

/**
 * Plan Tiers at a Glance: array of { tier, label, bullets }
 * Used in Adventurer's Guide and anywhere we list what each plan includes.
 */
export function getTiersAtAGlance() {
    return [
        {
            tier: 'Starter',
            label: 'Starter',
            bullets: 'Award Stars, Team Quest, Hero\'s Challenge, Ceremony of the Month, Quest Assignment & Attendance, Bounties, Mystic Market artifacts, Hero\'s Boon, Teacher Boon, Projector Mode, Hero\'s Chronicle notes.'
        },
        {
            tier: 'Pro',
            label: 'Pro',
            bullets: "Adds Guild Hall (Guild Power, Fortune's Wheel), Hero Path & Skill Tree, Quest Calendar & My Planning, Scholar's Scroll, Family Access, Attendance Chronicle, full Adventure Log (manual diary, Hero of the Day, Hall of Heroes)."
        },
        {
            tier: 'Elite',
            label: 'Elite',
            bullets: 'Everything in Pro plus Quiz of the Week, Story Weavers & Word of the Day, Familiars, School Office, and AI: Oracle, Avatar Forge, reports & certificates, story images, Adventure Log writer, Market Restock, Nameday Lookup.'
        }
    ];
}

/**
 * Log tab header/tagline and upsell for Starter (no adventureLog).
 * @param {boolean} hasAdventureLog - from canUseFeature('adventureLog')
 * @returns {{ tagline: string, upsellTitle: string, upsellBody: string }}
 */
export function getLogTabCopy(hasAdventureLog) {
    if (hasAdventureLog) {
        return {
            tagline: "Write the chronicle, crown a Hero of the Day, and revisit your class legends.",
            upsellTitle: '',
            upsellBody: ''
        };
    }
    return {
        tagline: 'Quest Assignment & Attendance — manage your class here.',
        upsellTitle: 'Unlock the full Adventure Log',
        upsellBody: "On Pro and above you'll see the full diary feed, Hall of Heroes, and 'Log Today's Adventure'. Upgrade to get the full experience."
    };
}

/**
 * Get upgrade message for a feature. Used by showUpgradePrompt when not passing custom message.
 * @param {string} targetTier - 'Pro' | 'Elite'
 * @param {string} [featureKey] - e.g. 'schoolYearPlanner', 'adventureLog'
 */
export function getUpgradeMessage(targetTier, featureKey) {
    const tierMsgs = UPGRADE_MESSAGES[targetTier];
    if (!tierMsgs) return UPGRADE_MESSAGES.Pro.default;
    if (featureKey && tierMsgs[featureKey]) return tierMsgs[featureKey];
    return tierMsgs.default;
}
