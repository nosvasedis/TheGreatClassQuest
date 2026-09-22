/** Exact classroom markup for guidebook UI capture (same classes as the live app). */

export function ceremonyIntroSplashHtml() {
  return `
        <div class="ceremony-intro-splash">
            <div class="ceremony-intro-splash__aurora" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--a" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--b" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__ring" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__emblem-wrap">
                <span class="ceremony-intro-splash__emblem">📚</span>
            </div>
            <p class="ceremony-intro-splash__kicker">Ceremony of the Month</p>
            <h1 class="ceremony-intro-splash__title font-title">August 2026</h1>
            <p class="ceremony-intro-splash__brand">The Great Class Quest</p>
            <div class="ceremony-intro-splash__details">
                <span class="ceremony-intro-chip ceremony-intro-chip--amber"><i class="fas fa-route"></i>League Junior B</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--violet"><i class="fas fa-school"></i>Junior B</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--blend"><i class="fas fa-wand-magic-sparkles"></i>Team Quest → Hero's Challenge</span>
            </div>
            <p class="ceremony-intro-splash__tagline">League champions rise first — then your class heroes claim the spotlight.</p>
        </div>`;
}

export function ceremonyGrowthIntroSplashHtml() {
  return `
        <div class="ceremony-intro-splash">
            <div class="ceremony-intro-splash__aurora" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--a" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--b" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__ring" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__emblem-wrap">
                <span class="ceremony-intro-splash__emblem">🐣</span>
            </div>
            <p class="ceremony-intro-splash__kicker">Ceremony of the Month</p>
            <h1 class="ceremony-intro-splash__title font-title">August 2026</h1>
            <p class="ceremony-intro-splash__brand">The Great Class Quest</p>
            <div class="ceremony-intro-splash__details">
                <span class="ceremony-intro-chip ceremony-intro-chip--amber"><i class="fas fa-route"></i>League Nursery</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--violet"><i class="fas fa-school"></i>Nursery A</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--blend"><i class="fas fa-seedling"></i>Growth Festival</span>
            </div>
            <p class="ceremony-intro-splash__tagline">Every learner brings a special bloom to our garden.</p>
        </div>`;
}

function growthFieldPetalsHtml() {
  const petals = [
    ['🌸', '6%', '9%', '0s', '1.2'],
    ['🌼', '90%', '13%', '0.9s', '0.95'],
    ['🌷', '13%', '76%', '1.6s', '1.08'],
    ['🌺', '84%', '70%', '0.35s', '0.9'],
    ['✿', '47%', '4%', '2s', '0.72'],
    ['🌸', '23%', '22%', '2.4s', '0.78'],
    ['🌼', '71%', '83%', '1.15s', '0.82'],
    ['❀', '94%', '42%', '2.7s', '0.7'],
    ['🌷', '3%', '45%', '0.55s', '0.88']
  ];
  return `<div class="growth-petals" aria-hidden="true">${petals.map(([emoji, x, y, delay, scale]) =>
    `<span class="growth-petal" style="--x:${x};--y:${y};--d:${delay};--s:${scale}">${emoji}</span>`
  ).join('')}</div>`;
}

function growthBloomBurstHtml() {
  const petals = [
    ['🌸', '12deg', '56%', '0s', '1.18'],
    ['🌼', '48deg', '62%', '0.35s', '0.92'],
    ['🌷', '92deg', '57%', '0.7s', '1.08'],
    ['🌺', '138deg', '63%', '0.15s', '0.96'],
    ['🌸', '178deg', '58%', '1s', '0.86'],
    ['🌼', '222deg', '61%', '0.5s', '1.12'],
    ['✿', '266deg', '54%', '0.85s', '0.8'],
    ['🌷', '312deg', '60%', '0.22s', '1.02'],
    ['❀', '344deg', '52%', '1.2s', '0.76']
  ];
  return `<div class="growth-bloom-burst" aria-hidden="true">${petals.map(([emoji, angle, radius, delay, scale]) =>
    `<span class="growth-petal" style="--a:${angle};--r:${radius};--d:${delay};--s:${scale}">${emoji}</span>`
  ).join('')}</div>`;
}

