// config/guide/adventurersGuide.js
// Content of the Adventurer's Guide (the (i) button in the header): a short field guide
// to the app as it is today. The full handbook lives in docs/product; keep these lines
// consistent with it when a screen changes.
//
// Entry fields:
//   id, icon (Font Awesome class), name, tier ('starter' | 'pro' | 'elite'),
//   where (how to reach it), go ('tab:<tab-id>' | 'options:<section>', optional),
//   text (what it is and how to use it), why (optional), keys (extra search words).

export const GUIDE_AUDIENCES = ['teacher', 'class'];

export const GUIDE_CHAPTERS = {
    teacher: [
        {
            id: 'start',
            icon: 'fa-compass',
            color: '#b7852b',
            title: 'Start here',
            intro: 'How a lesson runs, the three races, and the names to keep apart.',
            special: 'teacher-start'
        },
        {
            id: 'stars',
            icon: 'fa-star',
            color: '#d97706',
            title: 'Stars in the lesson',
            intro: 'Award Stars is the heart of every lesson. Everything else in the Quest reads from these taps.',
            entries: [
                {
                    id: 'award-stars', icon: 'fa-star', name: 'Award Stars', tier: 'starter',
                    where: 'Award Stars tab', go: 'tab:award-stars-tab',
                    text: `Every student is a cloud. Tap one of the four virtue gems (Teamwork, Creativity, Respect, Focus), then Spark (1 star), Shine (2) or Supernova (3). The cloud seals with a stamp such as "+2 ★ for Teamwork", and the round Undo button in its corner takes it back. Every star also pays 1 Gold.`,
                    why: `One honest tap moves the map, the ranks, the guild, the purse and the month's ceremony. Keep Supernova rare so it still means something.`,
                    keys: 'virtue gems spark shine supernova teamwork creativity respect focus clouds undo'
                },
                {
                    id: 'welcome-back', icon: 'fa-cloud-sun-rain', name: 'Absence and Welcome Back', tier: 'starter',
                    where: 'Award Stars clouds', go: 'tab:award-stars-tab',
                    text: `The small corner button on a cloud marks a student absent, and the cloud turns into a grey rain cloud. Next lesson a welcome desk offers Welcome back! (0.5 to 2 stars, more after a longer absence), Present, or Away today. A welcomed child can still earn a virtue star in the same lesson.`,
                    why: 'Coming back is honoured first, then the child still gets to play.',
                    keys: 'absent present attendance grey rain cloud welcome desk returning'
                },
                {
                    id: 'special-days', icon: 'fa-cake-candles', name: 'Birthdays and name days', tier: 'starter',
                    where: 'Dates live in the Adventurer\'s Passport', go: 'options:classes',
                    text: `Set a Birthday and a Name day on the student's Passport (Elite can find the name day from the name). On the day, the first star adds a gift: +2.5 stars for a birthday, +1.5 for a name day. Home and the projector announce it as well.`,
                    keys: 'birthday nameday name day celebration bonus'
                },
                {
                    id: 'heros-boon', icon: 'fa-heart', name: "Hero's Boon", tier: 'starter',
                    where: 'The heart on each cloud', go: 'tab:award-stars-tab',
                    text: `A classmate spends 15 Gold to give +0.5 stars to someone in the bottom three this month, or in a tie. Up to 4 boons per class per day, never to yourself, and never to the same classmate twice in a row. A glowing pink heart with +½ means that student can receive one. Compassion Token makes boons free for a month.`,
                    why: 'Generosity with fair rules the whole class can see.',
                    keys: 'peer gift heart generosity compassion token'
                },
                {
                    id: 'teacher-boon', icon: 'fa-gift', name: 'Teacher Boon', tier: 'starter',
                    where: 'Rose-gold seal above the clouds, last 7 days of the month', go: 'tab:award-stars-tab',
                    text: `In the last week of the month a gift seal appears on Award Stars. Pick one hero, pick a reason (Leadership, Perseverance, Kindness, Bravery, Helping Others, Remarkable Growth, or your own words) and bestow 2 stars. Once per class per month. It shows as a ribbon in the Ceremony of the Month.`,
                    why: 'Names the character the four gems cannot quite capture.',
                    keys: 'month end gift seal ribbon 2 stars'
                },
                {
                    id: 'bounties', icon: 'fa-scroll', name: 'Quest Bounties', tier: 'starter',
                    where: 'Home, Bounty button in the class greeting', go: 'tab:about-tab',
                    text: `A shared challenge on a bounty poster, for the whole class, one guild, or chosen heroes (for example one table); a group bounty only counts its own children's stars and sizes its targets to the group. Star Hunt: earn a number of stars together within two hours to win a reward, with Quick win, Fair fight and Heroic targets based on how this class usually earns. Race the Clock: finish a task before a countdown runs out; Until the bell sets it to the end of the lesson. Live bounties sit on the bounty board and on the projector.`,
                    keys: 'bounty poster star hunt race the clock timer countdown reward guild group table chosen heroes'
                },
                {
                    id: 'bonus-days', icon: 'fa-bolt', name: 'Bonus days', tier: 'pro',
                    where: 'Quest Calendar, tap a day, Quest Event', go: 'tab:calendar-tab',
                    text: `2× Star Day doubles every star awarded that day. Reason Bonus Day gives +1 extra star on one chosen virtue. Both apply to every class that meets that day, and the Award Stars sky shows which bonus is on.`,
                    keys: 'double star day reason bonus quest event'
                }
            ]
        },
        {
            id: 'races',
            icon: 'fa-flag-checkered',
            color: '#be123c',
            title: 'The three races',
            intro: 'Class against class this month, student against student, and house against house all year. They never mix.',
            entries: [
                {
                    id: 'team-quest', icon: 'fa-map-location-dot', name: 'Team Quest', tier: 'starter',
                    where: 'Team Quest tab', go: 'tab:class-leaderboard-tab',
                    text: `Classes in the same Quest League race across Bronze Meadows, Silver Peaks, Golden Citadel and Crystal Realm. Position is this month's stars against a goal the app sets for you: lower in months with holidays or cancelled lessons, a little higher each time a class finishes the map. History opens the League Archive of past months.`,
                    why: 'Every star moves the whole class, so nobody is a lonely high-scorer.',
                    keys: 'league map class race monthly goal league archive history realms'
                },
                {
                    id: 'heros-challenge', icon: 'fa-crown', name: "Hero's Challenge", tier: 'starter',
                    where: "Hero's Challenge tab", go: 'tab:student-leaderboard-tab',
                    text: `Student against student, By Class or Global, Monthly or Total stars. Each class opens on a podium, and rank changes glide into place when you come back after awarding. Tap a portrait for the Hero Stage: stars, Gold, the satchel, Hero stats and the Skill Tree. Spending Gold never lowers a rank.`,
                    keys: 'leaderboard ranks podium hero stage student race'
                },
                {
                    id: 'ceremony', icon: 'fa-trophy', name: 'Ceremony of the Month', tier: 'starter',
                    where: 'Home glows when a new month begins', go: 'tab:about-tab',
                    text: `Run it once per class, early in the new month, on the projector. Pre-Junior gets the Growth Festival garden with no ranks. Every other league gets the Classic Arena: Team Quest places first, then the Hero's Challenge, ending with the Prodigy of the Month (or two Co-Prodigies). There is no ceremony for August. If you stop halfway, it picks up where you left off.`,
                    keys: 'prodigy of the month co-prodigy classic arena growth festival monthly ceremony'
                },
                {
                    id: 'prodigies-trophies', icon: 'fa-landmark', name: 'Hall of Prodigies and Trophy Room', tier: 'starter',
                    where: "Buttons on Hero's Challenge", go: 'tab:student-leaderboard-tab',
                    text: `The Hall of Prodigies is a sunlit marble hall with one crowned Prodigy for each finished month of this school year. The Trophy Room holds every hero's satchel: relics ready to use, effects working now, and treasures kept for good.`,
                    keys: 'hall of prodigies trophy room satchel relics inventory treasures'
                },
                {
                    id: 'guild-hall', icon: 'fa-shield-halved', name: 'Guild Hall', tier: 'pro',
                    where: 'Guild Hall tab', go: 'tab:guilds-tab',
                    text: `Four houses race for the whole school year: Dragon Flame, Grizzly Might, Owl Wisdom and Phoenix Rising. Every star gives the house 2 Glory. Each month is a Chapter: the house whose members earn the most Glory each, on average, wins it, so a small busy house can beat a big one. Chapters pay Crowns (5, 3, 2, 1), plus one more for a house where at least 4 in 5 members earned 3 stars. Most Crowns in June wins the year. Tap an emblem for the house banner, or the note for its anthem.`,
                    why: 'Belonging across ages. A student\'s guild is theirs for life.',
                    keys: 'guilds houses glory crown race crowns chapter unity seal guild power dragon flame grizzly might owl wisdom phoenix rising anthem'
                },
                {
                    id: 'fortunes-wheel', icon: 'fa-dharmachakra', name: "Fortune's Wheel", tier: 'pro',
                    where: 'Guild Hall, on the last lesson of the week', go: 'tab:guilds-tab',
                    text: `A weekly ritual with the class watching. During a class's last lesson of the week, each guild spins its own wheel in turn. Treasure wedges give Glory to each guildmate in the class, stars, Gold, artifacts or Team Quest stars. Twists bring drama (a respin, three chests, double or nothing, a kindness gift, the Trickster), trials put a quick English challenge to the guild, and storms take a little Glory or Gold, never stars or artifacts. Most storms can be braved with a right answer. The Fortune Ledger keeps every spin of the year.`,
                    keys: 'wheel spin fortune ledger weekly storm twist trial chests trickster'
                },
                {
                    id: 'grand-ceremony', icon: 'fa-chess-rook', name: 'Grand Guild Ceremony', tier: 'pro',
                    where: 'Home, when the year ends in June', go: 'tab:about-tab',
                    text: `The year-end Midsummer Festival. Its chapters recall the Heroes of the Day, each class's road, the Prodigy crowns and the year's wonders. Then the guild pillars are revealed from last place up and the house with the most Crowns is crowned. Nobody is re-sorted.`,
                    keys: 'june year end guild crowning festival'
                }
            ]
        },
        {
            id: 'gold',
            icon: 'fa-coins',
            color: '#047857',
            title: 'Gold and the Market',
            intro: 'Stars are the honour; Gold is what a hero can spend. Shopping never changes a rank.',
            entries: [
                {
                    id: 'gold', icon: 'fa-sack-dollar', name: 'Gold', tier: 'starter',
                    where: 'The purse on every cloud',
                    text: `Every star also pays 1 Gold, kept in its own purse. Extra Gold comes from Hero Path matches, Fortune's Wheel, Quiz of the Week and some artifacts. Gold belongs to this school year: finishing the year starts every purse again at 0. Repairs live in Teacher Settings, Student Tools.`,
                    keys: 'purse coins currency treasury coin purse'
                },
                {
                    id: 'market', icon: 'fa-store', name: 'Mystic Market', tier: 'starter',
                    where: 'Mystic Market tab', go: 'tab:shop-tab',
                    text: `Pick the class and a shopper; the Market Keeper reads their purse. Fifteen Legendary Artifacts are always in stock at fixed prices, with two legendary buys per student per month. A few favourites: Time Warp Hourglass (+5 minutes on a Race the Clock bounty), Pathfinder's Map (+10 Team Quest stars) and Mask of the Protagonist (the next Hero of the Day). Purchases wait in the Trophy Room.`,
                    keys: 'shop artifacts legendary shopper buy market keeper hourglass pathfinder mask'
                },
                {
                    id: 'seasonal', icon: 'fa-leaf', name: 'Seasonal and Festival stalls', tier: 'elite',
                    where: 'Mystic Market tab', go: 'tab:shop-tab',
                    text: `A monthly stall of 15 treasures that follows the classroom season and suits each league's age, with limited copies of each. Every stall is one of the month's collections, and the round brass Restock button on the counter brings a brand-new stall from a different one. A Festival Stall opens for Halloween, Christmas, New Year's Luck, Apokries, Easter, May Day and the End of Year Fair. The reigning Hero of the Day gets 25% off this shelf. Teacher Settings, Market repairs or replaces a piece.`,
                    keys: 'restock festival stall seasonal treasures collection halloween christmas new year vasilopita easter apokries may day end of year discount'
                },
                {
                    id: 'familiars', icon: 'fa-dragon', name: 'Familiars', tier: 'elite',
                    where: 'Eggs on the Mystic Market', go: 'tab:shop-tab',
                    text: `One companion per student, bought as an egg. It hatches after 20 more stars, evolves at 60 and at 140 stars, and then walks beside the avatar on every board.`,
                    keys: 'egg pet companion hatch evolve'
                }
            ]
        },
        {
            id: 'heroes',
            icon: 'fa-hat-wizard',
            color: '#6d28d9',
            title: 'Heroes and identity',
            intro: 'Who each child is becoming: a profile, a vocation, a guild and a face of their own.',
            entries: [
                {
                    id: 'passport', icon: 'fa-passport', name: "Adventurer's Passport", tier: 'starter',
                    where: 'Teacher Settings, My Classes, Students, Edit', go: 'options:classes',
                    text: `Each student's profile as an open passport: portrait, name, class, guild, quest record, Birthday and Name day stamps, and the Hero path visa. Shortcuts open the Chronicle, analytics, certificate, Avatar Forge and Skill Tree.`,
                    keys: 'student profile edit student roster dates'
                },
                {
                    id: 'hero-classes', icon: 'fa-shield', name: 'Hero Classes', tier: 'pro',
                    where: 'The Class shield on the roster', go: 'options:classes',
                    text: `Eight vocations, each tied to one way of earning stars: Guardian (Respect), Sage (Creativity), Paladin (Teamwork), Artificer (Focus), Vanguard (every Training Grounds game), Scholar (Starfall), Nomad (Welcome Back) and Patron (giving a Hero's Boon). A matching star pays +10 Gold. The class can change twice a school year, and No Class is a fine choice too.`,
                    why: 'Help each child choose how they already shine, not the path with the most Gold.',
                    keys: 'hero path vocation guardian sage paladin artificer weaver scholar nomad patron'
                },
                {
                    id: 'skill-tree', icon: 'fa-sitemap', name: 'Skill Tree', tier: 'pro',
                    where: 'The Skills button on the roster', go: 'options:classes',
                    text: `At each level the child picks one of two permanent skills: extra Gold for themselves, bonus stars, or gifts to classmates and guildmates. The Skills button pulses when a choice is waiting. From level 3 a coloured aura ring shows on the boards. When the whole path is complete, a gold crown opens the class's Legend Quest: a small personal challenge done in three different lessons, each one confirmed by you. It pays no Gold or stars; the title turns gold on the Hero's Challenge and on the certificate.`,
                    keys: 'level up skills aura ascension path branches legend quest capstone crown gold title'
                },
                {
                    id: 'sorting', icon: 'fa-hat-wizard', name: 'Guild Sorting', tier: 'pro',
                    where: 'The hat on the roster (students with no guild)', go: 'options:classes',
                    text: `A 7-question Sorting Ceremony made for the projector. The orb takes on the colours the answers lean toward, then a drum roll reveals the house. The house is kept for life.`,
                    keys: 'sorting quiz sorting ceremony guild placement hat'
                },
                {
                    id: 'avatar-forge', icon: 'fa-user-astronaut', name: 'Avatar Forge', tier: 'elite',
                    where: 'The Avatar button on the roster', go: 'options:classes',
                    text: `Choose a creature, a colour and a relic, then Strike the Anvil for a painted portrait. It appears on clouds, boards, certificates and the Family Portal. Keep it, or strike again.`,
                    keys: 'avatar portrait ai image forge'
                },
                {
                    id: 'certificate', icon: 'fa-award', name: 'Hero Certificate', tier: 'starter',
                    where: 'The Certificate button on the roster', go: 'options:classes',
                    text: `An illuminated A4 page in the child's guild colours, for this month (Monthly Quest) or the whole year (Legend's Journey), with the honours the app found. Every plan sees the preview; on Elite the Oracle writes the citation and you save the PDF.`,
                    keys: 'certificate pdf praise print oracle citation'
                }
            ]
        },
        {
            id: 'close',
            icon: 'fa-book-open',
            color: '#0f766e',
            title: 'End of the lesson',
            intro: 'Homework, the class diary, the Hero of the Day and a quiet moment at the fire.',
            entries: [
                {
                    id: 'quest-assignment', icon: 'fa-thumbtack', name: 'Quest Assignment', tier: 'starter',
                    where: 'Adventure Log, the left flying button', go: 'tab:adventure-log-tab',
                    text: `The Quest Board: write next lesson's homework (numbered lines become a checklist) and pin a test if one is coming. Families see it on the Family Portal. On Pro, the book it names also tells the Hero Campfire which words were practised.`,
                    keys: 'homework quest board test schedule assignment'
                },
                {
                    id: 'adventure-log', icon: 'fa-feather-pointed', name: 'Adventure Log', tier: 'pro',
                    where: 'Adventure Log tab', go: 'tab:adventure-log-tab',
                    text: `Crown Today's Hero once stars have been awarded: one press reveals the Hero of the Day. After Huzzah!, choose how to write today's page: Auto (Elite) or Manual, where you write the whole page and upload a picture or, on Elite, paint one from your words. Later keeps the page blank in the diary until you return. On Elite the Chronicler weaves a personal diary from recorded lesson activity across the class: tests and dictations, homework and book work, quiz and stories, calendar events and holidays, birthdays, awards and boons, bounties, guilds, Hero Paths, Familiars, Market finds, Campfire and Ember Oaths. Upcoming plans stay distinct from things completed today; individual grades and private messages stay private. Edit lets you polish your page, upload or delete a picture, and on Elite retry just the AI picture. Picture changes take effect with Save changes; Cancel discards them. What we learned today fills itself in, and later AI rewrites use the saved lesson snapshot.`,
                    keys: 'diary log today crown hero auto manual chronicler ai story what we learned picture upload paint delete retry tests dictations holidays'
                },
                {
                    id: 'hero-of-the-day', icon: 'fa-crown', name: 'Hero of the Day', tier: 'pro',
                    where: 'Crowned when you save today\'s page',
                    text: `You never pick the name. A student holding the Mask of the Protagonist wins; otherwise a fair rotation of the students who are present. Perks: +1 on their first star today, 25% off the seasonal shelf, and a legend rank for this year's crowns. This is not the Prodigy of the Month.`,
                    keys: 'hero of the day crown daily spotlight mask rotation'
                },
                {
                    id: 'hall-of-heroes', icon: 'fa-image-portrait', name: 'Hall of Heroes', tier: 'pro',
                    where: 'Adventure Log tab', go: 'tab:adventure-log-tab',
                    text: `This year's Hero of the Day portraits: the top three framed, the rest in a gallery, and Waiting for their first crown so no child is invisible. 3, 5 and 10 crowns earn Rising, Golden and Mythic Legend discounts in the Market.`,
                    keys: 'hall of heroes gallery legend rank crowns'
                },
                {
                    id: 'campfire', icon: 'fa-fire', name: 'Hero Campfire', tier: 'pro',
                    where: 'Adventure Log, after the Hero of the Day', go: 'tab:adventure-log-tab',
                    text: `Gather at the Campfire opens a two-minute reflection on the projector: today's stars light the fire, practised words glow as embers, one question to talk about, a class glow, and a check-in on a few Ember Oaths. No ranks and no Gold. It never opens by itself.`,
                    keys: 'campfire reflection embers words question'
                },
                {
                    id: 'ember-oaths', icon: 'fa-hand-sparkles', name: 'Ember Oaths', tier: 'pro',
                    where: 'Adventure Log, Ember Oaths button', go: 'tab:adventure-log-tab',
                    text: `Small personal promises each child picks in a Choosing ceremony. Evidence fills itself from stars and trials. Once it glows and the child has checked in with 🔥, keep the promise: a Star-Ember keepsake goes to the Trophy Room and a star joins the class sky.`,
                    keys: 'oaths promises goals star-ember choosing ceremony'
                },
                {
                    id: 'attendance', icon: 'fa-clipboard-user', name: 'Attendance Chronicle', tier: 'pro',
                    where: 'Adventure Log, the right flying button', go: 'tab:adventure-log-tab',
                    text: `A month register you can tap to change, with holidays, attendance %, lessons held and Perfect Attendees. Older months are read only. On Starter, mark absences on the Award Stars clouds.`,
                    keys: 'attendance register absences perfect attendees month'
                }
            ]
        },
        {
            id: 'learning',
            icon: 'fa-graduation-cap',
            color: '#1d4ed8',
            title: 'Learning and records',
            intro: 'Tests, the weekly quiz, the class storybook, the calendar and your private notes.',
            entries: [
                {
                    id: 'scholars-scroll', icon: 'fa-scroll', name: "Scholar's Scroll", tier: 'pro',
                    where: "Scholar's Scroll tab", go: 'tab:scholars-scroll-tab',
                    text: `Log New Trial opens a marking board with the whole class on one sheet: tap a grade stamp or type a score and press Enter, and stamp anyone absent. View History to edit a trial. Pending make-ups stay listed until you log or dismiss them. A dictation is a written vocabulary check: children write the words they have learned, so it is never a listening or speaking task.`,
                    keys: 'tests dictations grades trial marking board make-ups history'
                },
                {
                    id: 'starfall', icon: 'fa-meteor', name: 'Starfall', tier: 'pro',
                    where: "After you save a trial on Scholar's Scroll", go: 'tab:scholars-scroll-tab',
                    text: `The app may offer bonus stars: +1 for a test at 95% or more, +0.5 for a run of strong dictations, and +0.5 Growth Starfall for a child who climbed well above their own average. You confirm each one; nothing is forced.`,
                    keys: 'scholar bonus growth starfall bonus stars'
                },
                {
                    id: 'quiz', icon: 'fa-circle-question', name: 'Quiz of the Week', tier: 'elite',
                    where: 'Set up in Teacher Settings, Quiz. Play from Home', go: 'options:quiz',
                    text: `Generate questions from this week's lessons, and choose whether to review them first or bring back last week's missed questions. On the class's first lesson of the week, during lesson time, a ticket on Home opens the quiz-show stage. Each child earns from their own answers: 1 star for a first try, ½ for a rescue (2 at most), +1 Gold for a brave try. The class score sets the Team Quest bonus, and one Quiz Champion wins a treasure from the league's Mystic Market stall.`,
                    keys: 'quiz game show weekly review questions'
                },
                {
                    id: 'training-grounds', icon: 'fa-bullseye', name: 'Training Grounds', tier: 'elite',
                    where: 'Training Grounds tab', go: 'tab:reward-ideas-tab',
                    text: `Four class games, one for each hero skill, matched to the class's Quest League. Story Weavers (Creativity): the class writes a storybook a sentence at a time around a Word of the Day, and Elite paints each page. The Vanishing Hoard (Focus): watch the dragon's treasures, then spot what vanished. The Torn Map (Teamwork): every group holds one clue, and only by sharing them can the class find the answer. The Round Table (Respect): pass the Speaking Stone, echo the last speaker and let nobody interrupt. One round per lesson counts, and every second round won can give the whole class +0.5 stars of that skill.`,
                    keys: 'training grounds story weavers word of the day creative writing storybook pdf vanishing hoard memory focus torn map clues groups teamwork round table speaking stone respect listening'
                },
                {
                    id: 'calendar', icon: 'fa-calendar-days', name: 'Quest Calendar', tier: 'pro',
                    where: 'Quest Calendar tab', go: 'tab:calendar-tab',
                    text: `Lessons, stars, holidays and Quest Events for the month. Tap a day for the Day Planner: cancel a lesson, add a one-off lesson, mark a one-day closure, or summon an event. Long holidays belong to the School Office; each class's last lesson day is set in My Planning.`,
                    keys: 'calendar day planner holidays cancel lesson my planning schedule'
                },
                {
                    id: 'special-quests', icon: 'fa-dungeon', name: 'Special Quests', tier: 'pro',
                    where: 'Quest Calendar, tap a day, Quest Event', go: 'tab:calendar-tab',
                    text: `One-lesson challenges for a class: Vocabulary Vault, Grammar Guardians, The Unbroken Chain, The Scribe's Sketch and Five-Sentence Saga. Run it from that day, then reward the children who took part with stars and Gold.`,
                    keys: 'vocabulary vault grammar guardians unbroken chain scribe sketch five sentence saga'
                },
                {
                    id: 'chronicle', icon: 'fa-book-bookmark', name: "Hero's Chronicle", tier: 'starter',
                    where: 'The Chronicle button on the roster', go: 'options:classes',
                    text: `Your private notebook for each child: dated notes by category, their Oaths (Pro), and on Elite the Oracle's Parent Summary, Teacher Strategy, Traits & Trends and Hero's Goal. Families only ever see what you publish.`,
                    keys: 'notes oracle parent summary teacher strategy private notebook'
                },
                {
                    id: 'weekly-report', icon: 'fa-chart-column', name: 'Weekly report', tier: 'elite',
                    where: 'Report on a class card, or on Home', go: 'options:classes',
                    text: `The Week's Scroll for one class: stars by day and virtue, who shone, who is waiting to be noticed, attendance and trials, then the Oracle's reading with a Mini-Quest and a note for families. Copy it or save a PDF.`,
                    keys: 'report week scroll oracle mini-quest families pdf'
                }
            ]
        },
        {
            id: 'screens',
            icon: 'fa-display',
            color: '#475569',
            title: 'Screens and settings',
            intro: 'Home, the classroom TV, Teacher Settings and the phone.',
            entries: [
                {
                    id: 'home', icon: 'fa-house', name: 'Home', tier: 'starter',
                    where: 'The first cloud', go: 'tab:about-tab',
                    text: `The command centre. General view shows the whole school and today's schedule; tap any class for its roster. With a class selected you see its Quest progress road, the class photo, the latest Chronicle, class actions, and reminders for birthdays, tests and the ceremony.`,
                    keys: 'home dashboard reminders schedule greeting weather'
                },
                {
                    id: 'follow-schedule', icon: 'fa-location-crosshairs', name: "Follow today's schedule", tier: 'starter',
                    where: 'The class picker in the header',
                    text: `On whenever you open the app: the Quest switches to the class that is in session, or General view between lessons. Picking a class by hand pauses it until you choose Follow again. Almost every tab works on this class.`,
                    keys: 'class picker selector general view current class'
                },
                {
                    id: 'projector', icon: 'fa-tv', name: 'Projector Mode', tier: 'starter',
                    where: 'The TV button in the header (classroom PC)',
                    text: `A living sky for the classroom display: a huge clock, the lesson ring, the class banner and Sky Cards that change about once a minute. Move the mouse for the remote: Space pins a card, → skips, D opens the Sky Deck, Esc leaves. Keep teaching on your usual tabs meanwhile.`,
                    keys: 'projector tv wallpaper sky window sky cards remote sky deck clock'
                },
                {
                    id: 'settings', icon: 'fa-gear', name: 'Teacher Settings', tier: 'starter',
                    where: 'The cog in the header', go: 'options:classes',
                    text: `My Classes (create and edit classes, open the roster), Student Tools (repair stars or Gold), Profile (your Quest Master name and this browser's Quest cursor switch), and on Pro and Elite My Planning, Class Grading, Family Access, Quiz and Market. Switch jumps between sheets.`,
                    keys: 'settings my classes student tools profile roster class grading'
                },
                {
                    id: 'phone', icon: 'fa-mobile-screen', name: 'On your phone', tier: 'starter',
                    where: 'Any phone browser',
                    text: `Five clouds at the bottom: Home, Team Quest, Hero's Challenge, Award Stars and More. Tap the class crest in the header to change class. This guide and Log out sit in the More sheet. Projector Mode stays on the classroom PC.`,
                    keys: 'mobile phone more sheet dock'
                }
            ]
        },
        {
            id: 'school',
            icon: 'fa-people-roof',
            color: '#be185d',
            title: 'Families and the Office',
            intro: 'The same school year, seen by parents and by the person who runs it.',
            entries: [
                {
                    id: 'family-portal', icon: 'fa-house-chimney-user', name: 'Family Portal', tier: 'pro',
                    where: 'Teacher Settings, Family Access', go: 'options:access',
                    text: `One login per child. Families see the week at a glance, homework, the star jar, test results (when the class records them), attendance and messages with the school. Never your private Chronicle.`,
                    keys: 'parents family access login portal messages'
                },
                {
                    id: 'school-office', icon: 'fa-building-shield', name: 'School Office', tier: 'elite',
                    where: 'The shield in the header (Secretary access)',
                    text: `Where the school year is run: classes for each teacher, enrolling new students, seating returning ones, holidays, the opening day, grading defaults and family messages. Teachers teach; the Office keeps the calendar honest.`,
                    keys: 'secretary office admin holidays enrol students school year'
                }
            ]
        },
        {
            id: 'plans',
            icon: 'fa-key',
            color: '#a16207',
            title: 'Your plan',
            intro: 'What Starter, Pro and Elite each open. A locked button always shows the truth for your school.',
            special: 'plans'
        }
    ],

    class: [
        {
            id: 'welcome',
            icon: 'fa-compass',
            color: '#b7852b',
            title: 'Welcome, hero',
            intro: 'English class is a quest, and every lesson is a new chapter of it.',
            special: 'class-welcome'
        },
        {
            id: 'stars',
            icon: 'fa-star',
            color: '#d97706',
            title: 'Earning stars',
            intro: 'Stars are how the Quest says "we saw that".',
            entries: [
                {
                    id: 'virtues', icon: 'fa-gem', name: 'The four virtues', tier: 'starter',
                    text: `Your teacher gives stars for Teamwork (helping and listening), Creativity (a new idea or a surprising sentence), Respect (kindness and care for the room) and Focus (effort on something hard). A Spark is 1 star, a Shine is 2, and a Supernova is 3!`,
                    keys: 'teamwork creativity respect focus spark shine supernova'
                },
                {
                    id: 'star-gold', icon: 'fa-coins', name: 'Every star is Gold too', tier: 'starter',
                    text: `Each star you earn also puts 1 Gold in your purse. Stars move you up the ranks; Gold is what you spend in the Mystic Market.`,
                    keys: 'gold purse'
                },
                {
                    id: 'welcome-back', icon: 'fa-cloud-sun', name: 'Welcome back', tier: 'starter',
                    text: `Missed a lesson? When you come back, your teacher can welcome you with bonus stars, and you can still earn more stars that same lesson.`,
                    keys: 'absent return'
                },
                {
                    id: 'special-days', icon: 'fa-cake-candles', name: 'Birthdays and name days', tier: 'starter',
                    text: `On your birthday or your name day, the first star you earn comes with a gift of extra stars. The whole class gets to cheer!`,
                    keys: 'birthday name day'
                },
                {
                    id: 'heros-boon', icon: 'fa-heart', name: "Hero's Boon", tier: 'starter',
                    text: `You can spend 15 Gold to give a classmate half a star. The glowing heart shows who can receive one right now: classmates who need a lift this month. You can't gift yourself.`,
                    keys: 'gift boon heart kindness'
                }
            ]
        },
        {
            id: 'races',
            icon: 'fa-flag-checkered',
            color: '#be123c',
            title: 'Our races',
            intro: 'Three races run at the same time, and you are part of all of them.',
            entries: [
                {
                    id: 'team-quest', icon: 'fa-map-location-dot', name: 'Team Quest', tier: 'starter',
                    text: `Our class travels a map with other classes of our age: Bronze Meadows, Silver Peaks, Golden Citadel and Crystal Realm. Every star anyone earns moves the whole class forward. A new race starts every month.`,
                    keys: 'map class race'
                },
                {
                    id: 'heros-challenge', icon: 'fa-crown', name: "Hero's Challenge", tier: 'starter',
                    text: `Your own stars this month, next to your classmates'. Shopping never lowers your place, because rank is only stars.`,
                    keys: 'ranks leaderboard podium'
                },
                {
                    id: 'ceremony', icon: 'fa-trophy', name: 'Ceremony of the Month', tier: 'starter',
                    text: `At the start of each month we celebrate the last one: first the class race, then the Prodigy of the Month is crowned. The youngest classes have a Growth Festival in a flower garden instead.`,
                    keys: 'prodigy of the month ceremony crown'
                },
                {
                    id: 'guilds', icon: 'fa-shield-halved', name: 'Your guild', tier: 'pro',
                    text: `You belong to one of four houses: Dragon Flame, Grizzly Might, Owl Wisdom or Phoenix Rising. Your stars give your house Glory. Every month your house races for Crowns, and in June the house with the most Crowns is crowned. Your guild is yours for life!`,
                    keys: 'house glory dragon grizzly owl phoenix'
                },
                {
                    id: 'wheel', icon: 'fa-dharmachakra', name: "Fortune's Wheel", tier: 'pro',
                    text: `On the last lesson of the week each guild spins the wheel. It can bring Glory, stars, Gold or a treasure, a twist like three chests or a coin flip, a quick English challenge... or a little storm. Answer together and your shield can stop the storm!`,
                    keys: 'wheel spin storm chest trickster'
                }
            ]
        },
        {
            id: 'treasure',
            icon: 'fa-coins',
            color: '#047857',
            title: 'Gold and treasures',
            intro: 'What you can do with the Gold you earn.',
            entries: [
                {
                    id: 'market', icon: 'fa-store', name: 'Mystic Market', tier: 'starter',
                    text: `Spend Gold on Legendary Artifacts with real powers, like more time on a bounty clock or a guaranteed turn as Hero of the Day. You can buy two legendary items a month.`,
                    keys: 'shop artifacts'
                },
                {
                    id: 'trophy-room', icon: 'fa-box-open', name: 'Your satchel', tier: 'starter',
                    text: `Everything you buy waits in your satchel in the Trophy Room until you use it. Treasures you win stay there for good.`,
                    keys: 'trophy room inventory'
                },
                {
                    id: 'seasonal', icon: 'fa-leaf', name: 'Seasonal treasures', tier: 'elite',
                    text: `Every month new treasures arrive on the market stall, and a Festival Stall appears before the holidays. When one sells out, it's gone!`,
                    keys: 'festival seasonal'
                },
                {
                    id: 'familiar', icon: 'fa-dragon', name: 'Your Familiar', tier: 'elite',
                    text: `Buy an egg and look after it with your stars. It hatches after 20 stars and grows into a bigger creature as you keep earning.`,
                    keys: 'egg pet'
                }
            ]
        },
        {
            id: 'hero',
            icon: 'fa-hat-wizard',
            color: '#6d28d9',
            title: 'Your hero',
            intro: 'Who you are in the Quest, and how you grow.',
            entries: [
                {
                    id: 'hero-class', icon: 'fa-shield', name: 'Your Hero Class', tier: 'pro',
                    text: `Guardian, Sage, Paladin, Artificer, Vanguard, Scholar, Nomad or Patron. Each class grows from one kind of star, and every matching star gives you 10 extra Gold. The Vanguard grows from all four Training Grounds games.`,
                    keys: 'hero class vocation'
                },
                {
                    id: 'skill-tree', icon: 'fa-sitemap', name: 'Skill Tree', tier: 'pro',
                    text: `When you level up, you choose one of two skills. Keep the Gold for yourself, or share it with your classmates and your guild? It's your choice.`,
                    keys: 'skills level up aura'
                },
                {
                    id: 'hero-of-the-day', icon: 'fa-crown', name: 'Hero of the Day', tier: 'pro',
                    text: `At the end of the lesson one hero who is here today is crowned. Everyone gets a turn! You get +1 star on your first award and a discount in the Market.`,
                    keys: 'crown daily'
                },
                {
                    id: 'avatar', icon: 'fa-user-astronaut', name: 'Your avatar', tier: 'elite',
                    text: `Pick a creature, a colour and something to hold, and the Avatar Forge paints a portrait that is only yours.`,
                    keys: 'avatar portrait'
                }
            ]
        },
        {
            id: 'adventures',
            icon: 'fa-dungeon',
            color: '#0f766e',
            title: 'Class adventures',
            intro: 'The special moments that make a lesson feel like a quest.',
            entries: [
                {
                    id: 'bounties', icon: 'fa-scroll', name: 'Bounties', tier: 'starter',
                    text: `A bounty poster goes up: earn enough stars together, or beat the clock, and you win the reward. Sometimes it is for the whole class, sometimes just for one guild or one table.`,
                    keys: 'bounty timer'
                },
                {
                    id: 'quiz', icon: 'fa-circle-question', name: 'Quiz of the Week', tier: 'elite',
                    text: `Once a week the quiz show comes to our class. The spotlight picks a hero for each question, and if you get it wrong, the question passes on. Your own right answers win you stars, and the Quiz Champion wins a treasure from the Mystic Market.`,
                    keys: 'quiz game show'
                },
                {
                    id: 'training-grounds', icon: 'fa-bullseye', name: 'Training Grounds', tier: 'elite',
                    text: `Four class games: write a storybook together, spot the treasure that vanished from the dragon's hoard, share your group's clue to mend the torn map, and pass the Speaking Stone at the Round Table. Win two rounds and the whole class earns a star!`,
                    keys: 'training grounds story word of the day hoard map round table'
                },
                {
                    id: 'special-quests', icon: 'fa-dungeon', name: 'Special Quests', tier: 'pro',
                    text: `Some lessons hold a special quest, like filling the Vocabulary Vault or keeping an Unbroken Chain going. Finish it together and win stars and Gold.`,
                    keys: 'vocabulary vault grammar guardians chain saga sketch'
                },
                {
                    id: 'campfire', icon: 'fa-fire', name: 'Campfire and Ember Oaths', tier: 'pro',
                    text: `At the end of some lessons we sit around the campfire, remember our words and make small promises. Keep your promise and a Star-Ember joins our class sky.`,
                    keys: 'campfire oath promise star-ember'
                }
            ]
        }
    ]
};

