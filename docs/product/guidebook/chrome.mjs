/** Classroom buttons, shelves, and wallpaper pieces as they appear to teachers. */

import { decorateStarCounts, starIco } from './stars.mjs';

export const ARTIFACTS = [
  { icon: '💎', name: 'Crystal of Clarity', gold: 15, perk: 'Hint-pass glow on the student’s card' },
  { icon: '✨', name: 'Scroll of the Gilded Star', gold: 20, perk: 'Next star pays 3× Gold' },
  { icon: '⏳', name: 'Time Warp Hourglass', gold: 25, perk: '+5 minutes on active bounty timers' },
  { icon: '🍀', name: 'Elixir of Luck', gold: 30, perk: '50% chance of +1 star next lesson' },
  { icon: '💰', name: 'Aurum Satchel', gold: 32, perk: '50% off the next Market buy this month' },
  { icon: '⚜️', name: 'Banner of Glory', gold: 35, perk: 'Next 3 stars each write +1 Guild Glory' },
  { icon: '📢', name: "The Herald's Banner", gold: 40, perk: 'School-wide victory celebration' },
  { icon: '🛡️', name: 'Bulwark Crest', gold: 48, perk: 'Guild Glory Shield for 7 days' },
  { icon: '📜', name: 'The Starfall Catalyst', gold: 50, perk: 'Double the next high-test Starfall' },
  { icon: '🏆', name: 'Chalice of Radiance', gold: 55, perk: 'Guild +1 Glory on qualifying stars for 24h' },
  { icon: '💝', name: 'Compassion Token', gold: 55, perk: "Hero's Boon costs 0 Gold this month" },
  { icon: '🗺️', name: "Pathfinder's Map", gold: 60, perk: '+10 Team Quest stars for the class (1/month)' },
  { icon: '✒️', name: "Archivist's Quill", gold: 62, perk: 'Next Story Weaver bonus is 1 star, not 0.5' },
  { icon: '🎭', name: 'Mask of the Protagonist', gold: 75, perk: 'Guarantees Hero of the Day on the next log' },
  { icon: '👑', name: 'Crown of the Eternal', gold: 90, perk: '2× star-earned Glory until midnight' }
];

export const FAMILIARS = [
  { name: 'Thornback', gold: 30, color: '#16a34a', forms: 'Moss Toad → Bark Bear → Ancient Treant', vibe: 'Strong · Loyal · Grounded' },
  { name: 'Frostpaw', gold: 35, color: '#3b82f6', forms: 'Ice Cub → Snow Fox → Frost Guardian', vibe: 'Serene · Wise · Graceful' },
  { name: 'Emberfang', gold: 40, color: '#ef4444', forms: 'Hatchling → Flame Drake → Inferno Dragon', vibe: 'Daring · Fierce · Unstoppable' },
  { name: 'Veilshade', gold: 45, color: '#7c3aed', forms: 'Shadow Wisp → Phantom Cat → Void Stalker', vibe: 'Mysterious · Swift · Ethereal' },
  { name: 'Sparkling', gold: 50, color: '#f59e0b', forms: 'Sun Sprite → Dawn Fairy → Solar Phoenix', vibe: 'Radiant · Joyful · Inspiring' }
];

export const HERO_CLASSES = [
  { name: 'Guardian', icon: '🛡️', virtue: 'Respect', color: '#16a34a' },
  { name: 'Sage', icon: '🔮', virtue: 'Creativity', color: '#9333ea' },
  { name: 'Paladin', icon: '⚔️', virtue: 'Teamwork', color: '#2563eb' },
  { name: 'Artificer', icon: '⚙️', virtue: 'Focus', color: '#d97706' },
  { name: 'Weaver', icon: '✒️', virtue: 'Story Weaver', color: '#0d9488' },
  { name: 'Scholar', icon: '📜', virtue: "Scholar's Bonus", color: '#0891b2' },
  { name: 'Nomad', icon: '👟', virtue: 'Welcome Back', color: '#7c3aed' }
];