function growthGardenButterfliesHtml() {
  return `
        <div class="growth-garden-butterflies" aria-hidden="true">
            <span class="growth-butterfly growth-butterfly--a">🦋</span>
            <span class="growth-butterfly growth-butterfly--b">✨</span>
            <span class="growth-butterfly growth-butterfly--c">🦋</span>
        </div>`;
}

function setCeremonyCaptureNarrator(ai, text) {
  if (!ai) return;
  if (!text) {
    ai.style.opacity = '0';
    return;
  }
  ai.style.opacity = '1';
  const p = document.getElementById('ceremony-ai-text');
  if (p) p.textContent = text;
}

function ceremonyGrowthGardenHtml() {
  return `
            <div class="growth-festival-garden" role="region" aria-label="Our League Garden">
                <div class="growth-garden-gate" aria-hidden="true"></div>
                ${growthFieldPetalsHtml()}
                ${growthGardenButterfliesHtml()}
                <div class="growth-garden-cards">
                    <article class="growth-class-card">
                        <span class="growth-class-emblem" aria-hidden="true">🌷</span>
                        <h3>Pre-Junior A</h3>
                        <p>Growing steadily</p>
                        <span class="growth-class-virtue">creativity bloom</span>
                    </article>
                    <article class="growth-class-card growth-class-card--pathfinder">
                        <span class="growth-class-emblem" aria-hidden="true">🐣</span>
                        <h3>Nursery A</h3>
                        <p>Blooming brightly</p>
                        <span class="growth-class-virtue">teamwork bloom</span>
                        <strong class="growth-class-pathfinder">✨ League Pathfinder</strong>
                    </article>
                </div>
            </div>`;
}

function ceremonyGrowthBloomHtml() {
  return `
            <div class="growth-festival-garden" role="region" aria-label="Parade of Blooms">
                <div class="growth-garden-gate" aria-hidden="true"></div>
                ${growthFieldPetalsHtml()}
                ${growthGardenButterfliesHtml()}
                <div class="growth-bloom-card-wrap">
            <article class="growth-bloom-card" data-student-id="alex">
                <div class="growth-bloom-wreath-container">
                    ${growthBloomBurstHtml()}
                    <div class="growth-bloom-wreath-img" aria-hidden="true"></div>
                    <div class="growth-bloom-avatar" aria-label="Alex">AL</div>
                </div>
                <h3>Alex</h3>
                <div class="growth-bloom-spotlight-pill growth-pill--growth">
                    <span>🌱</span>
                    <span>Growing Stronger</span>
                </div>
                <p>Alex helped our class garden grow stronger.</p>
                <div class="growth-bloom-counter-wrap">
                    <button type="button" class="growth-bloom-nav-btn growth-bloom-nav-btn--prev" disabled aria-label="Previous Bloom" title="Previous Bloom">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <div class="growth-bloom-counter">Bloom 1 of 4 🌸</div>
                    <button type="button" class="growth-bloom-nav-btn growth-bloom-nav-btn--next" aria-label="Next Bloom" title="Next Bloom">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
            </article>
                </div>
            </div>`;
}

function ceremonyGrowthFinaleHtml() {
  return `
            <div class="growth-final-garden" role="region" aria-label="Golden Bloom Celebration">
                ${growthFieldPetalsHtml()}
                ${growthGardenButterfliesHtml()}
                <div class="growth-golden-bloom-wrap">
                    <div class="growth-golden-bloom-item">
                        <div class="growth-golden-wreath-container">
                            ${growthBloomBurstHtml()}
                            <div class="growth-golden-bloom-wreath-img" aria-hidden="true"></div>
                            <div class="growth-golden-avatar" aria-label="Maria">👑</div>
                        </div>
                        <div class="growth-golden-kicker">✨ Prodigy of the Month ✨</div>
                        <h2 class="growth-golden-title">Maria</h2>
                    </div>
                </div>
                <div class="growth-mini-blooms-section">
                    <div class="growth-mini-blooms-label">Every Blossom in Our Class Family</div>
                    <div class="growth-mini-blooms" aria-label="All class members">
                        <div class="growth-mini-bloom-item" title="Alex"><span class="growth-mini-bloom-icon" aria-hidden="true">🌸</span><span class="growth-mini-bloom-name">Alex</span></div>
                        <div class="growth-mini-bloom-item" title="Maria"><span class="growth-mini-bloom-icon" aria-hidden="true">🌸</span><span class="growth-mini-bloom-name">Maria</span></div>
                        <div class="growth-mini-bloom-item" title="Nikos"><span class="growth-mini-bloom-icon" aria-hidden="true">🌸</span><span class="growth-mini-bloom-name">Nikos</span></div>
                        <div class="growth-mini-bloom-item" title="Eleni"><span class="growth-mini-bloom-icon" aria-hidden="true">🌸</span><span class="growth-mini-bloom-name">Eleni</span></div>
                    </div>
                </div>
            </div>`;
}

