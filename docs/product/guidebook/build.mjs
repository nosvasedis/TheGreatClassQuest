import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS, TERM_ICONS, PLAN_EXPLORER, PLAN_CHIP_ICONS, CHAPTER_SEARCH } from './terms.mjs';
import { decorateStarCounts } from './stars.mjs';
import { UI, KICKERS } from './i18n.mjs';
import { EL_CHAPTERS } from './el-chapters.mjs';
import {
  headerToolsHtml,
  classPickerHtml,
  heroClassesHtml,
  officeHtml,
  familyPortalHtml,
  glossaryRacesHtml,
  welcomeBackHtml,
  ethosHtml,
  housesHtml,
  namesDistinctHtml,
  mobileDockHtml,
  starAwardBtnsHtml,
  mapStageHtml
} from './chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT = path.resolve(__dirname, '..');
const MEDIA = path.join(__dirname, 'media');

const CHAPTERS = [
  { id: 'why-we-quest', file: '00-why-we-quest.md', icon: 'fa-heart', color: 'rose', group: 'Start here', kicker: 'Philosophy' },
  { id: 'the-quest', file: '00-the-quest.md', icon: 'fa-compass', color: 'cyan', group: 'Start here', kicker: 'Orientation' },
  { id: 'classroom-chrome', file: 'teacher/01-classroom-chrome.md', icon: 'fa-tv', color: 'cyan', group: 'The classroom', kicker: 'Around the tabs' },
  { id: 'home', file: 'teacher/02-home.md', icon: 'fa-home', color: 'cyan', group: 'The classroom', kicker: 'Tab · Home' },
  { id: 'team-quest', file: 'teacher/03-team-quest.md', icon: 'fa-route', color: 'amber', group: 'The classroom', kicker: 'Tab · Team Quest' },
  { id: 'heros-challenge', file: 'teacher/04-heros-challenge.md', icon: 'fa-user-graduate', color: 'purple', group: 'The classroom', kicker: "Tab · Hero's Challenge" },
  { id: 'ceremony', file: 'teacher/05-ceremony-of-the-month.md', icon: 'fa-trophy', color: 'amber', group: 'The classroom', kicker: 'Ceremony of the Month' },
  { id: 'market', file: 'teacher/06-mystic-market-and-economy.md', icon: 'fa-store', color: 'lime', group: 'The classroom', kicker: 'Tab · Mystic Market' },
  { id: 'guild-hall', file: 'teacher/07-guild-hall.md', icon: 'fa-shield-alt', color: 'guild', group: 'The classroom', kicker: 'Tab · Guild Hall' },
  { id: 'award-stars', file: 'teacher/08-award-stars.md', icon: 'fa-star', color: 'rose', group: 'The classroom', kicker: 'Tab · Award Stars' },
  { id: 'adventure-log', file: 'teacher/09-adventure-log.md', icon: 'fa-book-open', color: 'teal', group: 'The classroom', kicker: 'Tab · Adventure Log' },
  { id: 'scholars-scroll', file: 'teacher/10-scholars-scroll.md', icon: 'fa-scroll', color: 'pink', group: 'The classroom', kicker: "Tab · Scholar's Scroll" },
  { id: 'quest-calendar', file: 'teacher/11-quest-calendar.md', icon: 'fa-calendar-alt', color: 'blue', group: 'The classroom', kicker: 'Tab · Quest Calendar' },
  { id: 'story-weavers', file: 'teacher/12-story-weavers.md', icon: 'fa-feather-alt', color: 'indigo', group: 'The classroom', kicker: 'Tab · Story Weavers' },
  { id: 'settings', file: 'teacher/13-settings-and-roster.md', icon: 'fa-cog', color: 'slate', group: 'The classroom', kicker: 'Teacher Settings' },
  { id: 'hero-path', file: 'teacher/14-hero-path.md', icon: 'fa-hat-wizard', color: 'violet', group: 'The classroom', kicker: 'Hero Path' },
  { id: 'school-office', file: 'secretary/school-office.md', icon: 'fa-building-shield', color: 'emerald', group: 'The rest of the school', kicker: 'School Office' },
  { id: 'family-portal', file: 'parent/family-portal.md', icon: 'fa-house-user', color: 'teal', group: 'The rest of the school', kicker: 'Family Portal' },
  { id: 'glossary', file: 'shared/glossary.md', icon: 'fa-book', color: 'slate', group: 'Lookups', kicker: 'Names that must stay distinct' },
  { id: 'plans', file: 'shared/plans-and-features.md', icon: 'fa-layer-group', color: 'purple', group: 'Lookups', kicker: 'Starter · Pro · Elite' }
];

function copyMedia() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const files = [
    ['assets/guidebook-logo.png', 'guidebook-logo.png'],
    ['assets/dragonflame.webp', 'dragonflame.webp'],
    ['assets/grizzlymight.webp', 'grizzlymight.webp'],
    ['assets/owlwisdom.webp', 'owlwisdom.webp'],
    ['assets/phoenixrising.webp', 'phoenixrising.webp'],
    ['assets/award-clouds/cloud-a.png', 'cloud-a.png'],
    ['assets/award-clouds/cloud-c.png', 'cloud-c.png']
  ];
  for (const [from, to] of files) {
    fs.copyFileSync(path.join(ROOT, from), path.join(MEDIA, to));
  }
}

const LEAGUE_MAP_URL =
  'https://firebasestorage.googleapis.com/v0/b/the-great-class-quest.firebasestorage.app/o/assets%2Fleague_map.png?alt=media&token=d7b28f16-9f88-4f5e-ad98-a9fdb3838f57';

async function copyLeagueMap() {
  const dest = path.join(MEDIA, 'league-map.png');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 8000) return;
  try {
    const res = await fetch(LEAGUE_MAP_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log('Wrote', dest);
  } catch (err) {
    console.warn('League map download skipped:', err.message);
  }
}

