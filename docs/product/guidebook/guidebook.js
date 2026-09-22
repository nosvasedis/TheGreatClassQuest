(function () {
  const G = window.GCQ_GUIDE || { terms: [], ui: { en: {}, el: {} }, chapters: [], search: {}, kickers: {} };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function lang() {
    return document.documentElement.dataset.lang === 'el' ? 'el' : 'en';
  }

  function t(key) {
    const pack = G.ui[lang()] || G.ui.en || {};
    return pack[key] || (G.ui.en && G.ui.en[key]) || key;
  }

  function applyLang(next) {
    const code = next === 'el' ? 'el' : 'en';
    document.documentElement.lang = code === 'el' ? 'el' : 'en';
    document.documentElement.dataset.lang = code;
    try { localStorage.setItem('gcq-guidebook-lang', code); } catch (_) {}
    $$('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (el.hasAttribute('data-i18n-placeholder')) el.setAttribute('placeholder', val);
      else if (el.hasAttribute('data-i18n-aria')) el.setAttribute('aria-label', val);
      else if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
      else el.textContent = val;
    });
    $$('[data-kicker]').forEach((el) => {
      const id = el.getAttribute('data-kicker');
      if (id === 'plans') {
        el.innerHTML = '<span class="plan-badge plan-badge--starter">Starter</span> <span class="plan-badge plan-badge--pro">Pro</span> <span class="plan-badge plan-badge--elite">Elite</span>';
        return;
      }
      const row = (G.kickers || {})[id];
      if (row) el.textContent = row[code] || row.en;
    });
    $$('[data-group]').forEach((el) => {
      const key = el.getAttribute('data-group');
      el.textContent = t(key);
    });
    $$('.chapter-lang').forEach((el) => {
      el.hidden = el.getAttribute('data-lang') !== code;
    });
    $$('.lang-btn').forEach((btn) => {
      btn.classList.toggle('is-on', btn.getAttribute('data-lang') === code);
    });
    const q = $('#search')?.value;
    if (q) runSearch(q);
  }

  function termById(id) {
    return (G.terms || []).find((x) => x.id === id);
  }

  function goldMark(text = 'Gold') {
    return `<span class="gold-amt"><i class="fas fa-coins" aria-hidden="true"></i> ${text}</span>`;
  }

  function starIco() {
    return '<span class="star-amt" aria-hidden="true"><i class="fas fa-star"></i></span>';
  }

  function starsOf(n) {
    const count = Math.max(1, Math.min(3, Number(n) || 1));
    return starIco().repeat(count);
  }

  function paintStars(text) {
    let t = String(text || '');
    t = t.replace(
      /\b1,\s*2,\s*or\s*3\s*stars\b/gi,
      `1 ${starIco()}, 2 ${starsOf(2)}, or 3 ${starsOf(3)}`
    );
    t = t.replace(
      /\b1,\s*2\s*ή\s*3\s*αστέρια\b/gi,
      `1 ${starIco()}, 2 ${starsOf(2)} ή 3 ${starsOf(3)}`
    );
    t = t.replace(
      /([+]?\d+(?:\.\d+)?)\s+(?:Team Quest\s+)?stars?\b/gi,
      (_, n) => `${n} ${starIco()}`
    );
    t = t.replace(
      /([+]?\d+(?:[.,]\d+)?)\s*αστ[εέ]ρι(?:α|ών)?/gi,
      (_, n) => `${n} ${starIco()}`
    );
    t = t.replace(/\b(\d+)-star\b/gi, (_, n) => `${n}${starIco()}`);
    t = t.replace(/\b(monthly|bonus|total)\s+stars\b/gi, (_, w) => `${w} ${starIco()}`);
    t = t.replace(/\bμηνιαί[αο]\s+αστέρια\b/gi, (m) => m.replace(/αστέρια/i, starIco()));
    return t;
  }

  function paintGold(text) {
    return paintStars(
      String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/\bGold\b/g, goldMark('Gold'))
    );
  }

  function termIcon(id) {
    return (G.termIcons && G.termIcons[id]) || '';
  }

  function termShot(file, alt) {
    const safe = String(alt || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    return `<figure class="term-shot"><img src="media/ui/${file}" alt="${safe}" /></figure>`;
  }

  function widgetHtml(term) {
    const w = term.widget;
    if (w === 'gold') {
      return `<span class="coin-pill coin-pill--guide" title="Gold"><i class="fas fa-coins" aria-hidden="true"></i><span>42</span></span>`;
    }
    if (w === 'hero-boon') {
      return `<div class="live-row">
        <button type="button" class="boon-btn boon-btn--eligible" title="Bestow Hero's Boon"><i class="fas fa-heart"></i></button>
        <button type="button" class="boon-btn boon-btn--disabled" title="Not eligible"><i class="fas fa-heart-broken"></i></button>
      </div>`;
    }
    if (w === 'teacher-boon') {
      return `<button type="button" class="teacher-boon-launch-btn" title="Teacher Boon">
        <span class="teacher-boon-launch-btn__glow"></span>
        <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--a">✦</span>
        <i class="fas fa-wand-magic-sparkles teacher-boon-launch-btn__icon"></i>
        <span class="teacher-boon-launch-btn__label">Teacher Boon</span>
      </button>`;
    }
    if (w === 'absence') {
      return `<div class="live-row">
        <button type="button" class="absence-btn absence-btn--absent" title="Mark as Absent"><i class="fas fa-user-slash"></i></button>
        <button type="button" class="welcome-back-btn" title="Welcome Back"><i class="fas fa-hand-sparkles"></i></button>
      </div>`;
    }
    if (w === 'virtues') {
      return `<div class="star-award-demo">
        <div class="star-selector-container visible">
          <button type="button" class="star-award-btn star-btn-1" aria-label="Award 1 star"><span class="star-btn__badge">1</span><i class="fas fa-star"></i></button>
          <span class="star-divider" aria-hidden="true"></span>
          <button type="button" class="star-award-btn star-btn-2" aria-label="Award 2 stars"><span class="star-btn__badge">2</span><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
          <span class="star-divider" aria-hidden="true"></span>
          <button type="button" class="star-award-btn star-btn-3" aria-label="Award 3 stars"><span class="star-btn__badge">3</span><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
        </div>
      </div>
      <div class="live-row live-row--virtues">
        <span class="reason-chip rc-team"><i class="fas fa-users"></i> Teamwork</span>
        <span class="reason-chip rc-create"><i class="fas fa-lightbulb"></i> Creativity</span>
        <span class="reason-chip rc-respect"><i class="fas fa-hands-helping"></i> Respect</span>
        <span class="reason-chip rc-focus"><i class="fas fa-brain"></i> Focus</span>
      </div>${termShot('award-stars-tab.png', 'Award Stars tab: floating student clouds')}`;
    }
    if (w === 'ceremony') {
      return termShot('ceremony-intro.png', 'Ceremony of the Month intro splash');
    }
    if (w === 'classic-arena') {
      return termShot('ceremony-intro.png', 'Classic Arena intro: Team Quest → Hero’s Challenge');
    }
    if (w === 'growth-festival') {
      return termShot('ceremony-growth-intro.png', 'Growth Festival intro splash')
        + termShot('ceremony-growth-garden.png', 'Our League Garden')
        + termShot('ceremony-growth-bloom.png', 'Parade of Blooms card');
    }
    if (w === 'league-pathfinder') {
      return termShot('ceremony-growth-garden.png', 'League Pathfinder is the last class card in Our League Garden');
    }
    if (w === 'ceremony-hero') {
      return termShot('ceremony-hero.png', "Hero's Challenge rank card in the Ceremony of the Month");
    }
    if (w === 'attendance') {
      return termShot('attendance-chronicle.png', 'Attendance Chronicle month ledger');
    }
    if (w === 'trial-type') {
      return termShot('trial-type.png', 'Choose Your Challenge: Test or Dictation');
    }
    if (w === 'market') {
      return termShot('market-legendaries.png', 'Mystic Market legendary artifacts');
    }
    if (w === 'seasonal') {
      return termShot('market-seasonal.png', 'Seasonal Treasures stall');
    }
    if (w === 'fortunes-wheel') {
      return termShot('fortunes-wheel.png', "Fortune's Wheel relic");
    }
    if (w === 'fortune-ledger') {
      return termShot('fortune-ledger.png', 'Fortune Ledger: Wheel history on Guild Hall');
    }
    if (w === 'guild-power') {
      return termShot('guild-power.png', 'Guild Power: 70 / 15 / 10 / 5 mix, scored per member');
    }
    if (w === 'quiz-week') {
      return termShot('quiz-of-the-week.png', 'Quiz of the Week on the Home weather card')
        + termShot('quiz-play-question.png', 'Quiz of the Week in play: a student is spotlighted for a multiple-choice question');
    }
    if (w === 'story-weavers') {
      return termShot('story-weavers.png', 'Story Weavers: Word of the Day and the Current Chronicle');
    }
    if (w === 'quest-event') {
      return termShot('calendar-planner-event.png', 'Day Planner · Quest Event');
    }
    if (w === 'special-quest') {
      return termShot('special-quest-runner.png', 'Special Quest runner: Vocabulary Vault in progress, with vault gems')
        + termShot('special-quest-projector.png', 'The same Special Quest on the classroom projector');
    }
    if (w === 'levels') {
      return `<div class="live-row live-row--levels">
        <span class="lvl l1">🌱 Level 1</span><span class="lvl l2">💧 Level 2</span><span class="lvl l3">🛡️ Level 3</span>
        <span class="lvl l4">🔮 Level 4</span><span class="lvl l5">🔥 Level 5</span><span class="lvl l6">🐉 Level 6</span>
      </div>`;
    }
    if (w === 'houses') {
      return `<div class="live-row live-row--houses">
        <img src="media/dragonflame.webp" alt="" /><img src="media/grizzlymight.webp" alt="" />
        <img src="media/owlwisdom.webp" alt="" /><img src="media/phoenixrising.webp" alt="" />
      </div>`;
    }
    if (w === 'map') {
      return `<figure class="map-stage">
        <div class="map-stage__art">
          <img src="media/league-map.png" alt="League Map" />
          <div class="map-zone-label map-zone-label--bronze" style="left:10%;top:75%"><span class="map-zone-label__icon" aria-hidden="true">🌿</span><span class="map-zone-label__copy"><span class="map-zone-label__text">Bronze Meadows</span><span class="map-zone-label__pct">0%</span></span></div>
          <div class="map-zone-label map-zone-label--silver" style="left:32%;top:15%"><span class="map-zone-label__icon" aria-hidden="true">🏔️</span><span class="map-zone-label__copy"><span class="map-zone-label__text">Silver Peaks</span><span class="map-zone-label__pct">30%</span></span></div>
          <div class="map-zone-label map-zone-label--gold" style="left:70%;top:65%"><span class="map-zone-label__icon" aria-hidden="true">🏰</span><span class="map-zone-label__copy"><span class="map-zone-label__text">Golden Citadel</span><span class="map-zone-label__pct">60%</span></span></div>
          <div class="map-zone-label map-zone-label--crystal" style="left:88%;top:8%"><span class="map-zone-label__icon" aria-hidden="true">💎</span><span class="map-zone-label__copy"><span class="map-zone-label__text">Crystal Realm</span><span class="map-zone-label__pct">85%</span></span></div>
        </div>
      </figure>${termShot('team-quest.png', 'Team Quest class rank cards')}`;
    }
    if (w === 'nav') {
      const color = term.nav || 'cyan';
      const icon = {
        cyan: 'fa-home',
        purple: 'fa-user-graduate',
        lime: 'fa-store',
        indigo: 'fa-feather-alt',
        pink: 'fa-scroll',
        amber: 'fa-route',
        guild: 'fa-shield-alt',
        rose: 'fa-star',
        teal: 'fa-book-open',
        blue: 'fa-calendar-alt'
      }[color] || 'fa-star';
      return `<a class="dock-mini nav-color-${color}" href="#${term.chapter}"><i class="fas ${icon}"></i>${term.names.en}</a>${
        term.id === 'heros-challenge'
          ? termShot('heros-challenge.png', "Hero's Challenge tab: monthly student ranks")
          : ''
      }`;
    }
    if (w === 'projector') {
      return termShot('projector.png', 'Projector Mode: classroom wallpaper with sky, clocks, class badge, bounty pill, and Director cards');
    }
    if (w === 'skill-tree') {
      return termShot('skill-tree.png', 'Guardian Skill Tree with a pending branch');
    }
    if (w === 'starfall') {
      return termShot('starfall.png', 'Starfall: confirm Scholar’s Bonus stars after a high trial');
    }
    if (w === 'chronicle') {
      return termShot('settings-chronicle.png', "Hero’s Chronicle: History of Deeds and New Entry");
    }
    if (w === 'roster') {
      return termShot('settings-roster.png', 'Manage Students roster with Guild, Skill Tree, and Chronicle buttons');
    }
    if (w === 'artifacts') {
      return termShot('market-legendaries.png', 'Legendary Artifacts in Mystic Market');
    }
    if (w === 'familiars') {
      return termShot('market-eggs.png', 'Familiar eggs in Mystic Market');
    }
    if (w === 'hero-classes') {
      return `<div class="hero-class-row hero-class-row--mini">
        <article class="hero-class-chip" style="--hc:#16a34a"><span>🛡️</span><strong>Guardian</strong></article>
        <article class="hero-class-chip" style="--hc:#9333ea"><span>🔮</span><strong>Sage</strong></article>
        <article class="hero-class-chip" style="--hc:#2563eb"><span>⚔️</span><strong>Paladin</strong></article>
        <article class="hero-class-chip" style="--hc:#d97706"><span>⚙️</span><strong>Artificer</strong></article>
        <article class="hero-class-chip" style="--hc:#0d9488"><span>✒️</span><strong>Weaver</strong></article>
        <article class="hero-class-chip" style="--hc:#0891b2"><span>📜</span><strong>Scholar</strong></article>
        <article class="hero-class-chip" style="--hc:#7c3aed"><span>👟</span><strong>Nomad</strong></article>
      </div>${termShot('hero-class.png', 'Hero Class ceremony: preview a vocation, then Swear this Path')}`;
    }
    if (w === 'bounty') {
      return `<span class="quest-chip qc-bounty"><i class="fas fa-bullseye"></i> Bounty · 12 stars · 5:00</span>`;
    }
    if (w === 'guide') {
      return `<button type="button" class="hdr-btn hdr-btn--solid" title="Adventurer's Guide"><i class="fas fa-info"></i></button>`;
    }
    if (w === 'family') {
      return `<div class="family-card"><span>👨‍👩‍👧</span><div><strong>Family Portal</strong><p>One login per child</p></div></div>`;
    }
    if (w === 'office') {
      return `<div class="office-mini">
        <p class="office-mini__kicker">Secretary</p>
        <strong class="office-mini__title">School Office</strong>
        <div class="office-mini__tabs">
          <span>Home</span><span>School</span><span>Grades</span><span>Messages</span><span class="is-on">Admin</span>
        </div>
        <p class="office-mini__note">School year, holiday ranges, weather city, grading defaults. Not a second classroom.</p>
      </div>`;
    }
    if (w === 'hero-day') {
      return termShot('hero-of-the-day.png', 'Hero of the Day celebration');
    }
    if (w === 'hall-of-heroes') {
      return termShot('hall-of-heroes.png', 'Hall of Heroes legend cards');
    }
    if (w === 'hall-of-prodigies') {
      return termShot('hall-of-prodigies.png', 'Hall of Prodigies: completed months only');
    }
    return '';
  }

  let currentChapter = '';

  function openTerm(id, fromChapter) {
    const term = termById(id);
    const modal = $('#term-modal');
    if (!term || !modal) return;
    const L = lang();
    const title = term.names[L] || term.names.en;
    const titleEl = $('#term-modal-title');
    if (term.id === 'gold') titleEl.innerHTML = goldMark(title);
    else {
      const ico = termIcon(term.id);
      titleEl.innerHTML = ico
        ? `<i class="fas ${ico}" aria-hidden="true"></i> ${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}`
        : title;
    }
    $('#term-modal-def').innerHTML = paintGold(term.def[L] || term.def.en);
    const looks = $('#term-modal-looks');
    const html = widgetHtml(term);
    looks.hidden = !html;
    looks.querySelector('.term-widget').innerHTML = html;
    const more = $('#term-modal-more');
    more.href = '#' + term.chapter;
    const here = fromChapter || currentChapter;
    const sameChapter = !!term.chapter && term.chapter === here;
    more.hidden = sameChapter;
    more.setAttribute('aria-hidden', sameChapter ? 'true' : 'false');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    $('#term-modal-close')?.focus();
  }

  function closeTerm() {
    const modal = $('#term-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokensOf(raw) {
    return norm(raw).split(' ').filter((t) => t.length >= 2);
  }

  function hayForChapter(id) {
    const ch = (G.chapters || []).find((c) => c.id === id);
    const extra = ((G.search || {})[id] || []).join(' ');
    const kick = (G.kickers || {})[id] || {};
    const termBits = (G.terms || [])
      .filter((term) => term.chapter === id)
      .map((term) => [term.names.en, term.names.el, (term.aliases || []).join(' ')].join(' '))
      .join(' ');
    return norm([id, ch?.titleEn, ch?.titleEl, kick.en, kick.el, extra, termBits, ch?.textEn, ch?.textEl].join(' '));
  }

  function hayForTerm(term) {
    return norm([
      term.names.en,
      term.names.el,
      (term.aliases || []).join(' '),
      term.def?.en,
      term.def?.el,
      term.confuse?.en,
      term.confuse?.el,
      term.chapter
    ].join(' '));
  }

  function scoreBlob(hay, q, tokens) {
    if (!tokens.length) return 0;
    let score = 0;
    if (hay.includes(q)) score += 80;
    if (tokens.every((tok) => hay.includes(tok))) score += 20;
    if (hay.includes(tokens.join(' '))) score += 40;
    return score;
  }

  function runSearch(raw) {
    const q = norm(raw);
    const tokens = tokensOf(raw);
    const panel = $('#search-panel');
    const links = $$('.nav-link');
    if (!tokens.length) {
      links.forEach((a) => a.classList.remove('hidden-nav', 'search-hit'));
      $$('.nav-group').forEach((g) => { g.hidden = false; });
      if (panel) { panel.hidden = true; panel.innerHTML = ''; }
      return;
    }
    const chapterHits = [];
    links.forEach((a) => {
      const id = a.dataset.chapter;
      const hay = hayForChapter(id);
      const score = scoreBlob(hay, q, tokens);
      const hit = score > 0;
      a.classList.toggle('hidden-nav', !hit);
      a.classList.toggle('search-hit', hit);
      if (hit) chapterHits.push({ id, label: a.textContent.trim(), href: a.getAttribute('href'), score });
    });
    chapterHits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    $$('.nav-group').forEach((g) => {
      const any = $$('.nav-link', g).some((a) => !a.classList.contains('hidden-nav'));
      g.hidden = !any;
    });
    const termHits = (G.terms || [])
      .map((term) => ({ term, score: scoreBlob(hayForTerm(term), q, tokens) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!panel) return;
    if (!chapterHits.length && !termHits.length) {
      panel.hidden = false;
      panel.innerHTML = `<p class="search-empty">${t('searchEmpty')}</p>`;
      return;
    }
    panel.hidden = false;
    panel.innerHTML = `
      ${termHits.length ? `<p class="search-kicker">${t('searchTerms')}</p><ul>${termHits.map((row) => `<li><button type="button" class="search-term" data-term="${row.term.id}">${row.term.names[lang()] || row.term.names.en}</button></li>`).join('')}</ul>` : ''}
      ${chapterHits.length ? `<p class="search-kicker">${t('searchChapters')}</p><ul>${chapterHits.map((h) => `<li><a href="${h.href}">${h.label}</a></li>`).join('')}</ul>` : ''}
    `;
  }

  function bindPlanExplorer() {
    $$('.plan-explorer').forEach((root) => {
      const panes = $$('[data-plan-pane]', root);
      const tabs = $$('[data-plan-tab]', root);
      const order = ['starter', 'pro', 'elite'];
      function show(id) {
        panes.forEach((p) => { p.hidden = p.getAttribute('data-plan-pane') !== id; });
        tabs.forEach((b) => b.classList.toggle('is-on', b.getAttribute('data-plan-tab') === id));
        root.dataset.plan = id;
      }
      tabs.forEach((b) => b.addEventListener('click', () => show(b.getAttribute('data-plan-tab'))));
      $('[data-plan-prev]', root)?.addEventListener('click', () => {
        const i = Math.max(0, order.indexOf(root.dataset.plan) - 1);
        show(order[i]);
      });
      $('[data-plan-next]', root)?.addEventListener('click', () => {
        const i = Math.min(order.length - 1, order.indexOf(root.dataset.plan) + 1);
        show(order[i]);
      });
      show(root.dataset.plan || 'starter');
    });
  }

  document.addEventListener('click', (e) => {
    const termBtn = e.target.closest('[data-term]');
    if (termBtn) {
      e.preventDefault();
      const wrap = termBtn.closest('.chapter-wrap');
      openTerm(termBtn.getAttribute('data-term'), wrap?.id || currentChapter);
      if (e.target.closest('#rail')) $('#rail')?.classList.remove('open');
      return;
    }
    if (e.target.closest('#rail a')) $('#rail')?.classList.remove('open');
    if (e.target.closest('[data-term-close]') || e.target === $('#term-modal')) closeTerm();
    if (e.target.closest('#term-modal a')) closeTerm();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTerm(); });

  $('#search')?.addEventListener('input', (e) => runSearch(e.target.value));
  $('#search')?.addEventListener('focus', () => {
    if ($('#search').value.trim()) runSearch($('#search').value);
  });

  $$('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang')));
  });

  $('#menu-btn')?.addEventListener('click', () => $('#rail')?.classList.toggle('open'));

  const links = $$('.nav-link');
  const wraps = $$('.chapter-wrap');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      currentChapter = entry.target.id;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
  wraps.forEach((c) => io.observe(c));
  currentChapter = (location.hash || '').replace('#', '') || 'why-we-quest';

  bindPlanExplorer();
  let start = 'en';
  try { start = localStorage.getItem('gcq-guidebook-lang') || 'en'; } catch (_) {}
  applyLang(start);
})();