export function headerToolsHtml() {
  return `<div class="hdr-bar">
    <div class="hdr-class">
      <span class="hdr-logo">🏫</span>
      <div>
        <strong>Follow today’s schedule</strong>
        <em>Junior B · in session</em>
      </div>
    </div>
    <div class="hdr-tools" aria-label="Header buttons">
      <button type="button" class="hdr-btn" data-term="adventurers-guide" title="Adventurer's Guide"><i class="fas fa-info"></i></button>
      <button type="button" class="hdr-btn hdr-btn--tv" data-term="projector" title="Projector Mode"><i class="fas fa-tv"></i></button>
      <button type="button" class="hdr-btn" data-term="school-office" title="School Office"><i class="fas fa-building-shield"></i></button>
      <button type="button" class="hdr-btn" title="Teacher Settings"><i class="fas fa-cog"></i></button>
      <button type="button" class="hdr-btn hdr-btn--out" title="Log out"><i class="fas fa-sign-out-alt"></i></button>
    </div>
  </div>`;
}

export function classPickerHtml() {
  return `<div class="class-picker-demo">
    <article class="class-opt is-on"><span>📅</span><div><strong>Follow today’s schedule</strong><em>Auto-switch to the class in session</em></div></article>
    <article class="class-opt"><span>🏫</span><div><strong>General view</strong><em>The whole school</em></div></article>
  </div>`;
}

export function projectorStageHtml() {
  return `<div class="proj-wrap">
    <p class="live-demo__label"><i class="fas fa-tv" aria-hidden="true"></i> Projector Mode · classroom wallpaper</p>
    <div class="proj-stage">
      <span class="proj-sun" aria-hidden="true"></span>
      <i class="fas fa-cloud proj-cloud proj-cloud--a" aria-hidden="true"></i>
      <i class="fas fa-cloud proj-cloud proj-cloud--b" aria-hidden="true"></i>
      <button type="button" class="proj-exit" title="Leave Projector Mode" data-term="projector"><i class="fas fa-power-off"></i></button>
      <div class="wall-timer-pill wall-timer-pill--warning">
        <span>⏳</span><span>Star sprint</span><span class="wall-timer-pill__sep"></span><span>04:12</span>
      </div>
      <div class="proj-hub">
        <p class="proj-time">10:42</p>
        <p class="proj-date">Monday, 12 January</p>
        <div class="proj-analogue" aria-hidden="true">
          <span class="proj-hand proj-hand--h"></span>
          <span class="proj-hand proj-hand--m"></span>
          <span class="proj-dot"></span>
        </div>
        <div class="proj-class">Junior B <span>Quest League</span></div>
      </div>
      <div class="proj-cards">
        <article class="proj-card proj-card--red"><span>Timekeeper</span><strong>18</strong><em>mins until the adventure ends</em></article>
        <article class="proj-card proj-card--blue"><span>Quest progress</span><strong>62%</strong><em>Golden Citadel</em></article>
        <article class="proj-card proj-card--green"><span>Heroes assembled</span><strong>92%</strong><em>present today</em></article>
      </div>
      <p class="proj-wisdom">✨ A hero is someone who is brave when it is hard. ✨</p>
    </div>
    <ul class="proj-legend">
      <li><strong>Sky</strong> — day, night, weather, and season for your school</li>
      <li><strong>Clocks</strong> — huge digital time, date, and ticking analogue hands</li>
      <li><strong>Remaining time</strong> — lesson Timekeeper, next lesson, bounty countdown (when they are real)</li>
      <li><strong>The Director</strong> — story cards that change about once a minute</li>
      <li>Leave with <strong>Esc</strong> or the <strong>power</strong> button. Classroom PC only — not on the phone.</li>
    </ul>
  </div>`;
}

export function artifactsShelfHtml() {
  return `<div class="shelf">
    <p class="live-demo__label"><i class="fas fa-gem" aria-hidden="true"></i> Legendary Artifacts · how perks look</p>
    <ul class="artifact-grid">${ARTIFACTS.map(
      (a) => `<li>
        <span class="artifact-ico">${a.icon}</span>
        <strong>${a.name}</strong>
        <em><i class="fas fa-coins" aria-hidden="true"></i> ${a.gold}</em>
        <small>${decorateStarCounts(a.perk)}</small>
      </li>`
    ).join('')}</ul>
    <p class="shelf-note">Two legendary buys per student per month. Used from the Trophy Room / enlarged avatar.</p>
  </div>`;
}