function searchBlob(md) {
  return String(md || '')
    .replace(/[#>*`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

const SKIP_ALIAS = new Set(['league', 'glory', 'shop', 'parents', 'heart', 'bestow', 'map', 'dual', 'secretary', 'familiar', 'pathfinder']);

function termButton(id, m) {
  if (id === 'gold') {
    return `<button type="button" class="term term--gold" data-term="gold"><i class="fas fa-coins" aria-hidden="true"></i> ${m}</button>`;
  }
  const ico = TERM_ICONS[id];
  const mark = ico ? `<i class="fas ${ico}" aria-hidden="true"></i> ` : '';
  return `<button type="button" class="term" data-term="${id}">${mark}${m}</button>`;
}

function linkTerms(html) {
  const needles = [];
  for (const term of TERMS) {
    const names = [term.names.en, term.names.el, ...(term.aliases || [])];
    for (const raw of names) {
      const n = String(raw || '').trim();
      if (SKIP_ALIAS.has(n.toLowerCase())) continue;
      const official = n === term.names.en || n === term.names.el;
      if (official && n.length < 4) continue;
      if (!official && n.length < 6) continue;
      needles.push({ n, id: term.id });
    }
  }
  needles.sort((a, b) => b.n.length - a.n.length);
  const skipOpen = /<(code|button|a|script|pre|svg|h1|h2)\b/i;
  const skipClose = /<\/(code|button|a|script|pre|svg|h1|h2)>/i;
  const parts = html.split(/(<[^>]+>)/);
  let skip = 0;
  return parts
    .map((part) => {
      if (part.startsWith('<')) {
        if (skipOpen.test(part) && !/\/\s*>$/.test(part)) skip += 1;
        if (skipClose.test(part)) skip = Math.max(0, skip - 1);
        return part;
      }
      if (skip) return part;
      const held = [];
      let text = part;
      for (const { n, id } of needles) {
        const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
        const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
        text = text.replace(re, (m) => {
          const key = `\u0000${held.length}\u0000`;
          held.push(termButton(id, m));
          return key;
        });
      }
      return text.replace(/\u0000(\d+)\u0000/g, (_, i) => held[Number(i)]);
    })
    .join('');
}

function planBadge(tier, label) {
  return `<span class="plan-badge plan-badge--${tier}">${label}</span>`;
}

function badgePlans(html) {
  if (!html) return html;
  const held = [];
  const keep = (chunk) => {
    held.push(chunk);
    return `\u0001${held.length - 1}\u0001`;
  };
  let t = String(html);
  t = t.replace(/<span class="plan-badge\b[^"]*">[\s\S]*?<\/span>/g, (m) => keep(m));
  t = t.replace(/<(?:button|code|pre|script|svg)[^>]*>[\s\S]*?<\/(?:button|code|pre|script|svg)>/gi, (m) => keep(m));
  t = t.replace(/<img\b[^>]*>/gi, (m) => keep(m));
  t = t.replace(/<strong>(Starter|Pro\+|Elite|Pro)<\/strong>/g, (_, m) => {
    const tier = m.toLowerCase().startsWith('pro') ? 'pro' : m.toLowerCase();
    return keep(planBadge(tier, m));
  });
  t = t.replace(/\(\s*(Starter|Pro\+|Elite|Pro)\.?\s*\)/g, (_, m) => {
    const tier = m.toLowerCase().startsWith('pro') ? 'pro' : m.toLowerCase();
    return keep(planBadge(tier, m.replace(/\.$/, '')));
  });
  t = t.replace(/\bPro\+/g, () => keep(planBadge('pro', 'Pro')));
  t = t.replace(/\bElite\b/g, () => keep(planBadge('elite', 'Elite')));
  t = t.replace(/\bStarter\b/g, () => keep(planBadge('starter', 'Starter')));
  t = t.replace(/\bPro\b(?!digy|gress|ject|tocol|duct|fess|tect|vide|mise|blem|noun|file|mpt)/g, () => keep(planBadge('pro', 'Pro')));
  return t.replace(/\u0001(\d+)\u0001/g, (_, i) => held[Number(i)]);
}

function planChip(label) {
  const ico = PLAN_CHIP_ICONS[label];
  const mark = ico ? `<i class="fas ${ico}" aria-hidden="true"></i> ` : '';
  return `<li>${mark}${escapeHtml(label)}</li>`;
}

function liveHeroBoon() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-heart" aria-hidden="true"></i> Hero's Boon</p>
    <div class="live-row">
      <button type="button" class="boon-btn boon-btn--eligible" data-term="heros-boon" title="Bestow Hero's Boon"><i class="fas fa-heart"></i></button>
      <button type="button" class="boon-btn boon-btn--disabled" data-term="heros-boon" title="Not eligible"><i class="fas fa-heart-broken"></i></button>
    </div>
  </div>`;
}

function liveTeacherBoon() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Teacher Boon</p>
    <button type="button" class="teacher-boon-launch-btn" data-term="teacher-boon" title="Teacher Boon">
      <span class="teacher-boon-launch-btn__glow"></span>
      <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--a">✦</span>
      <i class="fas fa-wand-magic-sparkles teacher-boon-launch-btn__icon"></i>
      <span class="teacher-boon-launch-btn__label">Teacher Boon</span>
    </button>
  </div>`;
}

function capHtml(v) {
  return v === 'Unlimited' ? '<em data-i18n="unlimited">Unlimited</em>' : escapeHtml(v);
}

function planExplorerHtml() {
  const panes = Object.entries(PLAN_EXPLORER)
    .map(
      ([id, p], i) => `<div class="plan-pane" data-plan-pane="${id}" ${i ? 'hidden' : ''}>
        <p class="plan-caps">
          <span><strong data-i18n="planCapTeachers">Teachers</strong> · ${capHtml(p.cap.teachers)}</span>
          <span><strong data-i18n="planCapClasses">Classes</strong> · ${capHtml(p.cap.classes)}</span>
        </p>
        <h4 data-i18n="planOn">On this plan</h4>
        <ul class="plan-chips">${p.has.map((x) => planChip(x)).join('')}</ul>
        ${p.later.length ? `<h4 data-i18n="planLater">Comes later</h4><ul class="plan-chips plan-chips--later">${p.later.map((x) => planChip(x)).join('')}</ul>` : ''}
      </div>`
    )
    .join('');
  return `<div class="plan-explorer" data-plan="starter">
    <div class="plan-switcher">
      <button type="button" class="plan-arrow" data-plan-prev aria-label="Previous plan" data-i18n="planPrev" data-i18n-aria><i class="fas fa-chevron-left"></i></button>
      <div class="plan-tabs" role="tablist">
        <button type="button" class="is-on" data-plan-tab="starter">Starter</button>
        <button type="button" data-plan-tab="pro">Pro</button>
        <button type="button" data-plan-tab="elite">Elite</button>
      </div>
      <button type="button" class="plan-arrow" data-plan-next aria-label="Next plan" data-i18n="planNext" data-i18n-aria><i class="fas fa-chevron-right"></i></button>
    </div>
    ${panes}
  </div>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function prettyLinkText(text, chapter) {
  if (chapter && (text.endsWith('.md') || text.includes('/'))) return chapter.kicker.replace(/^Tab · /, '');
  return text;
}

function inline(raw) {
  let s = escapeHtml(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    let h = href;
    let label = text;
    if (h.endsWith('.md')) {
      const ch = CHAPTERS.find((c) => href.replace(/^\.\.\//, '').endsWith(c.file) || href.endsWith(c.file) || href.includes(c.file));
      h = ch ? `#${ch.id}` : '#';
      label = prettyLinkText(text, ch);
    }
    return `<a href="${h}">${label}</a>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return decorateStarCounts(s);
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line) && line.includes('-');
}

function parsePlanGates(lines) {
  const rows = lines.map((l) =>
    l
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim())
  );
  if (rows.length < 3) return parseTable(lines);
  const head = rows[0].map((c) => c.replace(/\*/g, '').toLowerCase());
  const si = head.findIndex((h) => h.includes('starter'));
  const pi = head.findIndex((h) => h === 'pro' || h.startsWith('pro '));
  const ei = head.findIndex((h) => h.includes('elite'));
  if (si < 0 || pi < 0 || ei < 0) return parseTable(lines);
  const body = rows.slice(2);
  const cell = (idx) =>
    body
      .map((r) => r[idx])
      .filter((c) => c && c !== '—' && c !== '-')
      .map((c) => `<p>${inline(c)}</p>`)
      .join('');
  return `<div class="plan-gates">
    <article class="plan-gate plan-gate--starter"><h4>Starter</h4>${cell(si)}</article>
    <article class="plan-gate plan-gate--pro"><h4>Pro</h4>${cell(pi)}</article>
    <article class="plan-gate plan-gate--elite"><h4>Elite</h4>${cell(ei)}</article>
  </div>`;
}

function parseTable(lines) {
  const rows = lines.map((l) =>
    l
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim())
  );
  if (rows.length < 2) return '';
  const head = rows[0];
  const body = rows.slice(2);
  const th = head.map((c) => `<th>${inline(c || ' ')}</th>`).join('');
  const tr = body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function mdToHtml(md, opts = {}) {
  const planVariant = opts.planVariant || 'teacher';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  let list = null;
  let listHold = false;
  let lastH2 = '';

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ').trim();
    para = [];
    if (!text) return;
    out.push(`<p>${inline(text)}</p>`);
  };
  const flushList = () => {
    if (!list) return;
    if (list.openNest) {
      list.items[list.items.length - 1] += '</ul>';
      list.openNest = false;
    }
    out.push(`<${list.type}>${list.items.map((it) => `<li>${it.includes('<ul>') || it.includes('<br') ? it : inline(it)}</li>`).join('')}</${list.type}>`);
    list = null;
    listHold = false;
  };

  const isOl = (t) => /^\d+\. /.test(t);
  const isUl = (t) => /^[-*] /.test(t);

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      flushList();
      const block = [line];
      i += 1;
      block.push(lines[i]);
      i += 1;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        block.push(lines[i]);
        i += 1;
      }
      out.push(
        /^Plan notes$|^Σημειώσεις πλάνου$/i.test(lastH2.trim())
          ? parsePlanGates(block)
          : parseTable(block)
      );
      continue;
    }

    if (/^#{1,4} /.test(trimmed)) {
      flushPara();
      flushList();
      const level = trimmed.match(/^#+/)[0].length;
      if (level === 1) {
        i += 1;
        continue;
      }
      const text = trimmed.replace(/^#{1,4} /, '');
      const htmlLevel = Math.min(level + 1, 5);
      if (level === 2) lastH2 = text.replace(/\*\*/g, '');
      out.push(`<h${htmlLevel}>${inline(text)}</h${htmlLevel}>`);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushPara();
      flushList();
      out.push('<hr />');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushPara();
      flushList();
      const quotes = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quotes.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<aside class="callout">${inline(quotes.join(' '))}</aside>`);
      continue;
    }

    const nest = line.match(/^ {2,}[-*] (.+)/);
    if (nest && list && list.items.length) {
      flushPara();
      listHold = false;
      const last = list.items.length - 1;
      if (!list.openNest) {
        list.items[last] = `${inline(list.items[last])}<ul>`;
        list.openNest = true;
      }
      list.items[last] += `<li>${inline(nest[1])}</li>`;
      i += 1;
      continue;
    }

    const cont = line.match(/^ {2,}(\S.*)$/);
    if (cont && list && list.items.length && !isUl(trimmed) && !isOl(trimmed)) {
      flushPara();
      listHold = false;
      const last = list.items.length - 1;
      if (list.openNest) {
        list.items[last] += '</ul>';
        list.openNest = false;
      }
      const already = list.items[last].includes('<ul>') || list.items[last].includes('<br');
      list.items[last] = `${already ? list.items[last] : inline(list.items[last])}<br>${inline(cont[1])}`;
      i += 1;
      continue;
    }

    const ul = trimmed.match(/^[-*] (.+)/);
    const ol = trimmed.match(/^\d+\. (.+)/);
    if (ul || ol) {
      flushPara();
      listHold = false;
      const type = ul ? 'ul' : 'ol';
      const item = (ul || ol)[1];
      if (list && list.openNest) {
        list.items[list.items.length - 1] += '</ul>';
        list.openNest = false;
      }
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [], openNest: false };
      }
      list.items.push(item);
      i += 1;
      continue;
    }

    if (!trimmed) {
      flushPara();
      listHold = !!list;
      i += 1;
      continue;
    }

    if (listHold) flushList();
    else flushList();
    para.push(trimmed);
    i += 1;
  }
  flushPara();
  flushList();

  let html = out.join('\n');
  html = html.replace(
    /<h[23]>(?:How this feeds the rest of the Quest|How this feeds the teacher Quest|Πώς ταΐζει το υπόλοιπο Quest)<\/h[23]>([\s\S]*?)(?=<h[23]>|$)/,
    '<div class="feeds">$1</div>'
  );
  html = html.replace(
    /<h[23]>(?:Plan notes|Σημειώσεις πλάνου)<\/h[23]>([\s\S]*?)$/,
    `<div class="plan-notes plan-notes--${planVariant}">$1</div>`
  );
  return html;
}

