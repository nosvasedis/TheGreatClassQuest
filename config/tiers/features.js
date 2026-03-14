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
        teacherExplain: 'Split your class into four Guilds — Dragon Flame, Grizzly Might, Owl Wisdom, and Phoenix Rising — and run a magical sorting quiz to assign them. Every star students earn goes to their Guild\'s total, creating exciting team competition that makes even shy students invest in class participation. You can see guild standings, run Guild ceremonies, and celebrate champions together. 🏆',
        studentExplain: 'You belong to a Guild — your House in the Quest world! 🏰 Everything you do earns points for your team. Compete together, celebrate together, and fight for the top spot on the Guild leaderboard!'
    },
    calendar: {
        name: 'Calendar & Day Planner',
        emoji: '📅',
        description: 'Schedule, holidays, Quest Events',
        tier: 'Pro',
        teacherExplain: 'A full teaching calendar lives inside the app — plan your lessons, mark holidays, and schedule Quest Events like tests, parties, or challenges. You can add custom reminders and see your week at a glance. No more sticky notes! Every English lesson becomes a planned adventure. 📋✨',
        studentExplain: 'See what\'s coming up in your Quest! 📅 Your teacher can schedule special events, tests, celebrations and surprises — all visible in the calendar so you\'re always in the loop!'
    },
    scholarScroll: {
        name: "Scholar's Scroll",
        emoji: '📜',
        description: 'Tests, dictations, performance charts',
        tier: 'Pro',
        teacherExplain: "Track every test and dictation inside the app — log scores, mark make-up lessons, and see beautiful performance charts that show each student's progress over time. You get a clear academic picture of your whole class without drowning in paper records. The Scroll remembers everything so you don't have to! 📊",
        studentExplain: "Your Scholar's Scroll is your academic trophy wall! 📜 See your test scores, how you've improved over time, and challenge yourself to beat your own record. Every good grade is proof of your growing power! 💪"
    },
    storyWeavers: {
        name: 'Story Weavers',
        emoji: '📖',
        description: 'Collaborative story and Word of the Day',
        tier: 'Pro',
        teacherExplain: "Build collaborative stories with your students using the Story Weavers tool — each student adds a sentence or paragraph to a shared adventure tale. Combine it with Word of the Day to sneak in vocabulary naturally. It's creative writing, class bonding, and English practice stitched into one magical experience. ✍️🌟",
        studentExplain: "The whole class writes ONE story — and you're part of it! 📖 Each lesson you can add your piece to the adventure, use the Word of the Day, and watch the story grow into something amazing together! ✨"
    },
    heroProgression: {
        name: 'Hero Classes & Skill Tree',
        emoji: '⚔️',
        description: 'Class identity, leveling, and skill branches',
        tier: 'Pro',
        teacherExplain: "Every student picks a Hero Class — Guardian, Sage, Paladin, Artificer, Scholar, Weaver, or Nomad — each with its own personality and skill branches. As they earn XP in their class's specialty reason, they level up and unlock skills on their personal Skill Tree. This powerful identity engine makes students feel genuinely heroic and gives you a natural framework to reward different learning styles. ⚔️🧙",
        studentExplain: "Who is your hero? ⚔️ Choose your Hero Class — Guardian, Sage, Paladin, Artificer, Scholar, Weaver, or Nomad — and level up by earning stars in your specialty. Each level unlocks new skills on your Skill Tree, making your hero more powerful. Your adventure is YOUR adventure! 🌟"
    },
    adventureLog: {
        name: 'Adventure Log',
        emoji: '📓',
        description: 'Diary, Hall of Heroes, feed',
        tier: 'Pro',
        teacherExplain: "The Adventure Log is the living memory of your class — a story-style diary feed where you log what happened each lesson, celebrate highlights, and build a beautiful visual timeline of the year. The Hall of Heroes displays your top performers. On Elite, AI generates the story summaries for you automatically! 🖊️✨",
        studentExplain: "The Adventure Log is your class's story book! 📓 See what your teacher wrote about today's lesson, find YOUR name in the Hall of Heroes, and watch your class journey unfold like a real epic tale! 🏆"
    },
    schoolYearPlanner: {
        name: 'School Year Planner',
        emoji: '🗓️',
        description: 'Holidays, class end dates',
        tier: 'Pro',
        teacherExplain: "Set up your whole school year in one go — enter term dates, holidays, and class end-dates so the app always knows where you are in the academic calendar. Reminders and ceremonies automatically align with your school's rhythm. Set it once, forget about it, and let the Quest flow naturally all year. 🗓️🎯",
        studentExplain: "Your teacher has planned the whole Quest year! 🗓️ Holidays and special events are built into the adventure, so the timing of ceremonies and celebrations always matches your school calendar. 🌟"
    },
    makeupTracking: {
        name: 'Make-up Tracking',
        emoji: '🔄',
        description: 'Track make-up lessons',
        tier: 'Pro',
        teacherExplain: "Keep a clean record of which students have attended make-up lessons — log dates, mark completion, and never lose track of who still needs theirs. It integrates with attendance so your records are always complete. Great for private English schools managing flexible schedules! ✅📋",
        studentExplain: "If you missed a lesson, no worries! 🔄 Your teacher tracks make-up lessons in the Quest so nothing gets lost and you always get the chance to catch up on your adventure! 💪"
    },
    advancedAttendance: {
        name: 'Advanced Attendance',
        emoji: '📋',
        description: 'Chronicle and extra controls',
        tier: 'Pro',
        teacherExplain: "Go beyond a simple present/absent list — the Attendance Chronicle gives you a monthly calendar view, absence history per student, and smart insights. Spot patterns (a student always absent on Mondays?), generate reports, and keep airtight records for parents or school owners. Professionalism made easy. 📋📊",
        studentExplain: "Showing up consistently is part of being a true Hero! 📋 Your attendance is tracked in the Quest — heroes who keep their streak going earn extra respect from their teachers! ⭐"
    },
    eliteAI: {
        name: 'AI Magic ✨',
        emoji: '🤖',
        description: 'AI summaries, Hero Chronicle Oracle, story images',
        tier: 'Elite',
        teacherExplain: "The Elite AI suite brings magic to your classroom: the Oracle inside Hero's Chronicle analyses individual student data and generates personalised reports (Parent Summary, Teacher Strategy, Strengths/Weaknesses, Goal Suggestion), the AI Story Writer generates adventure log entries automatically, and AI Story Images create beautiful illustrated covers for your class stories. Less admin, more inspiration — powered by Gemini AI. 🤖✨🎨",
        studentExplain: "Your teacher has an AI Oracle inside Hero's Chronicle! 🤖✨ The Oracle helps your teacher understand your progress and give you better support. It's like having a magical advisor watching over your hero's journey! 🌟"
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
                    { emoji: '⭐', name: 'Award Stars', tier: 'starter', teacherExplain: 'Your most-used tool! Tap any student\'s avatar and award stars for participation, effort, creativity, correct answers, or any reason you define. Stars power the entire economy — students spend them in the Mystic Market, convert them to gold, and use them in ceremonies. Make it feel special and your students will feel it. ✨', why: 'The fastest way to energise a quiet class or reward a breakthrough moment.' },
                    { emoji: '💰', name: 'Mystic Market & Shop', tier: 'starter', teacherExplain: 'Students spend their earned stars and gold on items in the Mystic Market — Legendary Artifacts with special powers, Familiar eggs, and seasonal treasures. You control what\'s in the shop and set prices. The economy creates natural drive: students want to earn more so they can buy more. 🛒✨', why: 'Creates intrinsic motivation without external prizes or stickers.' },
                    { emoji: '🎁', name: "Hero's Boon", tier: 'starter', teacherExplain: "Hero's Boon is a peer-to-peer gift system — students can spend 15 Gold to bestow a Boon on a classmate, giving them +0.5 Stars! It teaches generosity and community spirit. Students treasure receiving Boons from their friends. Perfect for building classroom camaraderie and celebrating each other's achievements. 🎁💫", why: 'Teaches generosity and builds peer-to-peer connections in the classroom.' },
                    { emoji: '🏹', name: 'Quest Bounties', tier: 'starter', teacherExplain: 'Launch time-limited Quest Bounties — mini challenges with a star reward that students race to complete. Set a task ("First to read the paragraph correctly wins 5 stars!") and watch the energy in the room completely transform. Bounties are perfect for drilling vocabulary or comprehension in a fun, competitive way. 🏹⏱️', why: 'Instantly boosts engagement and creates memorable competitive moments.' },
                    { emoji: '🐉', name: 'Familiars', tier: 'starter', teacherExplain: "Each student adopts a Familiar — a magical creature egg that hatches and evolves as they earn stars. Familiars grow through multiple stages and are completely unique to each student. It's a powerful long-term engagement hook that makes kids actually excited to come to English class. 🐉🥚", why: 'Long-term progression that makes every star feel like it matters beyond today.' },
                    { emoji: '🎉', name: 'Ceremonies', tier: 'starter', teacherExplain: 'Monthly ceremonies are magical end-of-cycle celebrations — the app generates highlights, spotlights top heroes, announces champions, and plays celebration animations. Run it on your projector and your students will talk about it all week. No extra preparation needed — the Quest does it all! 🎉🏆', why: 'Creates emotional peaks that students look forward to every month.' },
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
                    { emoji: '🌳', name: 'Skill Tree', tier: 'pro', key: 'heroProgression', teacherExplain: 'The Skill Tree is each student\'s personal progression path — as they level up, they unlock new skills and abilities. You can see every student\'s tree, understand their growth trajectory, and celebrate milestones. It gives advanced students something to chase and weaker students a clear path to follow. 🌳⬆️', why: 'Makes improvement visible, tangible, and exciting rather than abstract.' },
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
                    { emoji: '📓', name: "Hero's Chronicle", tier: 'starter', teacherExplain: "Hero's Chronicle is your private notebook for each student — accessible from My Classes → Students → Chronicle button. Add notes by category (General, Academic, Behavioral, Social, Goals), track progress over time, and keep everything in one place. On Elite tier, the Oracle AI can analyse your notes plus trial scores and star awards to generate Parent Summaries, Teacher Strategies, Strengths/Weaknesses analyses, and Goal Suggestions. 📓✨", why: 'Keep detailed records without drowning in paperwork — and let AI help you spot patterns on Elite.' },
                    { emoji: '🔄', name: 'Make-up Tracking', tier: 'pro', key: 'makeupTracking', teacherExplain: FEATURE_DEFINITIONS.makeupTracking.teacherExplain, why: 'Perfect for private English schools with flexible scheduling — nothing slips through the cracks.' },
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
                    { emoji: '🗓️', name: 'School Year Planner', tier: 'pro', key: 'schoolYearPlanner', teacherExplain: FEATURE_DEFINITIONS.schoolYearPlanner.teacherExplain, why: 'One-time setup that makes the app smarter about your entire teaching year.' },
                    { emoji: '📓', name: 'Adventure Log', tier: 'pro', key: 'adventureLog', teacherExplain: FEATURE_DEFINITIONS.adventureLog.teacherExplain, why: 'Turns your lesson notes into a beautiful, shareable story your students will be proud of.' },
                ]
            },
            {
                id: 'creative',
                emoji: '✍️',
                title: 'Creative English Tools',
                color: 'cyan',
                intro: 'Story writing, vocabulary, and creative expression tools designed specifically for English language teachers.',
                features: [
                    { emoji: '📖', name: 'Story Weavers', tier: 'pro', key: 'storyWeavers', teacherExplain: FEATURE_DEFINITIONS.storyWeavers.teacherExplain, why: 'Makes creative writing collaborative, exciting, and something students actually want to do.' },
                    { emoji: '💬', name: 'Word of the Day', tier: 'pro', key: 'storyWeavers', teacherExplain: "Launch a Word of the Day each lesson — students learn the word, use it actively, and earn stars for using it correctly in context. It's vocabulary building disguised as a fun daily ritual. Over a school year, students accumulate a rich vocabulary bank they genuinely remember. 💬📚", why: 'Vocabulary sticks when it comes with a story, a context, and a star reward.' },
                    { emoji: '🗺️', name: 'Quest World Map', tier: 'starter', teacherExplain: 'The Quest World Map visualises your class\'s collective progress through the school year as a literal adventure journey. Students can see how far they\'ve come and what exciting territory lies ahead. Display it on the projector to create a shared sense of adventure. 🗺️⚔️', why: 'Transforms abstract progress into a visual journey students can feel proud of.' },
                    { emoji: '🖥️', name: 'Projector Mode', tier: 'starter', teacherExplain: "Switch to Projector Mode and the app transforms into a beautiful, animated classroom display — perfect for showing on your classroom projector or smart board. Students see their heroes, the leaderboard, ceremony animations, and the Quest world in full cinematic style. 🖥️🎬", why: 'Turns your classroom screen into an immersive Quest experience that excites students the moment they walk in.' },
                ]
            },
            {
                id: 'ai',
                emoji: '🤖',
                title: 'AI Magic ✨',
                color: 'indigo',
                intro: 'The most advanced frontier of The Great Class Quest — AI-powered tools that save you time and spark creativity.',
                features: [
                    { emoji: '🔮', name: "Hero's Chronicle Oracle", tier: 'elite', key: 'eliteAI', teacherExplain: "Inside each student's Hero's Chronicle (My Classes → Students → Chronicle), the Oracle AI generates four types of personalised reports: Parent Summary (for parent-teacher meetings), Teacher Strategy (actionable classroom tips), Strengths/Weaknesses Analysis, and Goal Suggestions. The Oracle reads all the student's notes, trial scores, and star awards to give you insights you might have missed. 🔮✨", why: 'Saves hours of analysis and helps you support every student as an individual.' },
                    { emoji: '✍️', name: 'AI Adventure Log Writer', tier: 'elite', key: 'eliteAI', teacherExplain: 'After each lesson, the AI automatically generates a beautifully written Adventure Log entry based on what happened in class — stars awarded, bounties completed, achievements earned. You can edit or publish as-is. It turns admin into a magical storybook in seconds! ✍️🤖', why: 'Eliminates the time cost of writing lesson logs while making them richer than ever.' },
                    { emoji: '🎨', name: 'AI Story Images', tier: 'elite', key: 'eliteAI', teacherExplain: 'Generate illustrated cover images for your class stories using AI — beautiful, fantasy-themed artwork created just for your class\'s unique adventure. Students see their story as a real illustrated book. It\'s creative, memorable, and completely unique. 🎨🖼️', why: 'Transforms student writing into something visually stunning that they are genuinely proud of.' },
                    { emoji: '🦸', name: 'AI Avatar Generator', tier: 'elite', key: 'eliteAI', teacherExplain: 'Students create unique AI-generated avatars! They choose a creature type, colour scheme, and accessory, and the AI creates a personalised chibi-style character just for them. Each avatar is completely unique — no two heroes look the same! 🦸✨', why: 'Students feel genuinely attached to their unique identity in the Quest world.' },
                    { emoji: '📄', name: 'AI Reports & Certificates', tier: 'elite', key: 'eliteAI', teacherExplain: 'Generate AI-powered weekly class reports with insights and suggestions, plus beautifully styled certificates with AI-generated personalised text for each student. Perfect for parent meetings and celebrating achievements! 📄🏅', why: 'Professional, personalised output that impresses parents and saves hours of writing.' },
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
                { emoji: '⭐', name: 'Earning Stars', tier: 'starter', studentExplain: 'Stars are your EXP points! 🌟 Your teacher awards them for speaking English, answering questions, helping classmates, being creative, or completing challenges. Every star brings you closer to new items, new abilities, and a more powerful hero!', why: 'Every star is proof that you\'re growing as an English hero! 💪' },
                { emoji: '🛒', name: 'Mystic Market', tier: 'starter', studentExplain: 'Spend your stars and gold in the Mystic Market! 🛒✨ Buy Legendary Artifacts with special powers, Familiar eggs, and seasonal treasures. The shop has rare items too — save up for the big ones! Your inventory is your treasure chest of hard-earned rewards.', why: 'Every item you buy is proof of how much you\'ve participated and grown! 🏆' },
                { emoji: '🎁', name: "Hero's Boon", tier: 'starter', studentExplain: "A Hero's Boon is a special gift you can give to a classmate! 🎁💫 It costs 15 Gold, and the receiver gets +0.5 Stars! When someone gives you a Boon, it means they think you did something legendary. You can also save up your Gold to surprise a friend with one!", why: "It's a way to celebrate your friends and build team spirit! ✨" },
                { emoji: '🏹', name: 'Quest Bounties', tier: 'starter', studentExplain: 'When your teacher launches a Bounty, a challenge appears with a star reward attached! 🏹⏱️ Race to complete it first, or be the best at it, to claim the prize. Bounties are fast, exciting, and completely change the energy of the lesson!', why: 'The fastest way to earn big stars and show off your English skills! 🌟' },
                { emoji: '🐉', name: 'Your Familiar', tier: 'starter', studentExplain: "Your Familiar is your magical companion — it starts as an egg and hatches and evolves as you earn stars! 🐉🥚 Every Familiar is unique. Feed it with your hard work and watch it grow into something spectacular. Don't let it down — it's counting on you!", why: "A growing creature that's entirely YOURS, reflecting your entire journey. 💫" },
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
                { emoji: '🌳', name: 'Skill Tree', tier: 'pro', studentExplain: 'As you level up, you unlock branches on your personal Skill Tree! 🌳✨ Each skill makes you more powerful in different ways. Some students focus on combat skills, others on magic — your tree tells the story of your growth as a hero.', why: 'Levelling up means YOU are visibly, undeniably getting stronger. 💪' },
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
                { emoji: '📖', name: 'Story Weavers', tier: 'pro', studentExplain: FEATURE_DEFINITIONS.storyWeavers.studentExplain, why: "Your sentences become part of a REAL story your whole class writes together! ✍️" },
                { emoji: '💬', name: 'Word of the Day', tier: 'pro', studentExplain: "Every lesson there\'s a special Word of the Day! 💬📚 Learn it, use it in conversation or writing, and earn bonus stars. It's a tiny challenge that builds your vocabulary into something superpower-level by the end of the year!", why: 'Small daily words = huge vocabulary by the end of the year. 🌟' },
                { emoji: '📜', name: "Scholar's Scroll", tier: 'pro', studentExplain: FEATURE_DEFINITIONS.scholarScroll.studentExplain, why: 'Watching your own scores improve is incredibly motivating! 📈' },
                { emoji: '🗺️', name: 'Quest Map', tier: 'starter', studentExplain: 'The Quest Map shows your class\'s collective journey through the year like an epic fantasy map! 🗺️⚔️ Every milestone your class hits moves you further into new, exciting territory. It\'s visual proof of how far you\'ve all come together!', why: 'Progress feels REAL when you can see it on a map! 🌍' },
            ]
        },
        {
            id: 'celebrations',
            emoji: '🎉',
            title: 'Events & Celebrations',
            color: 'rose',
            intro: "The Quest isn't just about lessons — it's about those legendary moments you remember forever!",
            features: [
                { emoji: '🎉', name: 'Monthly Ceremonies', tier: 'starter', studentExplain: "At the end of each month, your class holds a ceremony! 🎉🏆 The app displays the top heroes, guild champions, and highlight moments in a beautiful, animated celebration — sometimes shown on the projector for the whole class to see. Will YOUR name be in the spotlight?", why: 'Your hard work deserves a real celebration every single month! 🌟' },
                { emoji: '🏆', name: 'Hall of Heroes', tier: 'pro', studentExplain: "The Hall of Heroes displays the greatest heroes in your class — students who showed outstanding performance, growth, or spirit. Getting featured in the Hall of Heroes is a true honour. It lives in the Adventure Log for everyone to see. 🏆👑", why: 'True legends get remembered — could your name be there? ✨' },
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
        message: 'Manage your schedule, holidays, and Quest Events.'
    },
    'scholars-scroll-tab': {
        feature: FEATURE_DEFINITIONS.scholarScroll.name,
        tier: 'Pro',
        message: 'Track tests, dictations, and performance charts.'
    },
    'reward-ideas-tab': {
        feature: FEATURE_DEFINITIONS.storyWeavers.name,
        tier: 'Pro',
        message: 'Collaborative story and Word of the Day.'
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
        schoolYearPlanner: 'Planning tools (holidays, class end dates) unlock with Pro.',
        advancedAttendance: 'The Attendance Chronicle (month view and history) is available on the Pro plan.',
        heroProgression: 'Hero Classes and Skill Tree progression are available on the Pro plan.',
        maxClasses: 'You have reached your plan limit. Upgrade to add more classes.',
        maxTeachers: 'Your school has reached the teacher limit. Upgrade to add more teachers.'
    },
    Elite: {
        default: 'AI-powered features unlock on the Elite plan. Contact me to upgrade.',
        adventureLog: 'The AI-powered diary and storybook image are on the Elite plan.'
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
            body: 'All AI-powered features unlocked: Hero\'s Chronicle Oracle, AI avatars, AI reports & certificates, AI story images, AI adventure log writer, plus full analytics, planning, guilds, story weavers and every classroom magic trick.',
            cta: 'Thank you for being a founding legend of The Great Class Quest.',
            isTopTier: true
        };
    }
    if (t === 'pro') {
        return {
            badge: 'Pro Power',
            title: 'Pro unlocks guilds, planners and advanced logs.',
            body: "You have access to Guilds, Hero Classes & Skill Tree progression, the Calendar & School Year Planner, Story Weavers, Scholar's Scroll, and the full Adventure Log.",
            cta: 'Upgrade to Elite to add AI-assisted summaries, Hero\'s Chronicle Oracle, and early-access experiments.',
            isTopTier: false
        };
    }
    return {
        badge: 'Starter',
        title: 'Starter keeps things simple and safe.',
        body: 'Perfect for trying the core experience: award stars, run ceremonies, use Quest Assignment & Attendance, and manage Familiars, Bounties, and the Mystic Market.',
        cta: 'Upgrade to Pro to unlock guilds, hero classes, planners, story tools and the full Adventure Log — or go straight to Elite for AI-powered features like avatars, reports, and Hero\'s Chronicle Oracle.',
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
            bullets: 'Core stars, ceremonies, Quest Assignment & Attendance, Familiars, Bounties, Mystic Market, Hero\'s Boon, Quest World Map, Projector Mode, Hero\'s Chronicle (note-taking).'
        },
        {
            tier: 'Pro',
            label: 'Pro',
            bullets: "Adds Guilds, Hero Classes & Skill Tree progression, Calendar & School Year Planner, Story Weavers, Scholar's Scroll, full Adventure Log (diary, Hall of Heroes)."
        },
        {
            tier: 'Elite',
            label: 'Elite',
            bullets: 'Everything in Pro plus AI-powered features: Hero\'s Chronicle Oracle (AI insights), AI avatars, AI reports & certificates, AI story images, AI adventure log writer, early-access experiments and priority support.'
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
            tagline: "A visual diary of your class's epic journey!",
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