export function familiarsShelfHtml() {
  return `<div class="shelf">
    <p class="live-demo__label"><i class="fas fa-egg" aria-hidden="true"></i> Familiar eggs · Elite</p>
    <ul class="egg-grid">${FAMILIARS.map(
      (f) => `<li style="--egg:${f.color}">
        <span class="egg">🥚</span>
        <strong>${f.name}</strong>
        <em><i class="fas fa-coins" aria-hidden="true"></i> ${f.gold} · ${f.vibe}</em>
        <small>${f.forms}</small>
      </li>`
    ).join('')}</ul>
    <p class="shelf-note">One companion per student. Hatches after 20 ${starIco()} since purchase; evolves at 60 and 140 ${starIco()} since hatch.</p>
  </div>`;
}

export function heroClassesHtml() {
  return `<div class="shelf">
    <p class="live-demo__label"><i class="fas fa-hat-wizard" aria-hidden="true"></i> Hero Classes · matching virtue</p>
    <div class="hero-class-row">${HERO_CLASSES.map(
      (c) => `<article class="hero-class-chip" style="--hc:${c.color}"><span>${c.icon}</span><strong>${c.name}</strong><em>${c.virtue}</em></article>`
    ).join('')}</div>
  </div>`;
}

export function skillTreeDemoHtml() {
  return `<div class="skill-demo">
    <div class="skill-demo__head">
      <span class="skill-pulse" title="Skill Tree — a new branch is waiting"><i class="fas fa-sitemap"></i></span>
      <div>
        <p class="live-demo__label"><i class="fas fa-sitemap" aria-hidden="true"></i> Skill Tree</p>
        <p class="skill-demo__title">🛡️ Guardian · Sentinel</p>
        <p class="skill-demo__meta">Lvl 1 · 28 Respect · 17 to next level</p>
        <div class="skill-bar"><i style="width:40%"></i></div>
      </div>
    </div>
    <div class="skill-branches">
      <article class="skill-branch">
        <span class="skill-kicker">Branch A</span>
        <h4>Iron Resolve</h4>
        <p>+3 <span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> Gold</span> when you earn Respect</p>
      </article>
      <article class="skill-branch skill-branch--alt">
        <span class="skill-kicker">Branch B</span>
        <h4>Bulwark</h4>
        <p>+2 <span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> Gold</span> to each classmate who also earns Respect today</p>
      </article>
    </div>
    <p class="shelf-note">The purple sitemap on Manage Students pulses until they pick one permanent branch. Bonus ${starIco()} move ranks; bonus <span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> Gold</span> does not.</p>
  </div>`;
}

export function rosterToolsHtml() {
  return `<div class="roster-demo">
    <p class="live-demo__label"><i class="fas fa-users" aria-hidden="true"></i> Manage Students</p>
    <div class="roster-row">
      <div class="roster-who">
        <span class="roster-av">A</span>
        <div>
          <strong>Alex</strong>
          <span class="hero-title-pill">🛡️ Sentinel</span>
        </div>
      </div>
      <div class="roster-btns">
        <button type="button" class="roster-ico ico-guild" title="Guild Sorting Quiz"><i class="fas fa-hat-wizard"></i></button>
        <button type="button" class="roster-ico ico-tree is-pulse" data-term="skill-tree" title="Skill Tree — new skill waiting"><i class="fas fa-sitemap"></i></button>
        <button type="button" class="roster-ico ico-book" data-term="heros-chronicle" title="Hero's Chronicle"><i class="fas fa-book-reader"></i></button>
        <button type="button" class="roster-ico ico-parent" data-term="family-portal" title="Parent Access"><i class="fas fa-user-shield"></i></button>
        <button type="button" class="roster-ico ico-forge" title="Avatar Forge"><i class="fas fa-user-astronaut"></i></button>
        <button type="button" class="roster-ico ico-cert" title="Certificate"><i class="fas fa-award"></i></button>
        <button type="button" class="roster-pill ico-move"><i class="fas fa-people-arrows"></i> Move</button>
        <button type="button" class="roster-pill ico-edit"><i class="fas fa-pencil-alt"></i> Edit</button>
        <button type="button" class="roster-ico ico-del" title="Delete"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
    <ul class="roster-legend">
      <li><i class="fas fa-hat-wizard"></i> Guild quiz</li>
      <li><i class="fas fa-sitemap"></i> Skill Tree (pulses when a branch waits)</li>
      <li><i class="fas fa-book-reader"></i> Hero's Chronicle</li>
      <li><i class="fas fa-user-shield"></i> Parent Access</li>
      <li><i class="fas fa-user-astronaut"></i> Avatar Forge</li>
      <li><i class="fas fa-award"></i> Certificate</li>
      <li><i class="fas fa-people-arrows"></i> Move · Edit · Delete</li>
    </ul>
  </div>`;
}