function uiShot(file, caption, variant = '') {
  const abs = path.join(__dirname, 'media', 'ui', file);
  if (!fs.existsSync(abs)) return '';
  const klass = variant ? `ui-shot ${variant}` : 'ui-shot';
  return `<figure class="${klass}"><img src="media/ui/${file}" alt="${escapeHtml(caption)}" /><figcaption>${decorateStarCounts(escapeHtml(caption))}</figcaption></figure>`;
}

function widgets(id, print = false) {
  if (id === 'why-we-quest') {
    return ethosHtml();
  }
  if (id === 'the-quest') {
    return `
      <div class="panel">
        <h3><i class="fas fa-layer-group" aria-hidden="true"></i> Three interfaces, one school year</h3>
        <div class="ifaces">
          <article class="iface"><h4><i class="fas fa-chalkboard-teacher" aria-hidden="true"></i> Teacher</h4><p>The full Quest on a classroom PC. Depth grows with the plan: <span class="plan-badge plan-badge--starter">Starter</span>, <span class="plan-badge plan-badge--pro">Pro</span>, and <span class="plan-badge plan-badge--elite">Elite</span>.</p></article>
          <article class="iface"><h4><i class="fas fa-building-shield" aria-hidden="true"></i> School Office</h4><p>Secretary. Holidays, school year, school grading defaults, family messages. <span class="plan-badge plan-badge--elite">Elite</span>.</p></article>
          <article class="iface"><h4><i class="fas fa-house-user" aria-hidden="true"></i> Family Portal</h4><p>One login per child. Progress, homework, attendance snapshot, calm messages. <span class="plan-badge plan-badge--pro">Pro</span> and <span class="plan-badge plan-badge--elite">Elite</span>.</p></article>
        </div>
      </div>
      <div class="panel">
        <h3><i class="fas fa-clock" aria-hidden="true"></i> A typical lesson</h3>
        <div class="loop">
          <article class="step"><div class="n">1</div><h4><i class="fas fa-compass" aria-hidden="true"></i> Orient</h4><p>Follow today’s schedule (or pick a class). Projector Mode is a wallpaper you can open any time during the lesson.</p></article>
          <article class="step"><div class="n">2–3</div><h4><i class="fas fa-star" aria-hidden="true"></i> Teach</h4><p>Award Stars for four life skills. Welcome someone back. Quest Assignment and attendance near the end.</p></article>
          <article class="step"><div class="n">4–5</div><h4><i class="fas fa-feather-alt" aria-hidden="true"></i> Close</h4><p>Log Today's Adventure automatically crowns Hero of the Day. On the right week: Quiz, Wheel, or Story Weavers.</p></article>
        </div>
      </div>
      <div class="panel">
        <h3><i class="fas fa-signature" aria-hidden="true"></i> Names that must stay distinct</h3>
        ${namesDistinctHtml()}
      </div>`;
  }
  if (id === 'classroom-chrome') {
    return '';
  }
  if (id === 'home') {
    return '';
  }
  if (id === 'award-stars') {
    return '';
  }
  if (id === 'team-quest') {
    const map = fs.existsSync(path.join(__dirname, 'media', 'league-map.png'))
      ? mapStageHtml()
      : '';
    return `
      ${map}
      <div class="live-demo">
        <p class="live-demo__label"><i class="fas fa-mountain" aria-hidden="true"></i> Quest difficulty (shown as Level 1–6)</p>
        <div class="live-row live-row--levels">
          <span class="lvl l1">🌱 Level 1</span><span class="lvl l2">💧 Level 2</span><span class="lvl l3">🛡️ Level 3</span>
          <span class="lvl l4">🔮 Level 4</span><span class="lvl l5">🔥 Level 5</span><span class="lvl l6">🐉 Level 6</span>
        </div>
      </div>`;
  }
  if (id === 'ceremony') {
    return '';
  }
  if (id === 'heros-challenge') {
    return '';
  }
  if (id === 'market') {
    return '';
  }
  if (id === 'adventure-log') {
    return '';
  }
  if (id === 'scholars-scroll') {
    return '';
  }
  if (id === 'quest-calendar') {
    return '';
  }
  if (id === 'story-weavers') {
    return '';
  }
  if (id === 'settings') {
    return '';
  }
  if (id === 'hero-path') {
    return '';
  }
  if (id === 'school-office') {
    return officeHtml();
  }
  if (id === 'family-portal') {
    return familyPortalHtml();
  }
  if (id === 'glossary') {
    return glossaryRacesHtml();
  }
  if (id === 'guild-hall') {
    return '';
  }
  if (id === 'plans') {
    return print
      ? `
      <div class="plans">
        <article class="plan"><h4>Starter</h4><p>Stars, both monthly races, Market artifacts, bounties, Projector, ceremonies.</p></article>
        <article class="plan"><h4>Pro</h4><p>Guilds, calendar, Scholar's Scroll, manual Adventure Log, Hero Path, Family Access.</p></article>
        <article class="plan elite"><h4>Elite</h4><p>AI chronicler, Story Weavers, Familiars, Quiz of the Week, School Office.</p></article>
      </div>`
      : planExplorerHtml();
  }
  return '';
}