function classGoalPanelHtml() {
  return `
        <div class="ceremony-class-goal-panel">
            <div class="ceremony-class-goal-panel__header">
                <span class="ceremony-class-goal-panel__zone">🏰 Golden Citadel</span>
                <span class="ceremony-class-goal-panel__pct">62%</span>
            </div>
            <div class="ceremony-quest-trail" aria-label="Quest goal progress 62 percent">
                <div class="ceremony-quest-trail__track">
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--bronze"><div class="ceremony-quest-trail__fill" style="width:100%"></div></div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--silver"><div class="ceremony-quest-trail__fill" style="width:100%"></div></div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--gold"><div class="ceremony-quest-trail__fill" style="width:8%"></div></div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--crystal"><div class="ceremony-quest-trail__fill" style="width:0%"></div></div>
                </div>
                <div class="ceremony-quest-trail__marker" style="left:62%"></div>
            </div>
            <div class="ceremony-class-goal-panel__meta">
                <span>86 / 138 goal</span>
                <span class="ceremony-class-goal-panel__stages">🌿 🏔️ 🏰 💎</span>
            </div>
        </div>`;
}

function classMetricsHtml() {
  return `<div class="ceremony-card-metrics">
            <span class="ceremony-chip ceremony-chip--lvl-2">💧 Level 2</span>
            <span class="ceremony-chip ceremony-chip--zone-gold">🏰 Golden Citadel</span>
            <span class="ceremony-chip ceremony-chip--avg"><i class="fas fa-user-group"></i>7.2 avg/hero</span>
            <span class="ceremony-chip ceremony-chip--pathfinder"><i class="fas fa-map"></i>Pathfinder +10</span>
            <span class="ceremony-chip ceremony-chip--teamwork"><i class="fas fa-users"></i> Top: Teamwork</span>
            <span class="ceremony-chip ceremony-chip--heroes"><i class="fas fa-users"></i>12 heroes</span>
        </div>`;
}

export function ceremonyTeamCardHtml() {
  return `
    <div class="ceremony-display-card ceremony-display-card--class card-rank-1" style="position:relative">
      <div class="ceremony-card-aura"></div>
      <div class="ceremony-card-rankbar ceremony-card-rankbar--gold">
        <span class="ceremony-rank-badge__pill ceremony-rank-badge__pill--gold">🥇 Gold</span>
        <span class="ceremony-card-rankbar__label">Rank #1</span>
      </div>
      <div class="ceremony-card-shell">
        <span class="ceremony-my-class-badge">YOU</span>
        <div class="ceremony-card-kicker"><i class="fas fa-route"></i>Team Quest</div>
        <div class="text-8xl mb-4 filter drop-shadow-lg">📚</div>
        <h3 class="font-title ceremony-card-name text-gray-800">Junior B</h3>
        <div class="mt-2">
          <div class="ceremony-class-score-headline">
            <span class="ceremony-class-score-headline__value">86</span>
            <span class="ceremony-class-score-headline__label">Stars Collected</span>
            <span class="ceremony-class-score-headline__heroes"><i class="fas fa-users"></i>12 heroes</span>
          </div>
        </div>
        ${classMetricsHtml()}
        ${classGoalPanelHtml()}
      </div>
    </div>`;
}

