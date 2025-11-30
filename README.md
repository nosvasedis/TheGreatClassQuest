<div align="center">

# ⭐ The Great Class Quest 🚀

### The Ultimate Gamified Classroom Management System

![Shield](https://img.shields.io/badge/Designed%20For-Teachers%20&%20Students-blueviolet)
![Shield](https://img.shields.io/badge/Platform-Web%20Browser-blue)
![Shield](https://img.shields.io/badge/Focus-Positive%20Reinforcement-brightgreen)
![Shield](https://img.shields.io/badge/Status-Live-success)
![Shield](https://img.shields.io/badge/Economy-Gold%20&%20Artifacts-orange)

> **"Turn every lesson into a quest, every challenge into a milestone, and every student into a hero."**

</div>

---

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [The Quest Master's Philosophy](#-the-quest-masters-philosophy)
- [Core Gameplay Loop](#-core-gameplay-loop)
- [The Economy System](#-the-economy-system-gold--shop)
- [Live Classroom Tools](#-live-classroom-tools)
    - [Dynamic Wallpaper Mode](#-dynamic-wallpaper-mode)
    - [Quest Bounties](#-quest-bounties)
- [Advanced Quest Modules](#-advanced-quest-modules)
    - [Special Quest Types (Rules & Mechanics)](#-special-quest-types-rules--mechanics)
- [AI & Creative Tools](#-ai--creative-tools)
- [Tracking & Analytics](#-tracking--analytics)

---

## 🌍 Project Overview

**The Great Class Quest** is a sophisticated web application that gamifies the classroom experience. It replaces traditional behavior charts with a living, breathing RPG (Role-Playing Game) interface.

It automates tracking, uses AI to generate narratives and rewards, and provides a dual-layer competition system (Team vs. Team and Hero vs. Hero) to maximize student engagement.

---

## 📜 The Quest Master's Philosophy

The application is built on four pedagogical pillars:

1.  **Dual-Layer Motivation:**
    * **The Team Quest:** The class works as a collective unit to advance on a map. This builds **social cohesion** and peer support.
    * **The Hero's Challenge:** Students also compete individually for rank and "Prodigy of the Month" status. This drives **personal accountability**.

2.  **Tangible "Gold" Economy:**
    * Behavior points (Stars) translate directly into purchasing power (Gold).
    * This introduces financial literacy and delayed gratification mechanics via the **Mystic Market**.

3.  **Visual Feedback Loops:**
    * Progress is never abstract. It is visualized through animated progress bars, floating stats, and growing avatars.
    * **"The Director"** (Wallpaper Mode) keeps these stats visible even during downtime.

4.  **AI as the "Dungeon Master":**
    * Generative AI (Gemini) acts as the narrator, writing daily chronicles, generating unique reward ideas, and analyzing student performance trends for the teacher.

---

## 🧭 Core Gameplay Loop

### 1. Setup & Roster (`My Classes` Tab)
* **Class Creation:** Define the class name, logo, schedule (days/times), and "Quest League" (Difficulty Level).
* **Roster Management:** Add students. Each student gets a database entry tracking their Total Stars, Monthly Stars, Gold, and Inventory.

### 2. The Daily Session (`Award` Tab)
* **Awarding Stars:** Teachers select a student and a reason (Teamwork, Creativity, Respect, Focus).
* **Visual Feedback:** Clicking an award triggers particle effects and plays a unique sound (e.g., "Magic Chime").
* **Data Entry:** The app records the timestamp, reason, and value to Firestore.

### 3. The End-of-Day Ritual (`Log` Tab)
* **"Log Today's Adventure":** This button triggers an AI process.
* **Contextual Analysis:** The system sends all the day's events (Who won stars? For what? Any tests?) to the AI.
* **Narrative Generation:** The AI writes a whimsical diary entry (e.g., "The class battled the Grammar Goblins...").
* **Image Generation:** An AI image generator creates a unique "Storybook Style" illustration for the entry.

---

## 💰 The Economy System: Gold & Shop

This system runs parallel to the Star (Grade) system.

### 🪙 Gold Coins
* **Earning:** 1 Star = 1 Gold.
* **Bonus Gold:** Special events (like "2x Days") award double Gold.
* **Separation:** Spending Gold does **not** lower a student's Leaderboard Rank (Total Stars).

### 🎪 The Mystic Market (`Hero's Challenge` -> Shop)
A fully functional digital shop where students can spend their Gold.
* **Dynamic Stock:** The shop uses AI to generate 15 unique items every month based on:
    * **Season:** (e.g., "Ice Sword" in Winter, "Flower Wand" in Spring).
    * **League Level:** Junior classes get "Toys/Stickers"; Senior classes get "RPG Artifacts".
* **Purchase Mechanics:**
    * **Limit:** Hard-coded limit of **2 items per month** per student to encourage saving.
    * **Inventory:** Purchased items appear permanently in the student's "Enlarged Avatar" view.

---

## ⚡ Live Classroom Tools

### 🖥️ Dynamic Wallpaper Mode
*Activated via the TV Icon in the header.*

This transforms the screen into a **"Living Dashboard"** screensaver.
* **Real-Time Environment:** It checks the actual sunrise/sunset times for your location. The sky transitions from Day (Sun/Blue Sky) to Night (Moon/Stars) automatically.
* **"The Director" Engine:** An intelligent algorithm cycles through floating cards every 15 seconds. It ensures variety by never showing the same card type twice in a row.
    * **Card Types:**
        * **🔥 The Streak:** Shows class attendance/participation streaks.
        * **⏳ Timekeeper:** A countdown timer if a lesson is currently active.
        * **🏆 League Race:** A comparative bar chart of all classes in the current League.
        * **💎 The Treasury:** Total Gold collected by the class/school.
        * **⚡ Superpower:** The most-awarded skill (e.g., "Creativity") of the month.
        * **📜 Story Update:** The last sentence added to the class story.
* **Wisdom Dock:** A fixed footer displaying AI-generated inspirational quotes that update every 5 minutes.

### 🎯 Quest Bounties
*Activated via the "Post a Bounty" button on the Award Tab.*

* **Concept:** A short-term, high-intensity group challenge.
* **Configuration:** Teacher sets a **Target** (e.g., 20 Stars), a **Time Limit** (e.g., 20 mins), and a **Reward** (e.g., "5 mins free time").
* **Display:** A progress bar appears on the Award Screen and Wallpaper Mode.
* **Win State:** Hitting the target triggers a victory fanfare and marks the bounty as "Completed."

---

## ⚔️ Advanced Quest Modules

### 🗓️ Special Quest Types (Rules & Mechanics)
*Scheduled via the Calendar Tab.*

These are structured game modes with specific rulesets enforced or suggested by the app.

| Quest Name | Objective | Mechanics & Rules |
| :--- | :--- | :--- |
| **💎 Vocabulary Vault** | Use target words in context. | **Goal:** Set a target number (e.g., 15 uses). <br> **Action:** Every time a student correctly uses a "Word of the Day" in speech, award a star. <br> **Win:** If the class hits the target count, the *entire class* gets a completion bonus. |
| **🔗 The Unbroken Chain** | Fluency & Continuity. | **Goal:** Speak for 30-60 seconds on a topic without hesitation or repetition. <br> **Action:** If a student succeeds, the "Chain" grows. <br> **Win:** Award +0.5 Bonus Stars to every student who keeps the chain unbroken. |
| **🛡️ Grammar Guardians** | Error Correction. | **Goal:** Find and fix errors in sentences written on the board. <br> **Action:** Students work in pairs to "rescue" the sentences. <br> **Win:** Correcting a sentence earns a star. Clearing the board earns a class-wide "Guardian Bonus." |
| **✏️ The Scribe's Sketch** | Listening Comprehension. | **Goal:** Draw a scene exactly as described by the teacher. <br> **Action:** Teacher describes a scene piece-by-piece. Students draw. <br> **Win:** Students whose drawings accurately reflect the details earn "Accuracy Stars." |
| **📖 Five-Sentence Saga** | Creative Writing. | **Goal:** Write a coherent story using 3 random elements (e.g., Robot, Banana, Moon). <br> **Action:** Must be exactly 5 sentences long. <br> **Win:** Completed sagas earn 2 Stars + 2 Gold. |

---

## 🎨 AI & Creative Tools

### ✒️ Story Weavers
A collaborative storytelling engine.
* **Mechanic:** The class builds a story one sentence at a time.
* **AI Integration:**
    * **Suggestion:** AI suggests a "Word of the Day" to include.
    * **Illustration:** Upon locking in a sentence, the AI generates a new image visualizing the story's progress.
* **Output:** Stories are archived and can be printed as a PDF Storybook.

### 🧑‍🚀 The Avatar Forge
* **Customization:** Students choose a base (e.g., Wizard, Robot), a color, and an accessory.
* **Generation:** The AI generates a unique "Chibi-style" sticker avatar.
* **Storage:** The avatar URL is saved to their profile and appears on all leaderboards.

### 🔮 The Oracle's Insight
* **Data Analysis:** The teacher can ask natural language questions (e.g., "Who is improving the most?").
* **Processing:** The AI scans the last 30 days of Award Logs, Academic Scores, and Attendance.
* **Output:** It returns a strategic summary, highlighting patterns humans might miss.

---

## 📊 Tracking & Analytics

### 📜 The Scholar's Scroll
* **Academic Tracking:** A dedicated grade book for **Tests** and **Dictations**.
* **Starfall System:** High scores (e.g., 100% on a test) trigger a "Starfall," allowing the teacher to instantly award Bonus Stars to the leaderboard.
* **Makeup Work:** Automatically detects if a student has no grade for a specific test date and flags them for "Makeup Work."

### 📅 Attendance Chronicle
* **Matrix View:** A monthly grid showing presence/absence for every student.
* **Smart Calculation:** Calculates monthly attendance percentages.
* **Logic:** Attendance state interacts with the Star system (e.g., you cannot award stars to an absent student unless you mark them present).

### 📜 Certificates
* **Generation:** Creates a PDF certificate for a specific student.
* **Personalization:** The AI writes a unique paragraph of praise based on the student's top "Reason" (e.g., Teamwork) and their total star count for the month.

<br>

<div align="center">
  <strong>Ready to begin? The bell is ringing! 🔔</strong>
</div>