function stripHeadingText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function injectAfterHeadings(html, injections) {
  if (!injections?.length) return html;
  const headingRe = /<h([2-5])>([\s\S]*?)<\/h\1>/gi;
  const headings = [];
  let m;
  while ((m = headingRe.exec(html))) {
    headings.push({ index: m.index, end: m.index + m[0].length, text: stripHeadingText(m[2]) });
  }
  const used = new Set();
  const inserts = [];
  for (const inj of injections) {
    if (!inj?.html) continue;
    const needles = Array.isArray(inj.match) ? inj.match : [inj.match];
    const hit = headings.find((h) => !used.has(h.index) && needles.some((n) => n && h.text.includes(n)));
    if (!hit) continue;
    used.add(hit.index);
    inserts.push({ at: hit.end, html: inj.html });
  }
  inserts.sort((a, b) => b.at - a.at);
  let result = html;
  for (const ins of inserts) {
    result = result.slice(0, ins.at) + ins.html + result.slice(ins.at);
  }
  return result;
}

function headingWidgets(id) {
  const ceremonyShots = `
      <div class="phase-row">
        <article class="phase-card phase-a"><span class="phase-n">1</span><h4><i class="fas fa-route" aria-hidden="true"></i> Team Quest</h4><p>League classes, lowest first, then a League Duel.</p></article>
        <article class="phase-card phase-b"><span class="phase-n">2</span><h4><i class="fas fa-user-graduate" aria-hidden="true"></i> Hero's Challenge</h4><p>This class only. Prodigy of the Month, and Co-Prodigy when the tie is true.</p></article>
      </div>
      ${uiShot('ceremony-intro.png', 'The Ceremony of the Month intro: month title, league and class chips, then Start Ceremony. This is a full-screen ritual — not a small modal.')}
      ${uiShot('ceremony-team-quest.png', 'Phase 1 — Team Quest. Rank cards for classes in the Quest League. YOU marks the class you selected. Chips show difficulty, map zone, Pathfinder, and top virtue.')}
      ${uiShot('ceremony-duel.png', 'League Duel: second versus first, with the VS ring. Drumroll, then the gold and silver ranks.')}
      ${uiShot('ceremony-transition.png', 'The sky turns inward. Begin Hero’s Challenge — now the ritual is about students in this class, not the league.')}
      ${uiShot('ceremony-hero.png', 'Phase 2 — Hero’s Challenge. Student rank cards in the selected class. Finish Ceremony marks this class complete for the month.')}`;
  const fourReasons = `
      ${starAwardBtnsHtml()}
      ${uiShot('award-cloud.png', 'A student cloud on Award Stars: virtue gems and 1, 2, or 3 stars after you pick Teamwork.', 'ui-shot-portrait')}
      <div class="virtues">
        <article class="virtue v-teamwork"><i class="fas fa-users"></i><h4>Teamwork</h4><p>Helping, pairing, listening to a classmate.</p></article>
        <article class="virtue v-creativity"><i class="fas fa-lightbulb"></i><h4>Creativity</h4><p>A new idea, a surprising sentence, playful English.</p></article>
        <article class="virtue v-respect"><i class="fas fa-hands-helping"></i><h4>Respect</h4><p>Kindness, inclusion, care for the room.</p></article>
        <article class="virtue v-focus"><i class="fas fa-brain"></i><h4>Focus</h4><p>Effort, attention, sticking with a hard task.</p></article>
      </div>`;

  if (id === 'the-quest') {
    return [
      { match: ['The ten classroom tabs', 'Οι δέκα καρτέλες'], html: uiShot('nav-dock.png', 'The live bottom dock: ten classroom tabs. Home is the glowing gem; Settings lives in the header cog, not here.') }
    ];
  }
  if (id === 'classroom-chrome') {
    return [
      { match: ['What you see (desktop header)', 'Τι βλέπεις (κεφαλίδα'], html: `<div class="live-strip live-strip--header">${headerToolsHtml()}</div>${classPickerHtml()}${uiShot('header-day.png', 'The classroom header by day: title, daily quote, class picker, Adventurer’s Guide (i), Projector (TV), School Office, Settings, and log out.')}${uiShot('header-night.png', 'The same header after sunset — the sky turns to night for your school’s location.')}` },
      { match: ['Projector Mode'], html: uiShot('projector.png', 'Projector Mode on the classroom PC: living sky, huge digital clock, analogue hands, Junior B badge, bounty countdown, Timekeeper and Quest Progress cards, Wisdom Dock, and the power button to leave.') },
      { match: ['Mobile teacher layout', 'Κινητό'], html: mobileDockHtml() }
    ];
  }
  if (id === 'home') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('home-tab.png', 'Class Home: Good Morning, weather with Quiz of the Week, reminder pills, Team Quest progress, Top Skill, Chronicle, and class actions.') },
      { match: ['Before the lesson', 'Πριν το μάθημα'], html: uiShot('settings-quiz.png', 'Quiz setup in Teacher Settings: class from the header, Mix plus topic chips, then Generate. Ready this week — play it on Home.') },
      { match: ['When it appears', 'Όταν εμφανίζεται'], html: uiShot('quiz-of-the-week.png', 'When the quiz is ready, the question-mark button appears on the Home weather card — first lesson of the week, during lesson time.') },
      { match: ['How play feels', 'Πώς παίζεται'], html: `${uiShot('quiz-play-intro.png', 'The live Quiz of the Week intro: Ready, Quest Heroes? — question count, present students, then Begin the Quiz.')}${uiShot('quiz-play-question.png', 'A question in play: a student is spotlighted, multiple-choice A–D, progress Q 3 / 8, and Skip.')}` }
    ];
  }
  if (id === 'award-stars') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('award-stars-tab.png', 'The Award Stars tab: floating clouds on a sky, Teacher Boon when it is in season, and 1, 2, or 3 stars after a virtue.') },
      { match: ['The four reasons', 'Τέσσερις αρετές'], html: fourReasons },
      { match: ['Welcome Back'], html: welcomeBackHtml() },
      { match: ['Hero’s Boon', "Hero's Boon"], html: `<div class="live-strip">${liveHeroBoon()}</div>` },
      { match: ['Teacher Boon'], html: `<div class="live-strip">${liveTeacherBoon()}</div>` }
    ];
  }
  if (id === 'team-quest') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('team-quest.png', 'Team Quest class cards: stars collected, average per hero, YOU on your class, and the Bronze → Crystal trail.') }
    ];
  }
  if (id === 'heros-challenge') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('heros-challenge.png', "Hero's Challenge: monthly ranks in this class, By Class / Monthly Stars, Hall of Prodigies and Trophy Room.") },
      { match: ['Trophy Room'], html: uiShot('trophy-room.png', 'Trophy Room: a student’s backpack. Use a relic such as Elixir of Luck, or keep a seasonal treasure vaulted.') },
      { match: ['Hall of Prodigies'], html: uiShot('hall-of-prodigies.png', 'Hall of Prodigies: completed months only. Maria is Eternal Prodigy for July — August is still live, so it is not archived yet.') },
      { match: ['Certificates'], html: `${uiShot('certificate-forge.png', 'Forge Certificate: Monthly Quest or Legend’s Journey, then the Oracle weaves the paragraph. Open from the roster or Hero Stats.')}${uiShot('certificate.png', 'The printed certificate: Junior B tone, avatar identity, guild and Hero Class pills, and the praise paragraph.')}` }
    ];
  }
  if (id === 'ceremony') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: ceremonyShots },
      { match: ['Growth Festival (Nursery'], html: `${uiShot('ceremony-growth-intro.png', 'Growth Festival intro: Exit Ceremony and sound in the top bar, Nursery league chip, Growth Festival seedling, Every learner brings a special bloom to our garden, and Enter the Garden.')}${uiShot('ceremony-growth-garden.png', 'Our League Garden: class emblems and progress words, never ranks. Nursery A is revealed last as League Pathfinder. Butterflies drift over the garden. The button is Explore Our Blooms.')}${uiShot('ceremony-growth-bloom.png', 'Parade of Blooms: wreath, avatar, Growing Stronger pill, Bloom 1 of 4 with previous/next chevrons. The button is Next Bloom. No Stars, ranks, or podium.')}${uiShot('ceremony-growth-finale.png', 'Golden Bloom: Maria is Prodigy of the Month. Every blossom in the class family stays on screen. The button is Finish Ceremony.')}` }
    ];
  }
  if (id === 'market') {
    return [
      { match: ['Legendary Artifacts'], html: uiShot('market-legendaries.png', 'Mystic Market — Legendary Artifacts. These relics use the coded emoji icons (not PNG files). Two legendary buys per student per month. Pick a shopper, then buy.') },
      { match: ['Seasonal treasures', 'εποχιακοί θησαυροί'], html: uiShot('market-seasonal.png', 'Seasonal Treasures after Elite Restock. Live months generate new titles and AI pictures; this stall shows the pictured-card layout with sample plates, not a frozen Restock.') },
      { match: ['Familiars'], html: uiShot('market-eggs.png', 'Familiar eggs on the Elite shelf. Buy with Gold, hatch after 20 stars, then evolve at +60 and +140 stars after hatch.') }
    ];
  }
  if (id === 'guild-hall') {
    return [
      { match: ['The four guilds', 'Τα τέσσερα σπίτια'], html: housesHtml() },
      { match: ['Guild Placement', 'Guild Sorting', 'Τοποθέτηση'], html: uiShot('guild-sorting-quiz.png', 'Guild Placement Quiz: seven story-style questions. The pool matches the league — Nursery language is not Proficiency language. Weighted answers assign a house for the year.') },
      { match: ['Glory and Guild Power', 'Glory και Guild Power'], html: uiShot('guild-power.png', 'Guild Power explained: 70% season Glory per member, 15% this week’s Glory per member, 10% activity, 5% momentum. Each piece is 0–100 against the leading house.') },
      { match: ['What you see', 'Τι βλέπεις στην καρτέλα'], html: uiShot('guild-hall.png', 'Guild Hall crystal columns, ranked by Guild Power. Fill, rank, and emblems are the live hall — tap an emblem for lore and the anthem.') },
      { match: ["Fortune’s Wheel", "Fortune's Wheel"], html: uiShot('fortunes-wheel.png', "Fortune's Wheel: last lesson of a Monday–Friday week, once per class. The canvas relic is the live wheel.") },
      { match: ['Fortune Ledger'], html: uiShot('fortune-ledger.png', 'Fortune Ledger: this school year’s collapsible Wheel history on Guild Hall. Last year’s spins stay in last year. Each week lists Glory swings and omens per house.') }
    ];
  }
  if (id === 'adventure-log') {
    return [
      { match: ["Log Today’s Adventure", "Log Today's Adventure"], html: uiShot('adventure-log.png', 'Adventure Log: Quest Assignment and Attendance FABs, then Log Today’s Adventure and Hall of Heroes. Saving the diary crowns Hero of the Day automatically.') },
      { match: ['Hero of the Day'], html: uiShot('hero-of-the-day.png', 'The Hero of the Day celebration after you Log Today’s Adventure. The crown is automatic — you do not pick a name by hand.', 'ui-shot-portrait') },
      { match: ['Hall of Heroes'], html: uiShot('hall-of-heroes.png', 'Hall of Heroes: daily crowns, legend tiers, and seasonal shop discounts — not the Hall of Prodigies.') },
      { match: ['Attendance Chronicle'], html: uiShot('attendance-chronicle.png', 'Attendance Chronicle: month at a glance, summary cards, and a present / absent grid you can tap in the live month.') }
    ];
  }
  if (id === 'scholars-scroll') {
    return [
      { match: ['Log a trial', 'Καταγραφή δοκιμασίας'], html: `${uiShot('trial-type.png', 'Choose Your Challenge: Test or Dictation. This picker appears when you Log New Trial and the class uses both types.')}${uiShot('scroll-bulk.png', 'Bulk mark: the class list, Present / Absent, and grades on one pass. Save All writes the trial.')}` },
      { match: ['Starfall'], html: uiShot('starfall.png', 'Starfall after a bulk save: confirm bonus Scholar’s Bonus stars for outstanding scores. Nothing is forced.') }
    ];
  }
  if (id === 'story-weavers') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('story-weavers.png', 'Story Weavers: Current Chronicle, Word of the Day, and Game Master controls. Lock the word, then continue the tale.') }
    ];
  }
  if (id === 'quest-calendar') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('calendar-month.png', 'Quest Calendar month grid: lesson chips and star totals on teaching days, an amber 2× Star Day banner, and Winter Break holiday cells with the Christmas theme.') },
      { match: ['Day Planner'], html: uiShot('calendar-planner.png', 'Day Planner · Schedule: lessons on this day with Cancel, a class chip to add a one-time lesson, and Mark as School Holiday.') },
      { match: ['Quest Event'], html: `${uiShot('calendar-planner-event.png', 'Day Planner · Quest Event: choose 2× Star Day or Reason Bonus Day as a card, pick classes, then Summon Event.')}${uiShot('calendar-planner-special.png', 'The same Quest Event tab with Vocabulary Vault selected: goal, completion bonus Stars as 0.5–2 chips, instructions, and an optional projector prompt.')}` },
      { match: ['The five Quest shapes', 'Τα πέντε σχήματα'], html: `${uiShot('special-quest-runner.png', 'Special Quest runner: themed Vocabulary Vault banner with a Projector toggle, Active, +1 Stars / +1 Gold per recipient, 7 / 10 vault gems. Add Word Gem fills the vault. Complete Quest stays off until the goal. Recipients come from today’s attendance.')}${uiShot('special-quest-projector.png', 'Class-facing Special Quest preview: badge, title, optional prompt, and the class progress bar. No teacher buttons. Open it from Projector in the runner — not the header TV wallpaper.')}` }
    ];
  }
  if (id === 'settings') {
    return [
      { match: ['Student Tools', 'Εργαλεία μαθητών'], html: uiShot('settings-tools.png', 'Student Tools: Star Manager, Coin Purse, and (on Elite) Familiar Sprite Forge — repair tools, not today’s lesson.') },
      { match: ['My Classes', 'Τα τμήματά μου'], html: uiShot('settings-classes.png', 'My Classes: logo, Quest League, schedule, then Report, Edit, and Manage Students.') },
      { match: ['Profile', 'Προφίλ'], html: uiShot('settings-profile.png', 'Profile: your display name — the Quest Master name on logs.') },
      { match: ['Manage Students', 'Manage Students'], html: uiShot('settings-roster.png', 'Manage Students: avatar, Hero Class, guild mark, and the same classroom buttons — Choose Hero Class (unsorted), Guild Quiz, Skill Tree, Chronicle, Family Access, Forge, certificate, move, edit, delete.') },
      { match: ["Hero’s Chronicle", "Hero's Chronicle"], html: uiShot('settings-chronicle.png', "Hero’s Chronicle: History of Deeds and New Entry. Families never see private notes unless you Publish to Portal.") },
      { match: ['My Planning', 'Ο προγραμματισμός μου'], html: uiShot('settings-planning.png', 'My Planning: the last lesson day for the class in the header. Holidays belong to the Secretary.') },
      { match: ['Class Grading', 'Βαθμολόγηση τμήματος'], html: uiShot('settings-grading.png', 'Class Grading: My classes, Tests or Dictations, then the School picture.') },
      { match: ['Family Access'], html: uiShot('settings-family.png', 'Family Access: one parent username and password per child.') },
      { match: ['Quiz (Elite)', 'Quiz Elite'], html: uiShot('settings-quiz.png', 'Quiz setup: Junior B from the header, Mix plus topic chips, Generate, and a Ready banner. Play it on Home.') }
    ];
  }
  if (id === 'hero-path') {
    return [
      { match: ['How you assign a class', 'Πώς ορίζεις τάξη'], html: uiShot('hero-class.png', 'Hero Class ceremony: Alex previews Guardian; the hall morphs to that vocation. Swear this Path writes the class. First choice is free.') },
      { match: ['The eight classes', 'Οι οκτώ τάξεις'], html: heroClassesHtml() },
      { match: ['Skill Tree on screen', 'Skill Tree στην οθόνη'], html: uiShot('skill-tree.png', 'Skill Tree for a Guardian: Iron Resolve is active; level 2 is pending. The purple sitemap on Manage Students pulses until they pick one permanent branch.') }
    ];
  }
  return [];
}