// Special pages ---------------------------------------------------------------

export const LESSON_ROUTE = [
    {
        icon: 'fa-location-crosshairs',
        title: 'Open the class',
        text: `Follow today's schedule is on when you open the app, so the class in session is already chosen. Home shows today's reminders.`
    },
    {
        icon: 'fa-star',
        title: 'Award stars as it happens',
        text: `Teamwork, Creativity, Respect or Focus, one to three stars. Welcome back a returning student and let a classmate give a Hero's Boon when the heart glows.`
    },
    {
        icon: 'fa-thumbtack',
        title: 'Set the next quest',
        text: `Near the end, write the Quest Assignment and check who was here.`
    },
    {
        icon: 'fa-feather-pointed',
        title: "Crown today's Hero",
        text: `One press crowns the Hero of the Day (Pro). After Huzzah!, write today's page with Auto (Elite) or Manual, or keep it for later. Then, if you like, gather at the Campfire for two minutes.`
    },
    {
        icon: 'fa-calendar-week',
        title: 'When the week calls for it',
        text: `Quiz of the Week on the first lesson (Elite), Fortune's Wheel on the last (Pro), and a Training Grounds game whenever the class is ready to play (Elite).`
    }
];

export const THREE_RACES = [
    { icon: 'fa-map-location-dot', name: 'Team Quest', who: 'Class against class', when: 'Starts again every month', crown: 'Ceremony of the Month', tier: 'starter' },
    { icon: 'fa-crown', name: "Hero's Challenge", who: 'Student against student', when: 'Monthly and all-year ranks', crown: 'Prodigy of the Month', tier: 'starter' },
    { icon: 'fa-shield-halved', name: 'Guild Hall', who: 'House against house', when: 'The whole school year', crown: 'Grand Guild Ceremony', tier: 'pro' }
];

