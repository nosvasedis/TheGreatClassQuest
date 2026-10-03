<div align="center">

<p>
  <img src="assets/great-class-quest-logo.svg" alt="The Great Class Quest logo" width="132" />
</p>

<h1>⭐ The Great Class Quest 🚀</h1>

<p><strong>The Ultimate Gamified Classroom Management System</strong></p>

<p>
  <img alt="Designed for Teachers Families and School Office" src="https://img.shields.io/badge/Designed%20For-Teachers%20%7C%20Families%20%7C%20School%20Office-blueviolet" />
  <img alt="Platform Web Browser" src="https://img.shields.io/badge/Platform-Web%20Browser-blue" />
  <img alt="Focus Positive Reinforcement" src="https://img.shields.io/badge/Focus-Positive%20Reinforcement-brightgreen" />
  <img alt="Status Live" src="https://img.shields.io/badge/Status-Live-success" />
  <img alt="Economy Gold and Artifacts" src="https://img.shields.io/badge/Economy-Gold%20%26%20Artifacts-orange" />
  <img alt="AI powered by DeepSeek V4.1 Flash" src="https://img.shields.io/badge/AI-DeepSeek%20V4.1%20Flash-2864DC" />
  <img alt="Data Firebase Firestore" src="https://img.shields.io/badge/Data-Firebase%20Firestore-FFCA28" />
</p>

<p><em>"Turn every lesson into a quest, every challenge into a milestone, and every student into a hero."</em></p>

</div>

---

## 📖 Table of Contents