function navHtml() {
  const groups = [];
  for (const ch of CHAPTERS) {
    let g = groups.find((x) => x.name === ch.group);
    if (!g) {
      g = { name: ch.group, items: [] };
      groups.push(g);
    }
    g.items.push(ch);
  }
  return groups
    .map(
      (g) => {
        const gk = { 'Start here': 'groupStart', 'The classroom': 'groupClass', 'The rest of the school': 'groupSchool', Lookups: 'groupLookups' }[g.name];
        return `<div class="nav-group"><div class="nav-group-title" data-group="${gk}">${g.name}</div>${g.items
        .map(
          (ch) => `<a class="nav-link" href="#${ch.id}" data-chapter="${ch.id}"><span class="gem gem-${ch.color}"><i class="fas ${ch.icon}"></i></span><span data-kicker="${ch.id}">${ch.kicker.replace(/^Tab · /, '')}</span></a>`
        )
        .join('')}</div>`;
      }
    )
    .join('');
}

function chapterHtml(ch, print = false, lang = 'en', withId = false) {
  const src =
    lang === 'el' && EL_CHAPTERS[ch.file]
      ? EL_CHAPTERS[ch.file]
      : fs.readFileSync(path.join(PRODUCT, ch.file), 'utf8');
  const title = (src.match(/^# (.+)$/m) || [, ch.kicker])[1];
  const body = badgePlans(linkTerms(mdToHtml(src, {
    planVariant: ch.file.startsWith('secretary') ? 'office' : ch.file.startsWith('parent') ? 'family' : 'teacher'
  })));
  const gemSize = print
    ? ''
    : ' style="width:2.4rem;height:2.4rem;font-size:1rem;border-radius:0.9rem"';
  const kicker = (KICKERS[ch.id] && KICKERS[ch.id][lang]) || ch.kicker;
  const idAttr = withId ? ` id="${ch.id}"` : '';
  return `
    <article class="chapter"${idAttr}>
      <header class="chapter-head">
        <span class="gem gem-${ch.color}"${gemSize}><i class="fas ${ch.icon}"></i></span>
        <div>
          <p class="kicker"${print ? '' : ` data-kicker="${ch.id}"`}>${escapeHtml(kicker)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </header>
      ${badgePlans(widgets(ch.id, print))}
      <div class="prose">${injectAfterHeadings(body, headingWidgets(ch.id).map((inj) => ({ ...inj, html: badgePlans(inj.html) })))}</div>
    </article>`;
}

function chapterPair(ch) {
  return `<div class="chapter-wrap" id="${ch.id}">
      <div class="chapter-lang" data-lang="en">${chapterHtml(ch, false, 'en')}</div>
      <div class="chapter-lang" data-lang="el" hidden>${chapterHtml(ch, false, 'el')}</div>
    </div>`;
}

function printTocHtml() {
  const groups = [];
  for (const ch of CHAPTERS) {
    let g = groups.find((x) => x.name === ch.group);
    if (!g) {
      g = { name: ch.group, items: [] };
      groups.push(g);
    }
    g.items.push(ch);
  }
  return groups
    .map(
      (g) => `<div class="toc-group"><div class="toc-group-title">${g.name}</div><ol class="toc-list">${g.items
        .map((ch) => `<li>${escapeHtml(ch.kicker.replace(/^Tab · /, ''))}</li>`)
        .join('')}</ol></div>`
    )
    .join('');
}

function printPage(chaptersHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>The Quest Master's Guidebook · The Great Class Quest</title>
  <link rel="icon" type="image/png" href="media/guidebook-logo.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Fredoka+One&family=Open+Sans:wght@400;600;700&family=Lora:ital@0;1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
  <link rel="stylesheet" href="print.css" />
</head>
<body class="print-book">
  <header class="print-cover">
    <img class="cover-cloud c1" src="media/cloud-a.png" alt="" />
    <img class="cover-cloud c2" src="media/cloud-c.png" alt="" />
    <img class="cover-cloud c3" src="media/cloud-a.png" alt="" />
    <div class="print-cover-inner">
      <img class="print-cover-logo" src="media/guidebook-logo.png" alt="" />
      <span class="eyebrow">The Great Class Quest</span>
      <h1>The Quest Master's Guidebook</h1>
        <p class="lede">Start with the classroom philosophy, then the map of every tab, ritual, economy rule, and ceremony — written for practising English-school teachers, with shorter chapters for the School Office and families.</p>
    </div>
  </header>
  <nav class="print-toc">
    <h1>Contents</h1>
    ${printTocHtml()}
  </nav>
  ${chaptersHtml}
</body>
</html>`;
}

function page(chaptersHtml, payload) {
  return `<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Quest Master's Guidebook · The Great Class Quest</title>
  <link rel="icon" type="image/png" href="media/guidebook-logo.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Fredoka+One&family=Open+Sans:wght@400;600;700&family=Lora:ital@0;1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
  <link rel="stylesheet" href="guidebook.css" />
</head>
<body>
  <a class="skip" href="#cover" data-i18n="skip">Skip to guidebook</a>
  <button class="menu-btn" type="button" id="menu-btn"><i class="fas fa-bars"></i> <span data-i18n="chapters">Chapters</span></button>
  <aside class="rail" id="rail">
    <div class="rail-brand">
      <img src="media/guidebook-logo.png" alt="The Great Class Quest Guidebook logo" />
      <div>
        <h1>The Quest Master's Guidebook</h1>
        <p data-i18n="brandSub">Teacher-first handbook</p>
      </div>
    </div>
    <div class="lang-switch" role="group" aria-label="Language">
      <button type="button" class="lang-btn is-on" data-lang="en">EN</button>
      <button type="button" class="lang-btn" data-lang="el">ΕΛ</button>
    </div>
    <input class="search" id="search" type="search" data-i18n="search" data-i18n-placeholder placeholder="Find a tab, ritual, or name…" />
    <p class="search-hint" data-i18n="searchHint">Try “guild ceremony”, “Teacher Boon”, or “holidays”.</p>
    <div id="search-panel" class="search-panel" hidden></div>
    <nav id="toc">${navHtml()}</nav>
    <div class="rail-foot">
      <strong data-i18n="howTo">How to read this book.</strong> <span data-i18n="howToBody" data-i18n-html>Start with Philosophy, then Orientation. Coloured plan badges mark Starter, Pro, and Elite. Tap a dotted name for a short explanation — you do not need to read in order.</span>
    </div>
  </aside>
  <div class="book">
    <header class="cover" id="cover">
      <img class="cover-cloud c1" src="media/cloud-a.png" alt="" />
      <img class="cover-cloud c2" src="media/cloud-c.png" alt="" />
      <img class="cover-cloud c3" src="media/cloud-a.png" alt="" />
      <div class="cover-inner">
        <img class="cover-logo" src="media/guidebook-logo.png" alt="" />
        <span class="eyebrow" data-i18n="coverEyebrow">The Great Class Quest</span>
        <h2 data-i18n="coverTitle">The Quest Master's Guidebook</h2>
        <p class="lede" data-i18n="coverLede">Start with the classroom philosophy, then the map of every tab, ritual, economy rule, and ceremony — written for practising English-school teachers, with shorter chapters for the School Office and families.</p>
      </div>
    </header>
    ${chaptersHtml}
  </div>
  <div id="term-modal" class="term-modal" aria-hidden="true">
    <div class="term-card" role="dialog" aria-modal="true" aria-labelledby="term-modal-title">
      <button type="button" class="term-x" data-term-close id="term-modal-close" aria-label="Close">&times;</button>
      <h3 id="term-modal-title"></h3>
      <p id="term-modal-def"></p>
      <div id="term-modal-looks" class="term-looks"><strong data-i18n="termLooks">Looks like this in the classroom</strong><div class="term-widget"></div></div>
      <a id="term-modal-more" class="term-more" href="#"><span data-i18n="termMore">Open the full chapter</span></a>
    </div>
  </div>
  <script>window.GCQ_GUIDE = ${payload};</script>
  <script src="guidebook.js"></script>
</body>
</html>`;
}

function buildPayload() {
  const chapters = CHAPTERS.map((ch) => {
    const en = fs.readFileSync(path.join(PRODUCT, ch.file), 'utf8');
    const el = EL_CHAPTERS[ch.file] || '';
    const titleEn = (en.match(/^# (.+)$/m) || [, ch.kicker])[1];
    const titleEl = (el.match(/^# (.+)$/m) || [, titleEn])[1];
    return {
      id: ch.id,
      titleEn,
      titleEl,
      textEn: searchBlob(en),
      textEl: searchBlob(el)
    };
  });
  return JSON.stringify({
    terms: TERMS,
    termIcons: TERM_ICONS,
    ui: UI,
    kickers: KICKERS,
    search: CHAPTER_SEARCH,
    chapters
  });
}

copyMedia();
await copyLeagueMap();
const chaptersHtml = CHAPTERS.map(chapterPair).join('\n');
const printChaptersHtml = CHAPTERS.map((ch) => chapterHtml(ch, true, 'en', true)).join('\n');
fs.writeFileSync(path.join(__dirname, 'index.html'), page(chaptersHtml, buildPayload()), 'utf8');
fs.writeFileSync(path.join(__dirname, 'print.html'), printPage(printChaptersHtml), 'utf8');
console.log('Wrote', path.join(__dirname, 'index.html'));
console.log('Wrote', path.join(__dirname, 'print.html'));