export function chronicleDemoHtml() {
  return `<div class="chronicle-demo">
    <div class="chronicle-hub">
      <span class="chronicle-hub__icon"><i class="fas fa-book-reader"></i></span>
      <span class="chronicle-hub__copy">
        <strong>Hero's Chronicle</strong>
        <em>Adventure notes &amp; Oracle AI</em>
      </span>
      <i class="fas fa-chevron-right chronicle-hub__go" aria-hidden="true"></i>
    </div>
    <div class="chronicle-notebook">
      <div class="chronicle-tabs" aria-hidden="true">
        <span class="is-on"><i class="fas fa-book-open"></i> Notes</span>
        <span><i class="fas fa-wand-magic-sparkles"></i> The Oracle</span>
      </div>
      <p class="chronicle-kicker">Focus category</p>
      <div class="chronicle-cats">
        <span>📓 General</span><span>🎓 Academic</span><span>🎭 Behavior</span><span>💬 Social</span><span>🎯 Goals</span>
      </div>
      <p class="shelf-note">Private notebook. Families never see a page unless you Publish to Portal. Oracle (Elite): Parent Summary, Teacher Strategy, Traits &amp; Trends, Hero’s Goal.</p>
    </div>
  </div>`;
}

export function bountyChipHtml() {
  return `<div class="live-row">
    <span class="quest-chip qc-bounty" data-term="bounties"><i class="fas fa-bullseye"></i> Bounty · 12 ${starIco()} · 5:00</span>
    <span class="quest-chip qc-quiz" data-term="quiz-of-the-week"><i class="fas fa-question"></i> Quiz of the Week</span>
    <span class="quest-chip qc-birth">🎂 Nameday today</span>
    <span class="quest-chip qc-cer" data-term="ceremony-of-the-month"><i class="fas fa-trophy"></i> Ceremony waiting</span>
  </div>`;
}

export function calendarChipsHtml() {
  return `<div class="live-row">
    <span class="quest-chip qc-star">⭐ 2× Star Day</span>
    <span class="quest-chip qc-reason">💡 Reason Bonus Day</span>
    <span class="quest-chip qc-vault">🗝️ Vocabulary Vault</span>
    <span class="quest-chip qc-chain">🔗 Unbroken Chain</span>
    <span class="quest-chip qc-guardians">🛡️ Grammar Guardians</span>
    <span class="quest-chip qc-sketch">✏️ Scribe’s Sketch</span>
    <span class="quest-chip qc-saga">📖 Five-Sentence Saga</span>
  </div>`;
}

export function homeDashHtml() {
  return `<div class="panel home-dash">
    <h3><i class="fas fa-home" aria-hidden="true"></i> On Home today</h3>
    ${bountyChipHtml()}
    <div class="home-stats">
      <article><span>🌤️</span><strong>18°</strong><em>Sunny</em></article>
      <article><span>🗺️</span><strong>62%</strong><em>Team Quest</em></article>
      <article><span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> 1,240</span><em>Treasury</em></article>
    </div>
  </div>`;
}