export const NAMES_APART = [
    { a: 'Hero of the Day', aNote: 'daily, from the Adventure Log', b: 'Prodigy of the Month', bNote: 'monthly, at the ceremony' },
    { a: 'Hall of Heroes', aNote: 'this year\'s Heroes of the Day', b: 'Hall of Prodigies', bNote: 'each month\'s Prodigy' },
    { a: "Hero's Boon", aNote: 'a classmate\'s gift, +0.5 for 15 Gold', b: 'Teacher Boon', bNote: 'your gift, +2 in the month\'s last week' },
    { a: 'Ceremony of the Month', aNote: 'every month, class then student', b: 'Grand Guild Ceremony', bNote: 'once a year, the houses in June' }
];

export const HEADER_KEYS = [
    { icon: 'fa-info', name: 'This guide' },
    { icon: 'fa-tv', name: 'Projector Mode' },
    { icon: 'fa-building-shield', name: 'School Office' },
    { icon: 'fa-gear', name: 'Teacher Settings' }
];

export const CLASS_DAY = [
    { icon: 'fa-door-open', title: 'Arrive', text: 'Your hero is waiting on the screen, with the stars you earned last time.' },
    { icon: 'fa-star', title: 'Shine', text: 'Speak English, help a friend, try the hard thing. Your teacher is watching for it!' },
    { icon: 'fa-coins', title: 'Collect', text: 'Every star is Gold too. Save it, spend it, or give a friend a boon.' },
    { icon: 'fa-crown', title: 'Celebrate', text: 'A Hero of the Day, a finished bounty, a crowned Prodigy. Big moments, all year.' }
];

export const PLAN_TIERS = [
    {
        tier: 'starter',
        name: 'Starter',
        line: 'A beautiful star classroom.',
        items: ['Award Stars and Welcome Back', 'Team Quest and Hero\'s Challenge', 'Ceremony of the Month', 'Mystic Market artifacts', 'Bounties, Hero\'s Boon, Teacher Boon', 'Quest Assignment', 'Projector Mode', 'Hero\'s Chronicle notes']
    },
    {
        tier: 'pro',
        name: 'Pro',
        line: 'Adds houses, a calendar and the class diary.',
        items: ['Guild Hall and Fortune\'s Wheel', 'Hero Classes and Skill Trees', 'Quest Calendar and Special Quests', 'Scholar\'s Scroll and Starfall', 'Adventure Log and Hero of the Day', 'Hero Campfire and Ember Oaths', 'Attendance Chronicle', 'Family Portal']
    },
    {
        tier: 'elite',
        name: 'Elite',
        line: 'The Quest writes and paints with you.',
        items: ['Quiz of the Week', 'Training Grounds', 'Familiars and seasonal stalls', 'School Office', 'AI diary and pictures', 'Avatar Forge', 'The Oracle, reports and certificates']
    }
];