function duelCardHtml(rank, name, logo, side) {
  const gold = rank === 1;
  return `
    <div id="showdown-card-${side}" class="ceremony-display-card ceremony-card ceremony-display-card--class face-off face-off--duel ${gold ? 'card-rank-1' : 'card-rank-2'} relative">
      <div class="ceremony-card-aura"></div>
      <div class="rank-badge ceremony-card-rankbar ${gold ? 'ceremony-card-rankbar--gold' : 'ceremony-card-rankbar--silver'}">
        <span class="ceremony-rank-badge__pill ${gold ? 'ceremony-rank-badge__pill--gold' : 'ceremony-rank-badge__pill--silver'}">${gold ? '🥇 Gold' : '🥈 Silver'}</span>
        <span class="ceremony-card-rankbar__label">Rank #${rank}</span>
      </div>
      <div class="ceremony-card-shell">
        <div class="ceremony-card-kicker"><i class="fas fa-shield-halved"></i>League Duel</div>
        <div class="text-8xl mb-4 filter drop-shadow-lg">${logo}</div>
        <h3 class="font-title ceremony-card-name text-gray-800">${name}</h3>
        <div class="star-count opacity-100">
          <div class="ceremony-class-score-headline">
            <span class="ceremony-class-score-headline__value">${gold ? '86' : '81'}</span>
            <span class="ceremony-class-score-headline__label">Stars Collected</span>
          </div>
        </div>
      </div>
    </div>`;
}

export function ceremonyDuelHtml() {
  return `
    ${duelCardHtml(2, 'Junior A', '🦊', 'left')}
    <div id="ceremony-vs-badge" class="ceremony-countdown-ring">
      <span class="ceremony-countdown-ring__halo"></span>
      <span class="ceremony-countdown-ring__number">VS</span>
      <span class="ceremony-countdown-ring__label">Final Duel</span>
    </div>
    ${duelCardHtml(1, 'Junior B', '📚', 'right')}`;
}

export function ceremonyHeroCardHtml() {
  return `
    <div class="ceremony-display-card ceremony-display-card--student card-rank-1" style="position:relative">
      <div class="ceremony-card-aura"></div>
      <div class="ceremony-card-rankbar ceremony-card-rankbar--gold">
        <span class="ceremony-rank-badge__pill ceremony-rank-badge__pill--gold">🥇 Gold</span>
        <span class="ceremony-card-rankbar__label">Rank #1</span>
      </div>
      <div class="ceremony-card-shell">
        <div class="ceremony-card-kicker"><i class="fas fa-user-shield"></i>Hero's Challenge</div>
        <div class="ceremony-card-class-strip">
            <span class="ceremony-card-class-strip__emoji" aria-hidden="true">📚</span>
            <span class="ceremony-card-class-strip__name">Junior B</span>
        </div>
        <div class="w-40 h-40 rounded-full flex items-center justify-center text-7xl font-bold mx-auto mb-4" style="background: linear-gradient(135deg,#6366f1,#8b5cf6); border: 4px solid #F59E0B; box-shadow: 0 0 18px #F59E0B66; color:white;">A</div>
        <h3 class="font-title ceremony-card-name text-gray-800">Alex</h3>
        <div class="mt-2"><span class="font-title text-3xl" style="color:#d97706;">48 ⭐</span></div>
        <div class="ceremony-card-metrics">
            <span class="ceremony-chip ceremony-chip--epic"><i class="fas fa-bolt"></i>6 × 3⭐</span>
            <span class="ceremony-chip ceremony-chip--strong"><i class="fas fa-star-half-alt"></i>4 × 2⭐</span>
            <span class="ceremony-chip ceremony-chip--teamwork"><i class="fas fa-users"></i> Teamwork</span>
            <span class="ceremony-chip ceremony-chip--variety"><i class="fas fa-shapes"></i>4 strengths</span>
        </div>
      </div>
    </div>`;
}

export function ceremonyTransitionHtml() {
  return `
            <div class="ceremony-transition-panel">
                <div class="ceremony-transition-panel__orb"></div>
                <div class="ceremony-transition-panel__gold-glow" aria-hidden="true"></div>
                <div class="ceremony-transition-panel__violet-glow" aria-hidden="true"></div>
                <div class="ceremony-transition-panel__kicker">The torches turn inward</div>
                <i class="fas fa-user-astronaut ceremony-transition-panel__icon"></i>
                <h2 class="font-title ceremony-transition-panel__title">Hero's Challenge</h2>
                <p class="ceremony-transition-panel__text">The league banners fade to gold, then violet — as your class heroes step into the spotlight.</p>
            </div>`;
}