export function challengeRankHtml() {
  return `<div class="rank-demo">
    <p class="live-demo__label"><i class="fas fa-user-graduate" aria-hidden="true"></i> Hero's Challenge · this month</p>
    <ol>
      <li><span class="rank-n">1</span><span class="rank-av">M</span><strong>Maria</strong><em>👑 Prodigy pace</em><b>48 ${starIco()}</b></li>
      <li><span class="rank-n">2</span><span class="rank-av">N</span><strong>Nikos</strong><em>⚔️ Paladin aura</em><b>44 ${starIco()}</b></li>
      <li><span class="rank-n">3</span><span class="rank-av">E</span><strong>Eleni</strong><em>🛡️ Guardian</em><b>41 ${starIco()}</b></li>
    </ol>
    <div class="live-row" style="margin-top:.7rem">
      <span class="quest-chip qc-trophy"><i class="fas fa-box-open"></i> Trophy Room</span>
      <span class="quest-chip qc-cer" data-term="hall-of-prodigies"><i class="fas fa-landmark"></i> Hall of Prodigies</span>
      <span class="quest-chip qc-cert"><i class="fas fa-award"></i> Certificates</span>
    </div>
  </div>`;
}

export function adventureLogHtml() {
  return `<div class="al-guide">
    <p class="live-demo__label"><i class="fas fa-book-open" aria-hidden="true"></i> Adventure Log · end of the lesson</p>
    <div class="live-row">
      <button type="button" class="al-fab al-fab--assign" data-term="quest-assignment" title="Quest Assignment">
        <i class="fas fa-clipboard-list"></i> Quest Assignment
      </button>
      <button type="button" class="al-fab al-fab--attend" data-term="attendance-chronicle" title="Attendance">
        <i class="fas fa-user-check"></i> Attendance
      </button>
    </div>
    <div class="al-primary-row">
      <button type="button" class="log-today-btn" data-term="hero-of-the-day" title="Log Today's Adventure">
        <i class="fas fa-feather-alt"></i> Log Today's Adventure
      </button>
      <button type="button" class="al-heroes-btn" data-term="hall-of-heroes" title="Hall of Heroes">
        <i class="fas fa-crown"></i> Hall of Heroes
      </button>
    </div>
    <aside class="hcd-auto">
      <strong>Automatic crown</strong>
      <p>You do not pick Hero of the Day by hand. Saving the log crowns a present student, then the class sees the celebration. Mask of the Protagonist wins if it is pending; otherwise a fair rotation.</p>
    </aside>
    <div class="hcd-mini hcd-mini--wide">
      <span>👑</span>
      <div>
        <strong>Hero of the Day</strong>
        <p>Crowned when you Log Today’s Adventure. Archived in the Hall of Heroes.</p>
      </div>
    </div>
    ${hallOfHeroesHtml()}
  </div>`;
}

export function hallOfHeroesHtml() {
  return `<div class="hoh-guide">
    <p class="live-demo__label"><i class="fas fa-crown" aria-hidden="true"></i> Hall of Heroes · daily crowns, not Prodigies</p>
    <div class="hoh-stats">
      <article class="hoh-stat hoh-stat--crowns"><em>Total Crowns</em><strong>18</strong></article>
      <article class="hoh-stat hoh-stat--heroes"><em>Crowned Heroes</em><strong>9</strong></article>
      <article class="hoh-stat hoh-stat--legend"><em>Top Legend</em><strong>Alex</strong></article>
    </div>
    <div class="hoh-row">
      <span class="hoh-medal">🥇</span>
      <span class="hoh-avatar">A</span>
      <div><strong>Alex</strong><em>Rising Legend · 3 wins</em></div>
      <b>3</b>
    </div>
  </div>`;
}

export function scrollDemoHtml() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-scroll" aria-hidden="true"></i> Scholar's Scroll · Starfall</p>
    <p class="starfall-burst">${starIco()} High trial → Scholar’s Bonus ${starIco()}</p>
    <div class="live-row" style="margin-top:.6rem">
      <span class="quest-chip qc-test">📝 Test today · luck on the wallpaper</span>
    </div>
  </div>`;
}

export function storyWeaversHtml() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-feather-alt" aria-hidden="true"></i> Word of the Day</p>
    <p class="wotd">🪶 <strong>luminous</strong> · Lock in → illustration</p>
  </div>`;
}

