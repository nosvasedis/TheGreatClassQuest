<div align="center">

# ⭐ The Great Class Quest 🚀

### The Ultimate Gamified Classroom Management System

![Shield](https://img.shields.io/badge/Designed%20For-Teachers%20%26%20Students-blueviolet) ![Shield](https://img.shields.io/badge/Platform-Web%20Browser-blue) ![Shield](https://img.shields.io/badge/Focus-Positive%20Reinforcement-brightgreen) ![Shield](https://img.shields.io/badge/Status-Live-success) ![Shield](https://img.shields.io/badge/Economy-Gold%20%26%20Artifacts-orange) ![Shield](https://img.shields.io/badge/AI-Gemini%20Powered-4285F4) ![Shield](https://img.shields.io/badge/Data-Firebase%20Firestore-FFCA28)

> **"Turn every lesson into a quest, every challenge into a milestone, and every student into a hero."**

</div>

---

## 📖 Table of Contents

| Section | Description |
|--------|--------------|
| [Project Overview](#-project-overview) | What the app is and who it's for |
| [The Quest Master's Philosophy](#-the-quest-masters-philosophy) | Four pedagogical pillars |
| [Navigation at a Glance](#-navigation-at-a-glance) | All main tabs and what they do |
| [Core Gameplay Loop](#-core-gameplay-loop) | Setup → Award → Log |
| [The Economy System](#-the-economy-system-gold--shop) | Gold, Mystic Market, Legendary Artifacts, Hero Classes (Pro+), Boons, Familiars |
| [Home Dashboard](#-home-dashboard) | Weather, schedule, tools, class/school view |
| [Team Quest](#-team-quest) | League map, monthly goals, ceremony |
| [Hero's Challenge](#-heros-challenge) | Leaderboard, shop, Hero Stats, Prodigy, certificates |
| [Guilds & Factions](#-guilds--factions) | Guild houses, sorting quiz, year-long race |
| [My Classes & Roster](#-my-classes--roster) | Classes, students, reports, certificates |
| [Award Stars](#-award-stars) | Reasons, effects, bounties, Hero's Boon |
| [Adventure Log](#-adventure-log) | AI diary, story image, Quest Events |
| [Scholar's Scroll](#-scholars-scroll) | Tests, dictations, Starfall, makeup, performance chart |
| [Calendar & Planner](#-calendar--planner) | Schedule, cancellations, holidays, Quest Events |
| [Live Classroom: Wallpaper Mode](#-live-classroom-wallpaper-mode) | The Director, cards, clock, celebrations |
| [Quest Bounties](#-quest-bounties) | Short-term group challenges |
| [Special Quest Types](#-special-quest-types) | Vocabulary Vault, Unbroken Chain, and more |
| [Story Weavers](#-story-weavers) | Collaborative story writing with AI illustrations |
| [AI & Creative Tools](#-ai--creative-tools) | Avatar Forge, Nameday lookup, reports, Story Weavers |
| [Tracking & Analytics](#-tracking--analytics) | Hero's Chronicle, Attendance, certificates |
| [Options & Settings](#-options--settings) | Star Manager, Coin Purse, holidays, profile, danger zone |

---

## 🌍 Project Overview

**The Great Class Quest** is a sophisticated web application that gamifies the classroom experience. It replaces traditional behavior charts with a living, breathing RPG-style interface.

- **Triple-layer competition:** Class vs. class on the **Team Quest** map, student vs. student in **Hero's Challenge** for rank and "Prodigy of the Month," and **guild vs. guild** in a year-long race toward the **Guild Ceremony**.
- **Automated tracking:** Stars, gold, inventory, tests, attendance, and logs are stored in **Firestore** and stay in sync.
- **AI-powered narrative:** **Gemini** writes daily chronicles, certificates, and story illustrations.
- **Live display:** **Dynamic Wallpaper Mode** turns your screen into a real-time quest dashboard with day/night, weather-aware sky, rotating cards, and celebrations.

---

## 📜 The Quest Master's Philosophy

The app is built on four pedagogical pillars:

| Pillar | Description |
|--------|-------------|
| **Dual-Layer Motivation** | **Team Quest:** The class advances together on a map (social cohesion). **Hero's Challenge:** Students compete for rank and Prodigy status (personal accountability). |
| **Tangible "Gold" Economy** | Stars become purchasing power. The **Mystic Market** (seasonal + **Legendary Artifacts**) and **Hero's Boon** (peer-to-peer gift) teach delayed gratification and generosity. |
| **Visual Feedback Loops** | Progress is never abstract: progress bars, floating stats, growing avatars, **League Map** zones (Bronze → Silver → Gold → Crystal), and **Wallpaper Mode** keep the quest visible. |
| **AI as the "Dungeon Master"** | AI narrates daily logs, suggests words for Story Weavers, generates avatars and certificates, and powers **Hero's Chronicle** reports. |

---

## 🧭 Navigation at a Glance

| Tab | Purpose |
|-----|---------|
| **Home** | Dashboard: weather, time greeting, school/class stats, today’s schedule, quick actions (Team History, Holiday, Planner, Report, etc.). |
| **Team Quest** | Class leaderboard, **League Map** (journey from Bronze Meadows to Crystal Realm), monthly goal (adjusted for holidays/cancellations), **Monthly Award Ceremony**. |
| **Hero's Challenge** | Student leaderboard with **Individual / Guild** toggle; **Shop** (Mystic Market) and **Trophy Room** (view a student’s full collection + inventory); Hero Stats modal, **Prodigy of the Month** archive, certificates. Click an avatar → enlarged avatar (Familiar, Inventory, link to Trophy Room). |
| **Guilds** | **Guild Hall**: crystal columns for all four guilds (Total Stars, member count, top contributors). **This Month's Champion** per guild. Tap emblem for lore; play guild **anthem** (karaoke-style). |
| **My Classes** | Create/edit classes (name, logo, schedule, Quest League). Click **Students** → **Manage Students** (roster with per-student **Skill Tree**, **Hero's Chronicle**, **Avatar Forge**, **Certificate**, **Move Student**, **Guild Quiz** if no guild). **Report** (AI class summary). |
| **Award** | Award stars (Teamwork, Creativity, Respect, Focus, etc.), **Quest Bounties**, **Hero's Boon**. Sounds and particle effects. |
| **Adventure Log** | **Log Today's Adventure** (AI diary + storybook image), view past entries. Buttons: **Quest Assignment**, **Attendance** (Attendance Chronicle), **Hall of Heroes** (Prodigy archive). **Quest Events** are scheduled from Calendar → Day Planner. |
| **Scholar's Scroll** | **Tests** and **Dictations**, **Starfall** on high scores, **Makeup Work** flags, **Performance Chart**, upcoming test alert. |
| **Calendar** | Month view, **Day Planner** (see/cancel/add lessons, mark holiday, add **Quest Events**). Holiday/cancellation themes. |
| **Story Weavers** | Collaborative story + Word of the Day + AI art. |
| **Options** | **Star Manager**, **Coin Purse Manager**, **School Year Planner** (holidays), Profile (display name), **Danger Zone** (purge/erase). |

---

## 🧭 Core Gameplay Loop

### 1. Setup & Roster (**My Classes**)
- **Class:** Name, logo, schedule (days/times), **Quest League** (difficulty/age).
- **Roster:** Add students; each has Total Stars, Monthly Stars, Gold, Inventory, **Hero Class**, avatar, birthday, nameday.
- **Personalization:** Edit student → Birthday, **Nameday** (with **AI Nameday Lookup** for Greek Orthodox Εορτολόγιο), **Hero Class** (Pro+, optional lock).

### 2. The Daily Session (**Award**)
- Choose student + reason (Teamwork, Creativity, Respect, Focus, Welcome Back, Scholar's Bonus, Story Weaver, etc.).
- **Visual feedback:** Particle effects + unique sound (e.g. Magic Chime).
- Data (timestamp, reason, value) is written to Firestore; on **Pro+**, **Hero Class** can grant **+10 Gold** for matching reason and additional bonuses from that hero’s **Skill Tree** (e.g. extra Gold, bonus stars, guild-wide perks).

### 3. The End-of-Day Ritual (**Log**)
- **"Log Today's Adventure"** sends the day’s events to the AI.
- AI writes a whimsical diary entry; an AI image generator creates a **storybook-style** illustration.
- Entry is stored and can be revisited; **Pathfinder's Map** and **Mask of the Protagonist** can be reflected in the narrative.

---

## 💰 The Economy System: Gold & Shop

### 🪙 Gold Coins
- **Earning:** 1 Star = 1 Gold. **Bonus Gold:** e.g. "2x Days," **Hero Class** match (+10, Pro+), **Hero Skill Tree** perks (extra Gold or bonus stars when the student plays to their class’s strength, Pro+), **Scroll of the Gilded Star** (3× next star).
- **Spending** Gold does **not** lower Leaderboard rank (Total Stars are separate).

### 🎪 The Mystic Market (Hero's Challenge → Shop)
- **Seasonal stock:** AI generates ~15 items per month by season and league (e.g. Ice Sword in winter; Junior = toys/stickers, Senior = RPG-style artifacts).
- **Legendary Artifacts:** Always available; fixed list of **power-ups** (see below). Different purchase limits (e.g. 2 Legendary per student per month; Pathfinder’s Map 1 per class per month).
- **Purchase:** Up to **2 items per month** per student (seasonal); Legendary limits apply per type. Items appear in the student’s **Inventory** and in the **Enlarged Avatar** pop-up.

### ⚔️ Legendary Artifacts (Power-Ups)

| Artifact | Price | Effect |
|----------|-------|--------|
| **Crystal of Clarity** | 15 | Pulsing “hint pass” gem on the student’s card. |
| **Scroll of the Gilded Star** | 20 | Next star earned = **3× Gold**. |
| **Time Warp Hourglass** | 25 | **+5 minutes** to all active class bounty timers. |
| **Elixir of Luck** | 30 | 20% chance for **+1 star** on next lesson. |
| **The Herald's Banner** | 40 | School-wide victory celebration toast. |
| **The Starfall Catalyst** | 50 | **Double** the stars from the next high test (Starfall). |
| **The Pathfinder’s Map** | 60 | **+10 Stars** for the Team Quest (class limit: 1/month). |
| **The Mask of the Protagonist** | 75 | Student is the **hero** of the next story log. |

*Use from Inventory in the Hero Stats / enlarged avatar flow; consuming applies the effect and removes the item.*

### 🛡️ Hero Classes & Skill Trees (Pro+)
Students on **Pro+** can choose a **Hero Class** (e.g. Guardian, Sage, Paladin, Artificer, Scholar, Weaver, Nomad).

- **Class Reasons:** Each class is tied to a reason (e.g. Guardian → Respect, Sage → Creativity, Scholar → Scholar's Bonus, Nomad → Welcome Back).
- **Leveling (5 tiers):** As students earn stars in their class’s reason across the school year, they climb **five hero levels** (e.g. Guardian: Sentinel → Warden → Protector → Champion → Eternal Guardian). Thresholds are tuned so a typical student (2 lessons/week, ~2–3 stars/lesson) can realistically reach high levels over a **full September–June year**, not in a single month.
- **Branching Skill Tree:** At each level, the student chooses **one of two** permanent skills (e.g. “extra Gold when *you* earn Respect” vs. “small Gold bonus to guildmates when *they* earn Respect”). Skills can:
  - Grant **extra Gold** to the hero on matching reasons.
  - Add **bonus stars** (Total + Monthly) when they excel in their class’s reason.
  - Share Gold with **classmates** or **guildmates** on matching reasons.
  - Trigger a **once-per-month guild boost** the first time they play to their class’s strength that month.
- **Visual Aura:** From higher levels onward, the student’s avatar gains a **class-colored aura ring** on the leaderboard to signal hero status.

Hero Classes are optional but, once locked, cannot be changed (to preserve long-term identity and investment).

### 🐾 Familiars (Animated Pets)
Students can spend Gold on **Familiar Eggs** in the **Mystic Market**. Each student can own **one Familiar** at a time:

- **Egg Purchase:** 4–5 distinct egg lines (e.g. Emberfang – fire dragon, Frostpaw – arctic fox spirit, Thornback – forest toad/treant, Veilshade – shadow sprite, Sparkling – light fairy/phoenix). Each egg has a unique theme, colors, and animation style.
- **Hatching:** After the student earns about **20 stars** after purchase, the egg **hatches** into a tiny chibi Familiar. The sprite is generated by AI as a **4-frame sprite sheet**, animated on-screen using CSS `steps()` to look like a fully moving game character.
- **Evolution:** As the student continues to earn stars after hatch, the Familiar **evolves twice more** (Level 2 and Level 3) at calibrated milestones (roughly mid-year and near year-end for a September start). Each evolution triggers a new AI-generated sprite sheet and unique animation.
- **Display:** Familiars sit **next to the avatar** on the student leaderboard and appear as a large animated companion in the **enlarged avatar overlay**. Tapping/clicking the Familiar opens a **Familiar Stats** panel (name, current form, “stars together,” and progress to next evolution).
- **Sounds & Feel:** Hatching and evolution trigger dedicated **sound cues** and celebratory toasts, turning long-term consistency into a visible, emotionally resonant payoff.

### 🎁 Hero's Boon
From the **Award** tab, a student can **Bestow a Boon** on another (cost: **15 Gold**). The receiver gets **+0.5 Stars** (Total + Monthly); the giver gets peer recognition. Builds generosity and community.

---

## 🏠 Home Dashboard

The **Home** tab is your command center and adapts to **weather** and **time of day**.

- **Header:** AI-generated **inspirational quote** (cached daily); background shifts with **weather** (sunny, cloudy, rainy, snowy, stormy) and **day/night** (sunrise/sunset from your location).
- **Time-based greeting:** Good Morning / Afternoon / Evening / Night with matching gradient.
- **View modes:**
  - **No class selected:** School-wide stats (School Stars, Heroes count, Treasury), **Global Tools** (Hero Ranks, New Class, **Team History**, **Holiday**, **Plan**, Setup), and **School Schedule** for today.
  - **Class selected:** That class’s monthly stars, goal (holiday/cancellation-adjusted), progress bar, **last story sentence**, quick actions (**Report**, Award, Log, etc.), **today’s schedule**, and class-specific widgets.
- **Shortcuts:** Open **Team History**, **Day Planner**, **Holiday** (Options), **Report** (class), **Settings** (Options).

---

## 🗺️ Team Quest

- **League Map:** SVG path from **Bronze Meadows** → **Silver Peaks** → **Golden Citadel** → **Crystal Realm**. Each class is a moving avatar; position is based on **monthly stars** vs. **monthly goal**. Overlap resolution keeps labels readable.
- **Monthly goal:** Computed from schedule, **school holidays**, and **cancelled lessons** (fewer teaching days ⇒ lower goal). Display shows “goal adjusted by ±X stars” when relevant.
- **Monthly Award Ceremony:** At the start of a new month, **Team Quest** and **Hero's Challenge** tabs **glow** until the ceremony is run. Full-screen animated ceremony with music/sound reveals last month’s **class** and **student** winners with AI-generated commentary.

---

## 🏆 Hero's Challenge

- **Student Leaderboard:** Ranks by Total Stars (and/or Monthly); avatars with **Hero Class aura ring**, Gold, and (optionally) their animated **Familiar** companion. Click student → **Hero Stats** modal or **enlarged avatar** (avatar + Familiar + **Inventory**, link to **Trophy Room**).
- **Shop & Trophy Room:** **Shop** opens the **Mystic Market**. **Trophy Room** shows a student's full **Inventory** (and access to shop); also openable from the enlarged avatar via "See full collection →".
- **Hero Stats Modal:** Avatar, name, Hero Class, **Trials Logged**, **Average Test Score**, **Best Test**, dictation summary (Junior: qualitative; Senior: average %). **Performance chart** (test/dictation over time). Links to **Hero's Chronicle** and **Certificate**.
- **Prodigy of the Month / Hall of Heroes:** Archive of past **Prodigy** (and Co-Prodigy) with month selector; open from Hero's Challenge, Home, or **Adventure Log** tab (**Hall of Heroes** button).
- **Certificates:** **Generate Certificate** (from roster or Hero Stats) → AI writes a unique paragraph from top reason + monthly stars; PDF download with avatar and themed style (Junior/Mid/Senior).
- **Guild View:** Switch the leaderboard to **Guild** mode to see the four guilds ranked by **Total Stars** (cumulative for the whole school year), along with member counts and top contributors.

---

## 🏰 Guilds & Factions

- **Four Guilds:** Every student can belong to one of four guilds, each with its own emblem and theme:
  - **Dragon Flame** – courage, boldness, fiery energy.
  - **Grizzly Might** – strength, teamwork, steady effort.
  - **Owl Wisdom** – curiosity, thoughtful learning, calm focus.
  - **Phoenix Rising** – resilience, bouncing back, never giving up.
- **Guild Sorting Quiz:** From **My Classes → Students (Manage Students)**, students without a guild can take an age-appropriate, story-style **Sorting Quiz**. Their choices are mapped to traits and used to assign a guild in a fun, narrative way.
- **Year-Long Guild Progress:** Every positive star a student earns also feeds their guild’s **Total Stars**. Guild totals **do not reset monthly**; they accumulate across the school year and are the basis for the end-of-year **Guild Ceremony** (e.g. June 2026) to crown the winning guild.
- **Guild Leaderboard:** In **Hero’s Challenge**, switch to **Guild** view to see a compact leaderboard of all guilds with:
  - Total Stars (cumulative, not reset).
  - Member count and a quick list of top contributors.
  - Colors/emblems matching the guild’s identity for quick recognition on the projector.
- **Guild Champions:** At the end of each month, the top earner in every guild is crowned **Guild Champion**. Champions are highlighted on the student leaderboard with a special badge and showcased on the **Guild Hall** crystal columns for that month.

---

## 👥 My Classes & Roster

- **Classes:** Create/edit class (name, logo, schedule days, Quest League). **Report**, **Overview**, **Edit** per class.
- **Manage Students:** Click **Students** on a class to open the roster. Per student: **Skill Tree** (Pro+, hero level and branch choices; button pulses when a new choice is available), **Hero's Chronicle** (notes + Oracle), **Avatar Forge**, **Certificate**, **Move Student** (to another class), **Guild Quiz** (if no guild). **Edit** opens student modal (name, birthday, **Nameday**, **Hero Class** on Pro+, avatar, notes). **Nameday:** magic wand → **AI Nameday Lookup** (Greek Orthodox calendar) to auto-fill date.
- **Class overview modal:** Tabs for class details, **Team History** (past performance/story), and shortcuts.

---

## ⭐ Award Stars

- **Reasons:** Teamwork, Creativity, Respect, Focus, Welcome Back, Scholar's Bonus, Story Weaver, Correction, etc. On **Pro+**, **Hero Class** adds +10 Gold when reason matches, and may add extra Gold or bonus stars if the student has unlocked matching **Skill Tree** perks.
- **Effects:** Click award → particle burst + sound (e.g. Magic Chime). **Clarity** (Crystal of Clarity) shows a pulsing gem on the card.
- **Quest Bounties:** “Post a Bounty” → set **Target** (e.g. 20 stars), **Time limit**, **Reward** (e.g. 5 mins free time). Progress bar on Award screen and **Wallpaper Mode**; victory fanfare when target is hit. **Time Warp Hourglass** adds +5 minutes to active timers.
- **Hero's Boon:** Button to bestow Boon on another student (cost 15 Gold; receiver +0.5 Stars).

---

## 📜 Adventure Log

- **Log Today's Adventure:** Sends the day’s awards (and optional context like tests, bounties, **Pathfinder**, **Protagonist**) to the AI. AI returns a short story + a **storybook-style image**. Saved as the day’s entry.
- **Past entries:** Browse by class and month; each shows text + image.
- **Quest Assignment:** Schedule or view **Quest Assignments** (special tasks linked to the log).
- **Attendance:** Opens **Attendance Chronicle** (month × students matrix, mark present/absent, monthly %).
- **Hall of Heroes:** Opens the **Prodigy of the Month** archive (past class heroes by month).
- **Quest Events:** From **Calendar** → Day Planner → **Quest Event** tab: schedule a **Special Quest** (Vocabulary Vault, Unbroken Chain, Grammar Guardians, Scribe’s Sketch, Five-Sentence Saga) with date, type, and parameters (e.g. completion bonus, goal target). Events show on calendar and can influence goals/logs.

---

## 📔 Scholar's Scroll

- **Tests & Dictations:** Log by class and date. **Tests:** score (e.g. 15/20) and optional note. **Dictations:** Junior = qualitative (e.g. Great!!!, Nice Try!); Senior = numeric score. **Starfall:** e.g. 100% on a test triggers optional **Bonus Stars** to the leaderboard; **Starfall Catalyst** doubles that bonus once.
- **Makeup Work:** Students with **no grade** for a given test date are flagged for makeup.
- **Performance Chart:** Per-class chart of student performance over recent trials.
- **Upcoming Test:** If a **Quest Event** has test data for a future date, the Scroll shows an alert (e.g. “Test on [date]”).

---

## 📅 Calendar & Planner

- **Month grid:** Shows which days have lessons (from class schedules + **one-time overrides**). **School holidays** and **cancelled days** are themed (e.g. Winter Break, No School). Click a day → **Day Planner**.
- **Day Planner – Schedule:** List of classes scheduled that day; **Cancel** (for your classes) or **Add one-time lesson**. Cancellations and one-time lessons are **Schedule Overrides** and affect **monthly goal** and calendar styling.
- **Day Planner – Mark Holiday:** Mark a single day as **School Holiday** (no lessons school-wide).
- **Day Planner – Quest Event:** Add a **Special Quest** (Vocabulary Vault, Unbroken Chain, etc.) for that date with completion bonus and goal.

**School Year Planner (Options):** Add **holiday ranges** (name, start, end, theme: Christmas/Winter, Easter/Spring, Generic). These shade the calendar and reduce **monthly goal** for all classes.

---

## 🖥️ Live Classroom: Wallpaper Mode

*Activated via the **TV icon** in the header. Best in fullscreen (e.g. on a big display).*

- **Environment:** **Real-time sunrise/sunset** for your location; sky transitions from **Day** (sun, blue) to **Night** (moon, stars). **Seasonal atmosphere** (e.g. leaves, snow) can be applied.
- **Clock:** Large digital time + date; optional **analogue clock** with ticking hands.
- **The Director:** Rotates **floating cards** every ~15 seconds (no same card type twice in a row). Card types include:
  - **The Streak** – participation/attendance streaks
  - **Timekeeper** – countdown for active lesson
  - **League Race** – bar chart of classes in the league
  - **The Treasury** – total Gold
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
- **Display:** Progress bar on **Award** screen and in **Wallpaper Mode**. **Win:** Fanfare and bounty marked completed.

---

## 🗓️ Special Quest Types (Rules & Mechanics)

*Scheduled via **Calendar** → Day Planner → **Quest Event**.*

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
| **The Story Weavers** | Select class. Class builds a story **one sentence at a time**. **Word of the Day** (teacher or AI suggestion). **Lock in** sentence → AI generates a new **illustration**. **Reveal Story to Class**, **Current Story**, **Story Archive**, **Start New**. Stories can be exported/printed as a PDF storybook. |

---

## 🎨 AI & Creative Tools

| Feature | Where | What it does |
|--------|--------|----------------|
| **Avatar Forge** | Edit Student (or onboarding) | Student picks base (e.g. Wizard, Robot), color, accessory. AI generates a **Chibi-style** avatar; URL saved to profile and used on leaderboards. |
| **AI Nameday Lookup** | Edit Student → Nameday | Magic wand sends name to AI (Greek Orthodox Εορτολόγιο); returns suggested nameday date and auto-fills. |
| **Class Report** | My Classes → Report | AI **Weekly Summary** + **Suggested Mini-Quest** from behavior + academic data. |
| **Certificate** | Roster / Hero Stats | AI writes a unique praise paragraph from top reason + monthly stars; PDF with avatar and age-themed style. |
| **Hero's Chronicle – Oracle** | Student modal → Chronicle | Four report types: **Parent Summary**, **Teacher Strategy**, **Strengths/Weaknesses**, **Goal Suggestion**, from full history. |
| **Daily Log** | Adventure Log | AI diary entry + storybook image from the day’s events. |
| **Story Weavers** | Story Weavers tab | Word suggestions + illustration per sentence. |

---

## 📊 Tracking & Analytics

### Hero's Chronicle
- **Private** log per student (from roster or Hero Stats). Teacher adds **categorized notes** (behavior, academics, social).
- **Oracle** inside Chronicle: **Parent Summary**, **Teacher Strategy**, **Strengths/Weaknesses**, **Goal Suggestion** (AI over full history).

### Scholar's Scroll (academic)
- **Tests** and **Dictations** with dates and scores. **Starfall** for high scores; **Makeup Work** for missing grades. **Performance Chart** and **Upcoming Test** alert.

### Attendance Chronicle
- **Matrix:** Month × students; presence/absence. **Monthly attendance %**. Attendance can block awarding stars (e.g. must mark present first). Option to **delete column** and mark as **School Holiday**.

### Certificates
- **Generate Certificate** → AI paragraph + PDF download (avatar, themed border/icon by age).

### Monthly Ceremony
- **Team Quest** and **Hero's Challenge** tabs **pulse** when last month’s ceremony is pending. Run ceremony → full-screen reveal (classes + students) with AI commentary.

---

## ⚙️ Options & Settings

| Block | Features |
|-------|----------|
| **Student Star Manager** | Select student. **Add Historical Award** (date, stars, reason) → appends to award log. **Direct Score Override** (Today/Monthly/Total) → no log entry. **Purge Student Score Data** (Danger Zone). |
| **Coin Purse Manager** | Select student, set **Current Gold**, **Update Balance**. |
| **School Year Planner** | **Holiday ranges** (name, start, end, theme). List with **Delete**. Affects calendar and **monthly goal** for all classes. |
| **Profile Settings** | **Display name** (e.g. “Quest Master”) and save. |
| **Danger Zone** | **Purge Student Score Data**, **Erase Today's Stars**, **Purge All My Award Logs**. |

---

## 🛠️ Tech Stack & Getting Started

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS (ES modules), HTML, CSS (Tailwind-style utilities, custom themes) |
| **Backend / DB** | **Firebase** (Firestore: classes, students, scores, award_log, bounties, schedule overrides, holidays, story data, etc.) |
| **AI** | **Gemini** (diary, reports, certificates, nameday, Story Weaver text and image) |

**Run locally:** From the project root, run `npx serve -l 3000` (or any static server). Configure Firebase in your project for full functionality.

---

<div align="center">

**Ready to begin? The bell is ringing! 🔔**

</div>