export function attendanceChronicleInnerHtml() {
  return `
        <div class="flex items-center justify-between gap-3 mb-1 rounded-2xl border border-sky-200/85 bg-gradient-to-r from-white/95 via-sky-50/55 to-emerald-50/35 px-3 py-2.5 shadow-md shadow-sky-900/[0.06] backdrop-blur-sm">
            <button type="button" class="w-11 h-11 shrink-0 rounded-xl font-bold text-teal-900 bg-white/85 border border-teal-200/90 shadow-sm" aria-label="Previous month"><i class="fas fa-chevron-left"></i></button>
            <span class="font-title text-lg sm:text-xl md:text-2xl text-slate-800 text-center flex items-center justify-center gap-2 min-w-0 px-2"><i class="fas fa-book-open text-teal-600 shrink-0" aria-hidden="true"></i><span class="truncate">August 2026</span></span>
            <button type="button" class="w-11 h-11 shrink-0 rounded-xl font-bold text-teal-900 bg-white/85 border border-teal-200/90 shadow-sm" disabled aria-label="Next month"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="ac-month-rail-wrap">
            <div class="ac-month-rail-caption"><i class="fas fa-th" aria-hidden="true"></i> Month at a glance</div>
            <div class="ac-month-rail-scroll">
                <div class="ac-month-rail" role="list">
                    <div class="ac-day-chip ac-day-chip--lesson" role="listitem"><span class="ac-day-chip-wd">MON</span><span class="ac-day-chip-day">3</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                    <div class="ac-day-chip ac-day-chip--lesson" role="listitem"><span class="ac-day-chip-wd">WED</span><span class="ac-day-chip-day">5</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                    <div class="ac-day-chip ac-day-chip--school_holiday" role="listitem"><span class="ac-day-chip-wd">FRI</span><span class="ac-day-chip-day">14</span><span class="ac-day-chip-ico" aria-hidden="true">🏖️</span></div>
                    <div class="ac-day-chip ac-day-chip--lesson ac-day-chip--today" role="listitem"><span class="ac-day-chip-wd">MON</span><span class="ac-day-chip-day">31</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                </div>
            </div>
        </div>
        <div class="attendance-chronicle-summary-grid">
            <div class="attendance-summary-card attendance-summary-card--emerald">
                <div class="attendance-summary-label">Monthly Attendance</div>
                <div class="attendance-summary-value">94.4%</div>
                <div class="attendance-summary-meta">3 students tracked</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--blue">
                <div class="attendance-summary-label">Lessons Held</div>
                <div class="attendance-summary-value">4</div>
                <div class="attendance-summary-meta">Includes one-off lesson dates</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--rose">
                <div class="attendance-summary-label">Total Absences</div>
                <div class="attendance-summary-value">2</div>
                <div class="attendance-summary-meta">Across all students this month</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--amber">
                <div class="attendance-summary-label">Perfect Attendees</div>
                <div class="attendance-summary-value">1</div>
                <div class="attendance-summary-meta">No absences this month</div>
            </div>
        </div>
        <div class="attendance-chronicle-toolbar">
            <div class="attendance-chronicle-legend">
                <span class="attendance-legend-pill attendance-legend-pill--present"><i class="fas fa-check" aria-hidden="true"></i> Present</span>
                <span class="attendance-legend-pill attendance-legend-pill--absent"><i class="fas fa-times" aria-hidden="true"></i> Absent</span>
                <span class="attendance-legend-pill attendance-legend-pill--map-lesson"><i class="fas fa-school" aria-hidden="true"></i> Scheduled lesson</span>
                <span class="attendance-legend-pill attendance-legend-pill--map-break"><i class="fas fa-umbrella-beach" aria-hidden="true"></i> Break</span>
            </div>
            <div class="attendance-chronicle-mode is-live">
                <i class="fas fa-pen"></i> Live month: tap to edit attendance
            </div>
        </div>
        <div class="attendance-chronicle-table-wrap"><table class="attendance-chronicle-table"><thead><tr>
            <th class="attendance-student-col">Student</th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">3</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">0 absent</span></div></th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">5</span><span class="attendance-date-chip-weekday">Wed</span><span class="attendance-date-chip-meta">1 absent</span></div></th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">10</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">1 absent</span></div></th>
            <th class="attendance-date-col attendance-date-col--today"><div class="attendance-date-chip attendance-date-chip--today"><span class="attendance-date-chip-day">31</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">Today</span></div></th>
            <th class="attendance-summary-col">Absences</th>
            <th class="attendance-summary-col">Attendance %</th>
        </tr></thead><tbody>
            <tr class="attendance-row attendance-row--even">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">A</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Alex</div><div class="attendance-student-subtitle">4 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">0</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill is-strong">100%</span></td>
            </tr>
            <tr class="attendance-row attendance-row--odd">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">M</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Maria</div><div class="attendance-student-subtitle">3 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-absent bg-red-500" title="Absent"><i class="fas fa-times text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">1</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill">75%</span></td>
            </tr>
            <tr class="attendance-row attendance-row--even">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">N</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Nikos</div><div class="attendance-student-subtitle">3 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-absent bg-red-500" title="Absent"><i class="fas fa-times text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">1</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill">75%</span></td>
            </tr>
        </tbody></table></div>`;
}