export function officeHtml() {
  return `<div class="office-mini office-mini--chapter">
    <p class="office-mini__kicker">Secretary</p>
    <h3><i class="fas fa-building-shield" aria-hidden="true"></i> School Office</h3>
    <div class="office-mini__tabs">
      <span>Home</span><span>School</span><span>Grades</span><span>Messages</span><span class="is-on">Admin</span>
    </div>
    <ul class="office-mini__jobs">
      <li><i class="fas fa-calendar-alt" aria-hidden="true"></i> <strong>School Year</strong> — open, seat returning students in the placement wizard, finish the year</li>
      <li><i class="fas fa-school" aria-hidden="true"></i> <strong>School Details</strong> — name, weather city, holiday ranges that shrink Team Quest goals</li>
      <li><i class="fas fa-sliders-h" aria-hidden="true"></i> <strong>Grading</strong> — school-wide test and dictation defaults</li>
    </ul>
    <p class="shelf-note">Teachers still teach. The office keeps the school year honest. Elite.</p>
  </div>`;
}

export function familyPortalHtml() {
  return `<div class="panel">
    <h3><i class="fas fa-house-user" aria-hidden="true"></i> Family Portal</h3>
    <div class="family-card">
      <span>👨‍👩‍👧</span>
      <div>
        <strong><i class="fas fa-house-user" aria-hidden="true"></i> One login per child</strong>
        <p>Progress, homework, attendance snapshot, calm messages. They do not see your private Chronicle unless you publish.</p>
      </div>
    </div>
  </div>`;
}

export function glossaryRacesHtml() {
  return `<div class="races-row">
    <article class="race-card race-map"><i class="fas fa-route" aria-hidden="true"></i><h4>Team Quest</h4><p>Month · class vs class · map</p></article>
    <article class="race-card race-hero"><i class="fas fa-user-graduate" aria-hidden="true"></i><h4>Hero's Challenge</h4><p>Month · student vs student · Prodigy</p></article>
    <article class="race-card race-guild"><i class="fas fa-shield-alt" aria-hidden="true"></i><h4>Guild Hall</h4><p>Year · house vs house · June ceremony</p></article>
  </div>`;
}