| Section | Description |
|--------|--------------|
| [Project Overview](#-project-overview) | What the app is and who it's for |
| [Three Interfaces](#-three-interfaces) | Teacher, School Office, Family Portal |
| [The Quest Master's Philosophy](#-the-quest-masters-philosophy) | Four pedagogical pillars |
| [Navigation at a Glance](#-navigation-at-a-glance) | Ten classroom tabs plus Teacher Settings |
| [Core Gameplay Loop](#-core-gameplay-loop) | Setup → Award Stars → Adventure Log |
| [The Economy System](#-the-economy-system-gold--mystic-market) | Gold, Mystic Market, Legendary Artifacts, Hero Path (Pro), Boons, Familiars |
| [Home Dashboard](#-home-dashboard) | Weather, schedule, tools, class/school view |
| [Team Quest](#-team-quest) | League map, monthly goals, ceremony |
| [Hero's Challenge](#-heros-challenge) | Student ranks, Trophy Room, Hero Stats, Hall of Prodigies, certificates |
| [Guilds & Factions](#-guilds--factions) | Guild Hall, the Crown Race, Fortune's Wheel, year-long race |
| [My Classes & Roster](#-my-classes--roster) | Classes and roster (inside Teacher Settings) |
| [Award Stars](#-award-stars) | Reasons, effects, bounties, Hero's Boon |
| [Adventure Log](#-adventure-log) | Diary, Hero of the Day, Hall of Heroes, attendance, homework |
| [Scholar's Scroll](#-scholars-scroll) | Tests, dictations, Starfall, makeup, performance chart |
| [Quest Calendar & Planner](#-quest-calendar--planner) | Schedule, cancellations, holidays, Quest Events |
| [Live Classroom: Projector Mode](#-live-classroom-projector-mode) | The Director, cards, clock, celebrations |
| [Quest Bounties](#-quest-bounties) | Short-term group challenges |
| [Special Quest Types](#-special-quest-types) | Vocabulary Vault, Unbroken Chain, and more |
| [Story Weavers](#-story-weavers) | Collaborative story writing with AI illustrations |
| [AI & Creative Tools](#-ai--creative-tools) | Avatar Forge, Nameday lookup, reports, Story Weavers |
| [Tracking & Analytics](#-tracking--analytics) | Hero's Chronicle, Attendance, certificates |
| [Teacher Settings](#-teacher-settings) | My Classes (opens first), Student Tools, planning, grading, Family Access, Quiz, Market |

---

## 🌍 Project Overview

**The Great Class Quest** is a sophisticated web application that gamifies the classroom experience. It replaces traditional behavior charts with a living, breathing RPG-style interface.

- **Triple-layer competition:** Class vs. class on the **Team Quest** map, student vs. student in **Hero's Challenge** for rank and **Prodigy of the Month**, and **guild vs. guild** in a year-long race toward the **Grand Guild Ceremony**.
- **Automated tracking:** Stars, gold, inventory, tests, attendance, and logs are stored in **Firestore** and stay in sync.
- **AI-powered narrative (Elite):** **DeepSeek V4.1 Flash** writes daily chronicles, certificates, reports, and story text.
- **Live display:** **Projector Mode** turns a classroom PC into a real-time quest dashboard with day/night, weather-aware sky, rotating Director cards, and celebrations.

Teachers in the app can open **The Adventurer's Guide** (information button) for a short classroom explainer.

---

## 🏫 Three Interfaces

The same school year is shared. Each person only sees what they need. All three layouts also exist on **mobile**; the **teacher desktop** is the classroom-PC home (Projector Mode is not on the phone).

| Interface | Who | What it is for |
|-----------|-----|----------------|
| **Teacher** | Classroom teacher | The full Quest: ten tabs, Award Stars, ceremonies, Market. **Starter**, **Pro**, and **Elite**. |
| **School Office** (Secretary) | School-year admin | Classes for each teacher, new students, student placement, holidays, year open/close, school grading defaults, family messages. **Elite.** |
| **Family Portal** (Parent) | One login per child | Progress, homework, attendance snapshot, calm messages. **Pro and Elite.** |

Students do not log in. They see the Quest on the classroom screen.

---

## 📜 The Quest Master's Philosophy

The app is built on four pedagogical pillars:

| Pillar | Description |
|--------|-------------|
| **Triple-layer motivation** | **Team Quest:** The class advances together on a map (belonging). **Hero's Challenge:** Students compete for rank and Prodigy status (accountability). **Guild Hall:** Cross-age houses race all year in the **Crown Race**, a month-by-month race for Crowns (identity). |
| **Tangible "Gold" Economy** | Stars become purchasing power. The **Mystic Market** (seasonal + **Legendary Artifacts**) and **Hero's Boon** (peer-to-peer gift) teach delayed gratification and generosity. |
| **Visual Feedback Loops** | Progress is never abstract: progress bars, floating stats, growing avatars, **League Map** zones (Bronze Meadows → Silver Peaks → Golden Citadel → Crystal Realm), and **Projector Mode** keep the quest visible. |
| **AI as the "Dungeon Master"** | On **Elite**, AI narrates daily logs, suggests words for Story Weavers, generates avatars and certificates, and powers **Hero's Chronicle** Oracle reports. On **Pro**, the same rituals exist with more of the teacher's own words. |

---

## 🧭 Navigation at a Glance

The teacher **bottom bar has ten tabs**. **My Classes** and roster tools live under the header **cog** (Teacher Settings), not as an eleventh tab.

| Tab | Purpose |
|-----|---------|
| **Home** | Weather, greeting, school or class stats, reminders, shortcuts, **Quiz of the Week** play (Elite). |
| **Team Quest** | Class vs class **League Map** (Bronze Meadows → Silver Peaks → Golden Citadel → Crystal Realm), monthly goal (holidays/cancellations), start of **Ceremony of the Month**. |
| **Hero's Challenge** | Student ranks (**By Class / Global**, Monthly / Total). **Trophy Room**, Hero Stats, **Hall of Prodigies**, certificates. Guild *badges* appear on rows; guild *ranking* is Guild Hall. |
| **Mystic Market** | Own tab. Spend Gold on **Legendary Artifacts**, Elite **seasonal** stock, Elite **Festival Stall**, Elite **Familiar** eggs. |
| **Guild Hall** | Year-long houses ranked by **Crowns** in the Crown Race. Champions, lore, anthems, **Fortune's Wheel**, **Fortune Ledger**, Magical Analytics, **Grand Guild Ceremony**. **Pro.** |
| **Award Stars** | Clouds; Teamwork, Creativity, Respect, Focus (1–3 stars); Welcome Back; **Hero's Boon**; **Teacher Boon**. |
| **Adventure Log** | **Crown Today's Hero**, then write today's page: **Auto** (AI + image, Elite) or **Manual** (Pro). Records **What we learned today** automatically (quiz, story, quests, trials, homework). FABs: **Quest Assignment** (recognises the book, unit and pages), **Attendance Chronicle**. **Gather at the Campfire** (Pro) lights up after the crowning. **Hall of Heroes** = Hero of the Day legends (not Prodigies). |
| **Scholar's Scroll** | Tests, dictations, Starfall, make-ups, charts. **Pro.** |
| **Quest Calendar** | Month grid, Day Planner, Quest Events. School-wide holidays are set in the **School Office**. **Pro.** |
| **Story Weavers** | Collaborative story, Word of the Day, AI art, PDF print. **Elite.** |

**Teacher Settings** (cog): opens on **My Classes**. Other sections in the dropdown — Student Tools, My Planning (class end dates), Profile, Class Grading, Family Access, Quiz, Market.

---

## 🧭 Core Gameplay Loop

### 1. Setup & Roster (**My Classes**)
- **Class:** Name, logo, schedule (days/times), **Quest League** (difficulty/age).
- **Roster:** Add students; each has Total Stars, Monthly Stars, Gold, Inventory, **Hero Class**, avatar, birthday, nameday.
- **Personalization:** Edit student → Birthday, **Nameday** (Elite: **AI Nameday Lookup** for the Greek Orthodox calendar), **Hero Path** (Pro; **Choose Hero Class** ceremony — first choice free, then lock if they change).

### 2. The Daily Session (**Award Stars**)
- Choose a student and one of the four virtues (**Teamwork**, **Creativity**, **Respect**, **Focus**) at 1–3 stars. **Welcome Back** is an absence flow on the cloud, not a fifth reason button. **Scholar’s Bonus** comes from Starfall; **Story Weaver** stars come from the Story Weavers tab.
- **Visual feedback:** Particle effects + unique sound (e.g. Magic Chime).
- Data (timestamp, reason, value) is written to Firestore; on **Pro**, **Hero Path** can grant **+10 Gold** for a matching reason and extra Gold or stars from that hero’s **Skill Tree**.

### 3. The End-of-Day Ritual (**Adventure Log**)
- **"Crown Today's Hero"** (once per class per day, after stars). One press crowns **Hero of the Day**; after **Huzzah!** a **Today's Page** card offers **Auto** (Elite: the Chronicler writes it) or **Manual** (you write the whole page, with an uploaded picture or, on Elite, one painted from your words). **Later** keeps the crowned page blank in the diary until you write it.
- **Pro:** you write the diary and can add your own picture. **Elite:** AI writes a personal diary across the class's recorded activities and a **storybook-style** illustration. It includes tests and dictations, learning and homework, calendar events and holidays, and the class's other rituals when relevant. Upcoming plans stay distinct from completed activities; individual grades and private messages are excluded.
- Entry is stored and can be revisited; **Pathfinder's Map** and **Mask of the Protagonist** can be reflected in the narrative.
- **Hero Campfire (Pro, optional):** after Hero of the Day, **Gather at the Campfire** opens a 2-minute projector reflection: the words the class practised (from the last Quest Assignment and its book unit), one reflection question, a class glow check, and check-ins on **Ember Oaths** (small personal promises). Kept oaths become stars in the class sky and a **Star-Ember** keepsake, never stars or Gold.

---

## 💰 The Economy System: Gold & Mystic Market

### 🪙 Gold Coins
- **Earning:** 1 Star = 1 Gold. **Bonus Gold:** e.g. "2× Star Day," **Hero Path** match (+10, Pro), **Skill Tree** perks (Pro), **Scroll of the Gilded Star** (3× next star), Wheel, Quiz of the Week.
- **Spending** Gold does **not** lower Leaderboard rank (Total Stars are separate).

### 🎪 Mystic Market (own tab)
- **Seasonal stock (Elite):** AI fills **15** kinds for the month and league (5 common / 5 rare / 5 seasonal trophies) with copies (Common 5, Rare 2, Legendary 1). September is harvest/back-to-school, not Halloween. Restock brings a fresh monthly stall; today’s treasures stay until the new pictures are ready. Buying spends one copy. If the stall sells out, it restocks itself.
- **Festival Stall (Elite):** Halloween, Christmas, Orthodox Easter, and Carnival appear about 22 days before the feast and vanish the day after. A sold-out Festival Stall gets a new batch at end of day.
- **Legendary Artifacts:** Always available; **two legendary buys per student per month**, plus extra limits on Pathfinder (1/class/month) and Mask (1/student/month).
- **Purchase:** Items appear in **Trophy Room** / enlarged avatar. Reigning **Hero of the Day** gets **25%** off seasonal prices (this year's Rising / Golden / Mythic legend discounts can add more, combined cap **40%**). Last year's crowns stay in last year's archive.

### ⚔️ Legendary Artifacts (Power-Ups)

| Artifact | Price | Effect |
|----------|-------|--------|
| **Crystal of Clarity** | 15 | Hint-pass glow on the student’s card. |
| **Scroll of the Gilded Star** | 20 | Next star = **3× Gold**. |
| **Time Warp Hourglass** | 25 | **+5 minutes** on active class bounty timers. |
| **Elixir of Luck** | 30 | 50% chance of **+1 star** on the next lesson’s first award. |
| **Aurum Satchel** | 32 | **50% off** next Market purchase this month. |
| **Banner of Glory** | 35 | Next **3** stars each write **+1 bonus Guild Glory**. |
| **The Herald's Banner** | 40 | School-wide celebration toast. |
| **Fortune’s Favor** | 48 | The guild’s next Fortune’s Wheel in this class is gilded (no commons, no Trickster). |
| **The Starfall Catalyst** | 50 | **Double** the next high-test Starfall bonus. |
| **Chalice of Unity** | 55 | +1 Glory right away for the student and every guildmate in the class. |
| **Compassion Token** | 55 | Hero's Boon costs **0 Gold** for the rest of the month. |
| **The Pathfinder’s Map** | 60 | Instant **+10** Team Quest stars (class limit: 1/month). |
| **Archivist's Quill** | 62 | Next Story Weaver class bonus is **1★ instead of 0.5**. |
| **The Mask of the Protagonist** | 75 | Guarantees **Hero of the Day** on the next log (1/student/month). |
| **Guild Standard** | 75 | The student’s name flies on the guild’s column for this Chapter, plus +2 Glory. |

*Use from Trophy Room / enlarged avatar; consuming applies the effect and removes the item.*

### 🛡️ Hero Classes & Skill Trees (Pro)
Students on **Pro** (and Elite) can choose a **Hero Path** class (Guardian, Sage, Paladin, Artificer, Scholar, Weaver, Nomad, Patron).

- **Class Reasons:** Each class is tied to a reason (e.g. Guardian → Respect, Sage → Creativity, Scholar → Scholar's Bonus, Nomad → Welcome Back, Patron → giving Hero's Boon).
- **Leveling:** Guardian, Sage, Paladin, Artificer, and Weaver climb **five** levels (stars in that virtue: 20 / 45 / 70 / 95 / 120). **Scholar**, **Nomad**, and **Patron** climb **three** (10 / 20 / 30) because Scholar's Bonus, Welcome Back, and Hero's Boon gifts are rarer. Patron counts **weeks with a gift given** (one path point per calendar week), not rank stars on the giver. Thresholds assume a **full September–June year**.
- **Branching Skill Tree:** At each level, the student chooses **one of two** permanent skills (e.g. “extra Gold when *you* earn Respect” vs. “small Gold bonus to guildmates when *they* earn Respect”). Skills can:
  - Grant **extra Gold** to the hero on matching reasons.
  - Add **bonus stars** (Total + Monthly) when they excel in their class’s reason.
  - Share Gold with **classmates** or **guildmates** on matching reasons.
  - Trigger a **once-per-month guild boost** the first time they play to their class’s strength that month.
- **Visual Aura:** From **level 3**, the student’s avatar gains a class-coloured aura ring on the leaderboard.

Hero Path is optional. The first class choice is free; **changing** class after having one **locks** the path.

### 🐾 Familiars (Animated Pets, Elite)
Students can spend Gold on **Familiar Eggs** in the **Mystic Market**. Each student can own **one Familiar** at a time:

- **Egg Purchase (Elite):** Five lines — Thornback (30 Gold), Frostpaw (35), Emberfang (40), Veilshade (45), Sparkling (50).
- **Hatching:** **20** stars earned after purchase. Elite generates a 4-frame sprite sheet.
- **Evolution:** Level 2 at **60** stars since hatch; Level 3 at **140** stars since hatch.
- **Display:** Familiars sit **next to the avatar** on the student leaderboard and appear as a large animated companion in the **enlarged avatar overlay**. Tapping/clicking the Familiar opens a **Familiar Stats** panel (name, current form, “stars together,” and progress to next evolution).
- **Sounds & Feel:** Hatching and evolution trigger dedicated **sound cues** and celebratory toasts, turning long-term consistency into a visible, emotionally resonant payoff.

### 🎁 Hero's Boon and Teacher Boon
- **Hero's Boon (peer gift):** From Award Stars. Cost **15 Gold** (unless Compassion Token). Receiver **+0.5** stars. **Max 4 per class per day.** Receiver must be in the **bottom 3** monthly stars *or* in a **tie group**. No self-gift. Cannot gift the same classmate twice in a row.
- **Teacher Boon:** Last **7 days** of the month, **2 stars**, **once per class per month**, named reasons (Leadership, Perseverance, Kindness, Bravery, Helping Others, Remarkable Growth, or custom).
- The reigning **Hero of the Day** also gets **+1** on their first award that day (labelled “Includes Hero's Boon”) — that is not the 15 Gold gift.

---

## 🏠 Home Dashboard

The **Home** tab is your command center and adapts to **weather** and **time of day**.

- **Header:** AI-generated **inspirational quote** (cached daily); background shifts with **weather** (sunny, cloudy, rainy, snowy, stormy) and **day/night** (sunrise/sunset from your location).
- **Time-based greeting:** Good Morning / Afternoon / Evening / Night with matching gradient.
- **View modes:**
  - **No class selected:** School-wide stats (School Stars, Heroes count, Treasury), **Global Tools** (only shortcuts the bottom bar does not reach in one click: **Plan Today**, **New Class**, **Quiz of the Week**, **Family Access**, **Hero Archive**, **Team Archive**, with live hints), and **School Schedule** for today.
  - **Class selected:** That class’s monthly stars, goal (holiday/cancellation-adjusted), progress bar, **last story sentence**, quick actions (**Report**, **Award Stars**, **Adventure Log**, etc.), **today’s schedule**, and class-specific widgets.
- **Shortcuts:** Open **Team History**, **Day Planner**, **Report** (class), **Settings**. School-wide **holidays** are edited in the **School Office**, not Teacher Settings.

---

## 🗺️ Team Quest

- **League Map:** SVG path from **Bronze Meadows** → **Silver Peaks** → **Golden Citadel** → **Crystal Realm**. Each class is a moving avatar; position is based on **monthly stars** vs. **monthly goal**. Overlap resolution keeps labels readable.
- **Monthly goal:** Computed from schedule, **school holidays**, and **cancelled lessons** (fewer teaching days ⇒ lower goal). Display shows “goal adjusted by ±X stars” when relevant.
- **Ceremony of the Month:** At the start of a new school month (never August — schools are closed), Home **glows** until you run the dual ritual: league **class** ranks, then **Prodigy of the Month** for the selected class (Co-Prodigy allowed).

---

## 🏆 Hero's Challenge

- **Student Leaderboard:** Ranks by Monthly or Total Stars; views **By Class** / **Global Rank**. Avatars with **Hero Path aura** (level ≥ 3), Gold, Familiar (Elite), guild badge, **Reigning Prodigy**, Guild Champion marks. Click student → **Hero Stats** or the avatar → **Hero Stage** (stars, Gold, Familiar, satchel with usable relics, shortcuts to Trophy Room / Hero Stats / Skill Tree).
- **Mystic Market & Trophy Room:** Use **Mystic Market** (bottom nav) to browse and buy with Gold. **Trophy Room** shows a student's full **Inventory** (and access to the market); also openable from the Hero Stage (enlarged avatar) via **Treasure Vault**.
- **Hero stats:** one page everywhere (Hero Stage → **Hero stats**, or a hero in a Home schedule card's roster): identity, Hero Path and guild, stars and Gold, **virtues this month**, **latest stars**, Teacher Boon / Hero's Boon status, and for your own classes the **Scholar's Scroll** summary (trials, test average, best test, dictation summary, progress chart) with **Full analytics**. **Back to roster** shows the whole class.
- **Prodigy of the Month / Hall of Prodigies:** Archive of past **Prodigy** (and Co-Prodigy) for **completed** months; open from Hero's Challenge, Home, or related shortcuts. This is **not** Hall of Heroes.
- **Certificates:** **Generate Certificate** (from the roster) → AI writes a unique paragraph from top reason + monthly stars; PDF download with avatar and themed style (Junior/Mid/Senior).
- **Guild badges:** Rows can show a house emblem. The **guild vs guild** race lives on **Guild Hall** (the Crown Race), not as a toggle on this tab.

---

## 🏰 Guilds & Factions

*Opened from the bottom nav as **Guild Hall**.*

- **Four Guilds:** Every student can belong to one of four guilds, each with its own emblem and theme:
  - **Dragon Flame** – courage, boldness, fiery energy.
  - **Grizzly Might** – strength, teamwork, steady effort.
  - **Owl Wisdom** – curiosity, thoughtful learning, calm focus.
  - **Phoenix Rising** – resilience, bouncing back, never giving up.
- **Guild Sorting Quiz:** From **My Classes → Students (Manage Students)**, students without a guild can take an age-appropriate, story-style **Sorting Quiz**. It runs as a full-screen **Sorting Ceremony**: one tap per answer while a glowing orb drinks in each choice, then a projector-ready reveal where a spotlight circles the four houses before the crest, motto and traits of the new guild appear.
- **Year-Long Guild Progress:** Stars write **Guild Glory** (**2 Glory per star**). Each school month is a **Chapter**: guilds race on Glory per member (never raw Total Stars), and when the month ends it pays **Crowns** (5 / 3 / 2 / 1, plus **+1 Unity Seal** for a guild where at least 4 in 5 members earned 6 Glory). Crowns add up all year; June’s **Grand Guild Ceremony** crowns the guild with the most.
- **Fortune's Wheel:** Spin on the class’s **last lesson day of the week**, during lesson time, **once per week per class**. **Fortune Ledger** stores that school year’s outcomes. Magical Analytics expands each crystal column.
- **Guild Champions:** At the end of each month, the top earner in every guild is **Guild Champion**.

---

## 👥 My Classes & Roster

- **Classes:** Create/edit class from **Teacher Settings → My Classes** (name, logo, schedule days, Quest League). **Report**, **Overview**, **Edit** per class.
- **Manage Students:** Click **Students** on a class to open the roster. Per student: **Choose Hero Class** (Pro; shield, only if they have no class yet), **Skill Tree** (Pro; pulses when a new branch is waiting), **Hero's Chronicle** (notes + Elite Oracle), **Avatar Forge** (Elite), **Certificate**, **Move Student**, **Guild Quiz** (Pro, if no guild). **Edit** opens Profile, Special Dates, Hero Path, Quick Hub.
- **Class overview modal:** Tabs for class details, **Team History** (past performance/story), and shortcuts.

---

## ⭐ Award Stars

- **Reasons:** Teamwork, Creativity, Respect, Focus. Welcome Back greets a child who was away. Scholar's Bonus comes from **Starfall**; Story Weaver stars come from **Story Weavers**. On **Pro**, Hero Path adds +10 Gold when the reason matches, plus Skill Tree perks.
- **Effects:** Click award → particle burst + sound (e.g. Magic Chime). **Clarity** (Crystal of Clarity) shows a pulsing gem on the card.
- **Quest Bounties:** “Post a Bounty” → set **Target** (e.g. 20 stars), **Time limit**, **Reward** (e.g. 5 mins free time). Progress bar on **Award Stars** and **Projector Mode**; victory fanfare when target is hit. **Time Warp Hourglass** adds +5 minutes to active timers.
- **Hero's Boon / Teacher Boon:** See the economy section above. Heart button on eligible clouds; Teacher Boon in the last week of the month.

---

## 📜 Adventure Log

- **Crown Today's Hero:** Needs stars awarded today; one page per class per day. The crown comes first, then **Today's Page**: **Auto**, **Manual** or **Later** (a blank crowned page waits in the diary with *Write it myself*). **Pro:** you write the diary (Manual), with title ideas, story starters and today's words to tap in; your words are kept on this device until you save. **Elite:** AI gathers a dated class snapshot and writes a personal diary plus a storybook image; rewrites retain that lesson's evidence. **Edit** includes picture preview, upload, delete and (Elite) AI picture retry; picture changes apply when you save. The crowning picks **Hero of the Day** automatically (Mask of the Protagonist wins if pending; otherwise fair rotation among present students). You do not pick the name by hand.
- **Hall of Heroes:** Hero of the Day win tallies and legend tiers — **not** the Prodigy archive. Open it from the log.
- **Quest Assignment:** Schedule or view **Quest Assignments** (special tasks linked to the log).
- **Attendance:** Opens **Attendance Chronicle** (month × students matrix, mark present/absent, monthly %).
- **Quest Events:** From **Quest Calendar** → Day Planner → **Quest Event**.

---

## 📔 Scholar's Scroll

- **Tests & Dictations:** Log by class and date. **Tests:** score (e.g. 15/20) and optional note. **Dictations:** Junior = qualitative (e.g. Great!!!, Nice Try!); Senior = numeric score. **Starfall:** tests **≥ 95%** may propose **+1** Scholar’s Bonus; strong dictations (**> 85%**, with monthly caps) may propose **+0.5**. **Growth Starfall** may propose **+0.5** when a trial is 15+ points above the student’s own recent average (once a month). You confirm in a modal. **Starfall Catalyst** doubles that student’s next high-test bonus once.
- **Makeup Work:** Students with **no grade** for a given test date are flagged for makeup.
- **Performance Chart:** Per-class chart of student performance over recent trials.
- **Upcoming Test:** If a **Quest Event** has test data for a future date, the Scroll shows an alert (e.g. “Test on [date]”).

---

## ❓ Quiz of the Week (Elite)

**Quiz of the Week** is a weekly, class-by-class curriculum quiz that runs like a fun game show. When Quest Assignments have been filling the class book, Settings → Quiz offers **Generate from this week's lessons** (real units, grammar, and words since the last finished quiz). Otherwise the teacher selects grammar/vocabulary/mix plus topics. The app generates **multiple-choice** questions (count scales with class size, about three-quarters of the roster, between 5 and 15). The quiz appears automatically on the class’s **first lesson day of the week** (during lesson time). Students are picked at random to answer, and the class earns rewards based on first-try accuracy. Optionally, the teacher reviews and edits the questions before they go live, and brings back the questions the class missed last week.

- **Configure & generate**: Teacher Settings → **Quiz**
- **Play / view results**: Home dashboard (class selected) → **Quiz of the Week** button (only appears when eligible)

---

## 📅 Quest Calendar & Planner

- **Month grid:** Shows which days have lessons (from class schedules + **one-time overrides**). **School holidays** and **cancelled days** are themed (e.g. Winter Break, No School). Click a day → **Day Planner**.
- **Day Planner – Schedule:** List of classes scheduled that day; **Cancel** (for your classes) or **Add one-time lesson**. Cancellations and one-time lessons are **Schedule Overrides** and affect **monthly goal** and calendar styling.
- **Day Planner – Mark Holiday:** One-day “no school” for **all classes** (cancels that date and adjusts goals). Multi-day **holiday ranges** belong in the School Office.
- **Day Planner – Quest Event:** Add **2× Star Day**, **Reason Bonus Day**, or a **Special Quest** (Vocabulary Vault, Unbroken Chain, etc.) with completion bonus and goal.

**School holidays:** Add **holiday ranges** in the **School Office** (Secretary → Admin → School Details). They shade every teacher calendar and reduce **monthly Team Quest goals**. Teachers set only a class **final lesson day** under **My Planning**.

---

## 🖥️ Live Classroom: Projector Mode

*Activated via the **TV icon** in the header. Best in fullscreen (e.g. on a classroom display). Not available on the teacher phone. **Sky Theater** (header weather stage) is separate decoration, not this projector.*

- **Environment:** **Real-time sunrise/sunset** for your location; sky transitions from **Day** (sun, blue) to **Night** (moon, stars). **Seasonal atmosphere** (e.g. leaves, snow) can be applied.
- **Clock:** Large digital time + date; optional **analogue clock** with ticking hands.
- **The Director:** Rotates **floating cards** on a timer (avoids repeating the same card type back-to-back). Card types include:
  - **The Streak** – participation/attendance streaks
  - **Timekeeper** – countdown for active lesson
  - **League Race** – bar chart of classes in the league
  - **The Treasury** – this year's Gold
  - **Superpower** – most-awarded skill this month
  - **Story Update** – last sentence of the class story
  - **Weather** – current conditions
  - **Holiday** – next holiday countdown
  - **Pre-Holiday Hype** / **Post-Holiday Welcome** – seasonal messages
- **Wisdom Dock:** Footer with AI-generated **inspirational quotes** (refreshed periodically).
- **Celebration Cards:** On a student’s **birthday** or **nameday**, a high-priority animated card appears with a class wish.

---

## 🎯 Quest Bounties

- **Concept:** Short-term group challenge: reach **X stars** in **Y minutes** for a **reward** (e.g. 5 mins free time).
- **Config:** Target, time limit, reward text. **Time Warp Hourglass** adds +5 minutes to active timers.
- **Display:** Progress bar on **Award Stars** and in **Projector Mode**. **Win:** Fanfare and bounty marked completed.

---

## 🗓️ Special Quest Types (Rules & Mechanics)

*Scheduled via **Quest Calendar** → Day Planner → **Quest Event**. Events are class-scoped and active-year bound. Special Quests run through a resumable, transaction-backed runner; completion uses deterministic `special_quest` award logs and can be reversed atomically when Gold is recoverable. **2× Star Day** wins deterministic precedence over a same-day Reason Bonus.*

| Quest | Objective | Mechanics |
|-------|-----------|-----------|
| **Vocabulary Vault** | Use target words in context | Set target count (e.g. 15). Award a star when a student uses “Word of the Day.” Class hits target ⇒ class completion bonus. |
| **The Unbroken Chain** | Fluency & continuity | Speak 30–60 seconds without hesitation/repetition. Chain grows with each success. **+0.5 Bonus Stars** to each student who keeps the chain unbroken. |
| **Grammar Guardians** | Error correction | Find and fix errors on the board; pairs “rescue” sentences. Correct sentence = star; clear board = **Guardian Bonus**. |
| **The Scribe's Sketch** | Listening comprehension | Draw a scene as the teacher describes it. **Accuracy Stars** for matching details. |
| **Five-Sentence Saga** | Creative writing | Story in exactly 5 sentences using 3 random elements (e.g. Robot, Banana, Moon). Complete saga = **2 Stars + 2 Gold**. |

---

## 🎨 Story Weavers

| Tool | Description |
|------|-------------|
| **The Story Weavers** | **Elite.** Select class. Class builds a story **one sentence at a time**. **Word of the Day** (teacher or AI suggestion). **Lock in** → illustration. Every second addition can award **+0.5** Story Weaver stars to the class. Open-book view, league-matched **sentence starters** and **structure focus**, and **Reveal** with discussion questions (dialogic reading). Chronicle, archive, **Print** PDF. |

---

## 🎨 AI & Creative Tools

| Feature | Where | What it does |
|--------|--------|----------------|
| **Avatar Forge** | Edit Student (or onboarding) | **Elite.** Student picks base (e.g. Wizard, Robot), color, accessory. AI generates a **Chibi-style** avatar. |
| **AI Nameday Lookup** | Edit Student → Nameday | **Elite.** Magic wand sends name to AI (Greek Orthodox Εορτολόγιο); returns suggested nameday date. |
| **Class Report** | My Classes → Report | **Elite.** A Monday–Sunday week (step back up to three weeks): stars by day and virtue vs the week before, heroes who shone, heroes present but not yet recognised, attendance, trials, Heroes of the Day, plus the Oracle's reading, a **Mini-Quest** and a note for families. Copy as text or save as PDF. |
| **Certificate** | Roster | AI writes a unique praise paragraph from top reason + monthly stars; PDF with avatar and age-themed style. |
| **Hero's Chronicle – Oracle** | Student modal → Chronicle | **Elite.** Four report types: **Parent Summary**, **Teacher Strategy**, **Strengths/Weaknesses**, **Goal Suggestion**. |
| **Daily Log** | Adventure Log | **Elite:** AI diary + storybook image. **Pro:** teacher writes the diary. |
| **Story Weavers** | Story Weavers tab | **Elite.** Word suggestions + illustration per sentence. |

---

## 📊 Tracking & Analytics

### Hero's Chronicle
- **Private** log per student (from the roster). Teacher adds **categorized notes** (behavior, academics, social).
- **Oracle** inside Chronicle: **Parent Summary**, **Teacher Strategy**, **Strengths/Weaknesses**, **Goal Suggestion** (AI over full history).

### Scholar's Scroll (academic)
- **Tests** and **Dictations** with dates and scores. **Starfall** for high scores; **Makeup Work** for missing grades. **Performance Chart** and **Upcoming Test** alert.

### Attendance Chronicle
- **Matrix:** Month × students; presence/absence; monthly %. Delete a column as **No Lesson**, optionally **School Holiday**. Today’s present/absent/Welcome Back also live on Award Stars clouds.

### Certificates
- **Generate Certificate** → AI paragraph + PDF download (avatar, themed border/icon by age).

### Ceremony of the Month
- Home **glows** when last month’s ceremony is pending. **August never has a ceremony** (schools are closed), so September does not offer an August ritual. Pre-Junior classes automatically use the inclusive **Growth Festival** (garden, Bloom Parade, Golden Bloom); every other league uses **Classic Arena**. Results are frozen in versioned snapshots; Growth’s public DOM never contains ranks or scores.

---

## ⚙️ Teacher Settings

Opened from the header **cog**. Pick a section from the **dropdown** at the top.

| Subtab | Features |
|--------|----------|
| **Student Tools** | Star Manager (historical award or direct override), Coin Purse, Familiar sprite forge (Elite). |
| **My Classes** | Create/edit classes and **Manage Students**. |
| **My Planning** | Per-class **final lesson day** (Pro). Holidays = School Office. |
| **Profile** | Display name and this browser's Quest cursor preference. |
| **Class Grading** | Pick a class, then Tests or Dictations; school picture is read-only (Pro). |
| **Family Access** | Parent username/password per student (Pro). |
| **Quiz** | Build Quiz of the Week; play on Home (Elite). |
| **Market** | Repair Seasonal Treasures and Festival Stall: new picture, replace, copies, text (Elite). |

---

## 🛠️ Tech Stack & Getting Started

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS (ES modules), HTML, CSS (Tailwind-style utilities, custom themes) |
| **Backend / DB** | **Firebase** (Firestore: classes, students, scores, award_log, bounties, schedule overrides, holidays, story data, etc.) |
| **AI** | **DeepSeek V4.1 Flash** (diary, reports, certificates, nameday, Story Weaver text), with automatic **Gemini 3.1 Flash Lite via OpenRouter** backup and a final Cloudflare text fallback; Cloudflare Workers AI (image generation). API keys stay in Worker secrets. |

**Run locally:** From the project root, run `npx serve -l 3000` (or any static server). Configure Firebase in your project for full functionality.

---

<div align="center">

**Ready to begin? The bell is ringing! 🔔**

</div>