export function showCeremony(mode) {
  const screen = document.getElementById('ceremony-screen');
  const stage = document.getElementById('ceremony-stage-area');
  const title = document.getElementById('ceremony-title');
  const subtitle = document.getElementById('ceremony-subtitle');
  const header = document.getElementById('ceremony-header');
  const btn = document.getElementById('ceremony-action-btn');
  const label = btn?.querySelector('.ceremony-action-btn__label');
  const ai = document.getElementById('ceremony-ai-box');
  if (!screen || !stage) return;

  const growth = String(mode || '').startsWith('growth-');
  const view = growth
    ? (mode === 'growth-intro' ? 'intro' : 'students')
    : (mode === 'team' || mode === 'duel' ? 'classes' : mode === 'hero' ? 'students' : mode);

  screen.classList.remove('hidden');
  screen.classList.add('capture-ceremony');
  screen.classList.remove(
    'ceremony-view--intro',
    'ceremony-view--classes',
    'ceremony-view--transition',
    'ceremony-view--students',
    'ceremony-view--growth',
    'ceremony-phase-suspense'
  );
  stage.classList.remove('ceremony-stage--podium', 'ceremony-stage--podium-duo');
  header?.classList.toggle('ceremony-header--intro', view === 'intro');
  header?.classList.remove('ceremony-header--hidden');
  btn?.classList.remove(
    'ceremony-action-btn--intro',
    'ceremony-action-btn--classes',
    'ceremony-action-btn--transition',
    'ceremony-action-btn--students',
    'ceremony-action-btn--growth'
  );
  if (growth) {
    screen.classList.add('ceremony-view--growth');
    btn?.classList.add('ceremony-action-btn--growth');
  } else {
    btn?.classList.add(`ceremony-action-btn--${view}`);
  }

  if (mode === 'growth-intro') {
    header?.classList.add('ceremony-header--intro');
    stage.innerHTML = ceremonyGrowthIntroSplashHtml();
    if (title) title.textContent = 'The Great Class Quest';
    if (subtitle) subtitle.textContent = 'Ceremony of the Month';
    if (label) label.textContent = 'Enter the Garden 🌸';
    setCeremonyCaptureNarrator(ai, '');
    return;
  }

  if (mode === 'growth-garden') {
    stage.innerHTML = ceremonyGrowthGardenHtml();
    if (title) title.innerHTML = '<span class="gradient-text">Our League Garden</span>';
    if (subtitle) subtitle.innerHTML = '<span class="gradient-text">Every class grows in its own beautiful way</span>';
    if (label) label.textContent = 'Explore Our Blooms 🌸';
    setCeremonyCaptureNarrator(ai, 'Look how our classroom garden is blossoming together! 🌸🌱');
    return;
  }

  if (mode === 'growth-bloom') {
    stage.innerHTML = ceremonyGrowthBloomHtml();
    if (title) title.innerHTML = '<span class="gradient-text">Parade of Blooms</span>';
    if (subtitle) subtitle.innerHTML = '<span class="gradient-text">A special part of our garden</span>';
    if (label) label.textContent = 'Next Bloom 🌸';
    setCeremonyCaptureNarrator(ai, 'Let\'s celebrate Alex — Alex helped our class garden grow stronger. 🌸');
    return;
  }

  if (mode === 'growth-finale') {
    stage.innerHTML = ceremonyGrowthFinaleHtml();
    if (title) title.innerHTML = '<span class="gradient-text">Golden Bloom</span>';
    if (subtitle) subtitle.innerHTML = '<span class="gradient-text">Prodigy of the Month</span>';
    if (label) label.textContent = 'Finish Ceremony 🌿';
    setCeremonyCaptureNarrator(ai, 'Behold our Golden Bloom! A shining flower of wonder in our whole class family! 👑✨');
    return;
  }

  if (mode === 'intro') {
    screen.classList.add('ceremony-view--intro');
    stage.innerHTML = ceremonyIntroSplashHtml();
    if (title) title.textContent = 'The Great Class Quest';
    if (subtitle) subtitle.textContent = 'Ceremony of the Month';
    if (label) label.textContent = 'Start Ceremony';
    if (ai) ai.style.opacity = '0';
    return;
  }

  if (mode === 'team') {
    screen.classList.add('ceremony-view--classes');
    stage.innerHTML = ceremonyTeamCardHtml();
    if (title) title.textContent = 'Rank #1';
    if (subtitle) subtitle.textContent = 'Team Quest';
    if (label) label.textContent = 'Next';
    if (ai) {
      ai.style.opacity = '1';
      const p = document.getElementById('ceremony-ai-text');
      if (p) p.textContent = 'Junior B leads the league — Pathfinder bonus and a Golden Citadel finish.';
    }
    return;
  }

  if (mode === 'duel') {
    screen.classList.add('ceremony-view--classes', 'ceremony-phase-suspense');
    stage.innerHTML = ceremonyDuelHtml();
    if (title) title.textContent = 'The Final Duel';
    if (subtitle) subtitle.textContent = 'Two legends remain...';
    if (label) label.textContent = '🥁 Drumroll...';
    if (ai) {
      ai.style.opacity = '1';
      const p = document.getElementById('ceremony-ai-text');
      if (p) p.textContent = 'Two legends remain — Junior A and Junior B. Drumroll for the league crown.';
    }
    return;
  }

  if (mode === 'transition') {
    screen.classList.add('ceremony-view--transition');
    stage.innerHTML = ceremonyTransitionHtml();
    if (title) title.textContent = 'Individual Honors';
    if (subtitle) subtitle.textContent = 'Who went above and beyond?';
    if (label) label.textContent = "Begin Hero's Challenge";
    if (ai) ai.style.opacity = '0';
    return;
  }

  if (mode === 'hero') {
    screen.classList.add('ceremony-view--students');
    stage.innerHTML = ceremonyHeroCardHtml();
    if (title) title.textContent = 'Rank #1';
    if (subtitle) subtitle.textContent = "Hero's Challenge";
    if (label) label.textContent = 'Next';
    if (ai) {
      ai.style.opacity = '1';
      const p = document.getElementById('ceremony-ai-text');
      if (p) p.textContent = 'Alex leads the class — six epic lessons and four strengths this month.';
    }
  }
}

export function hideCeremony() {
  document.getElementById('ceremony-screen')?.classList.add('hidden');
  document.getElementById('ceremony-screen')?.classList.remove('capture-ceremony', 'ceremony-phase-suspense');
}

export function showAttendanceChronicle() {
  const modal = document.getElementById('attendance-chronicle-modal');
  const title = document.getElementById('attendance-chronicle-title');
  const content = document.getElementById('attendance-chronicle-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-ac');
  if (title) title.innerHTML = '📚 Attendance Chronicle';
  content.innerHTML = attendanceChronicleInnerHtml();
}

export function hideAttendanceChronicle() {
  document.getElementById('attendance-chronicle-modal')?.classList.add('hidden');
  document.getElementById('attendance-chronicle-modal')?.classList.remove('capture-ac');
}

export function showTrialType() {
  const modal = document.getElementById('trial-type-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-trial');
}

export function hideTrialType() {
  document.getElementById('trial-type-modal')?.classList.add('hidden');
  document.getElementById('trial-type-modal')?.classList.remove('capture-trial');
}