export function welcomeBackHtml() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-hand-sparkles" aria-hidden="true"></i> Absence &amp; Welcome Back</p>
    <div class="live-row">
      <button type="button" class="absence-btn absence-btn--absent" data-term="welcome-back" title="Mark as Absent"><i class="fas fa-user-slash"></i></button>
      <button type="button" class="welcome-back-btn" data-term="welcome-back" title="Welcome Back"><i class="fas fa-hand-sparkles"></i></button>
    </div>
  </div>`;
}

export function starAwardBtnsHtml() {
  return `<div class="star-award-demo">
    <p class="live-demo__label"><i class="fas fa-star" aria-hidden="true"></i> Award Stars · tap 1, 2, or 3</p>
    <div class="star-selector-container visible">
      <button type="button" class="star-award-btn star-btn-1" data-term="award-stars" aria-label="Award 1 star">
        <span class="star-btn__shine" aria-hidden="true"></span>
        <span class="star-btn__badge">1</span>
        <i class="fas fa-star"></i>
      </button>
      <span class="star-divider" aria-hidden="true"></span>
      <button type="button" class="star-award-btn star-btn-2" data-term="award-stars" aria-label="Award 2 stars">
        <span class="star-btn__shine" aria-hidden="true"></span>
        <span class="star-btn__badge">2</span>
        <i class="fas fa-star"></i><i class="fas fa-star"></i>
      </button>
      <span class="star-divider" aria-hidden="true"></span>
      <button type="button" class="star-award-btn star-btn-3" data-term="award-stars" aria-label="Award 3 stars">
        <span class="star-btn__shine" aria-hidden="true"></span>
        <span class="star-btn__badge">3</span>
        <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
      </button>
    </div>
  </div>`;
}

export function mapStageHtml() {
  return `<figure class="map-stage">
    <div class="map-stage__art">
      <img src="media/league-map.png" alt="Team Quest league map" />
      <div class="map-zone-label map-zone-label--bronze" style="left:10%;top:75%">
        <span class="map-zone-label__icon" aria-hidden="true">🌿</span>
        <span class="map-zone-label__copy"><span class="map-zone-label__text">Bronze Meadows</span><span class="map-zone-label__pct">0%</span></span>
      </div>
      <div class="map-zone-label map-zone-label--silver" style="left:32%;top:15%">
        <span class="map-zone-label__icon" aria-hidden="true">🏔️</span>
        <span class="map-zone-label__copy"><span class="map-zone-label__text">Silver Peaks</span><span class="map-zone-label__pct">30%</span></span>
      </div>
      <div class="map-zone-label map-zone-label--gold" style="left:70%;top:65%">
        <span class="map-zone-label__icon" aria-hidden="true">🏰</span>
        <span class="map-zone-label__copy"><span class="map-zone-label__text">Golden Citadel</span><span class="map-zone-label__pct">60%</span></span>
      </div>
      <div class="map-zone-label map-zone-label--crystal" style="left:88%;top:8%">
        <span class="map-zone-label__icon" aria-hidden="true">💎</span>
        <span class="map-zone-label__copy"><span class="map-zone-label__text">Crystal Realm</span><span class="map-zone-label__pct">85%</span></span>
      </div>
    </div>
    <figcaption>The League Map. Zone names sit on the land, as they do in the classroom.</figcaption>
  </figure>`;
}

export function housesHtml() {
  const houses = [
    { file: 'dragonflame.webp', name: 'Dragon Flame', motto: 'Fear nothing. Burn bright.', traits: 'Courage · Fire · Bold', klass: 'h-dragon' },
    { file: 'grizzlymight.webp', name: 'Grizzly Might', motto: 'Stand together. Stand strong.', traits: 'Strength · Teamwork · Steadfast', klass: 'h-grizzly' },
    { file: 'owlwisdom.webp', name: 'Owl Wisdom', motto: 'Knowledge is power.', traits: 'Wisdom · Curiosity · Calm', klass: 'h-owl' },
    { file: 'phoenixrising.webp', name: 'Phoenix Rising', motto: 'Fall down seven, rise up eight.', traits: 'Resilience · Renewal · Hope', klass: 'h-phoenix' }
  ];
  return `<div class="houses">${houses.map(
    (h) => `<article class="house ${h.klass}"><img src="media/${h.file}" alt="${h.name} emblem" /><h4>${h.name}</h4><p class="house-motto">${h.motto}</p><p class="house-traits">${h.traits}</p></article>`
  ).join('')}</div>`;
}

export function namesDistinctHtml() {
  return `<div class="names-grid">
    <article class="name-card name-card--day"><i class="fas fa-crown"></i><h4>Hero of the Day</h4><p>Automatic when you log the lesson. Archived in the Hall of Heroes.</p></article>
    <article class="name-card name-card--month"><i class="fas fa-trophy"></i><h4>Prodigy of the Month</h4><p>Ceremony of the Month. Archived in the Hall of Prodigies.</p></article>
    <article class="name-card name-card--june"><i class="fas fa-shield-alt"></i><h4>Grand Guild Ceremony</h4><p>June. Houses. The Guild Hall crowning — not the monthly ritual.</p></article>
    <article class="name-card name-card--peer"><i class="fas fa-heart"></i><h4>Hero's Boon</h4><p>A classmate spends <span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> Gold</span> for +0.5 <span class="star-amt" aria-hidden="true"><i class="fas fa-star"></i></span>. Not Teacher Boon.</p></article>
    <article class="name-card name-card--wand"><i class="fas fa-wand-magic-sparkles"></i><h4>Teacher Boon</h4><p>Your 2 <span class="star-amt" aria-hidden="true"><i class="fas fa-star"></i></span><span class="star-amt" aria-hidden="true"><i class="fas fa-star"></i></span> gift, last week of the month, once per class.</p></article>
    <article class="name-card name-card--champ"><i class="fas fa-medal"></i><h4>Guild Champion</h4><p>Top earner inside one house this month. Not Prodigy.</p></article>
  </div>`;
}

export function mobileDockHtml() {
  return `<div class="panel">
    <h3><i class="fas fa-mobile-alt" aria-hidden="true"></i> On a phone</h3>
    <p class="shelf-note" style="margin-top:0">Five gems. More holds the rest. Projector Mode is classroom-PC only.</p>
    <nav class="dock dock--five" aria-label="Phone dock">
      <a class="nav-color-cyan is-active" href="#home"><i class="fas fa-home"></i>Home</a>
      <a class="nav-color-amber" href="#team-quest"><i class="fas fa-route"></i>Team Quest</a>
      <a class="nav-color-purple" href="#heros-challenge"><i class="fas fa-user-graduate"></i>Hero's Challenge</a>
      <a class="nav-color-rose" href="#award-stars"><i class="fas fa-star"></i>Award Stars</a>
      <a class="nav-color-slate" href="#settings"><i class="fas fa-ellipsis-h"></i>More</a>
    </nav>
  </div>`;
}

export function ethosHtml() {
  return `
    <div class="ethos-banner">
      <img class="ethos-banner__logo" src="media/logo.svg" alt="" />
      <p class="ethos-banner__line">You are still the English teacher. The Quest gives the hour a world the children can see.</p>
    </div>
    <div class="ethos-pillars">
      <article class="ethos-card ethos-card--master"><i class="fas fa-hat-wizard"></i><h4>Quest Master</h4><p>You decide every <span class="star-amt"><i class="fas fa-star" aria-hidden="true"></i> star</span>. AI may help write; it does not award.</p></article>
      <article class="ethos-card ethos-card--see"><i class="fas fa-eye"></i><h4>Visible world</h4><p>Virtue has a name, effort has a trail, the year has peaks — not a hidden spreadsheet.</p></article>
      <article class="ethos-card ethos-card--gold"><i class="fas fa-coins"></i><h4>Gold economy</h4><p><span class="star-amt"><i class="fas fa-star" aria-hidden="true"></i> Stars</span> stay. <span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> Gold</span> spends. Delayed gratification is real because rank is not for sale.</p></article>
      <article class="ethos-card ethos-card--peak"><i class="fas fa-mountain-sun"></i><h4>Time has peaks</h4><p>Daily hero, monthly prodigy, June houses — three different crowns.</p></article>
    </div>
    <div class="ethos-skills">
      <article><h4><i class="fas fa-users" aria-hidden="true"></i> Teamwork</h4><p>Pair, listen, help.</p></article>
      <article><h4><i class="fas fa-lightbulb" aria-hidden="true"></i> Creativity</h4><p>Surprise in a sentence.</p></article>
      <article><h4><i class="fas fa-hands-helping" aria-hidden="true"></i> Respect</h4><p>Kindness in the room.</p></article>
      <article><h4><i class="fas fa-brain" aria-hidden="true"></i> Focus</h4><p>Stay with the hard task.</p></article>
    </div>
    <p class="ethos-next">The screens, buttons, and map live in the chapters that follow. Next: <a href="#the-quest">Orientation</a>.</p>`;
}

export function fortuneWheelHtml() {
  return `<div class="wheel-demo">
    <p class="live-demo__label"><i class="fas fa-dharmachakra" aria-hidden="true"></i> Fortune's Wheel · last lesson of the week</p>
    <div class="wheel-face" aria-hidden="true">
      <span class="wheel-seg wheel-seg--glory">Glory</span>
      <span class="wheel-seg wheel-seg--perk">Perk</span>
      <span class="wheel-seg wheel-seg--fun">Fun</span>
      <span class="wheel-seg wheel-seg--curse">Caution</span>
      <span class="wheel-hub">🎡</span>
    </div>
    <p class="shelf-note">Spin once per class per week, inside lesson time. Junior leagues soften harsh outcomes. Read the Fortune Ledger afterward.</p>
  </div>`;
}
