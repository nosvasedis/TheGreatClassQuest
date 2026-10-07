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
  { id: 'hero-campfire', file: 'teacher/15-hero-campfire.md', icon: 'fa-fire', color: 'amber', group: 'The classroom', kicker: 'Hero Campfire' },
  { id: 'quest-remote', file: 'teacher/16-quest-remote.md', icon: 'fa-wand-magic-sparkles', color: 'purple', group: 'The classroom', kicker: 'Quest Remote' },
  { id: 'scholars-scroll', file: 'teacher/10-scholars-scroll.md', icon: 'fa-scroll', color: 'pink', group: 'The classroom', kicker: "Tab · Scholar's Scroll" },
  { id: 'quest-calendar', file: 'teacher/11-quest-calendar.md', icon: 'fa-calendar-alt', color: 'blue', group: 'The classroom', kicker: 'Tab · Quest Calendar' },
  { id: 'story-weavers', file: 'teacher/12-story-weavers.md', icon: 'fa-bullseye', color: 'indigo', group: 'The classroom', kicker: 'Tab · Training Grounds' },
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
    <div class="live-row live-row--award">
      <button type="button" class="boon-btn aw-boon aw-boon--ready" data-term="heros-boon" title="Hero's Boon: a classmate gifts +½ star"><span class="aw-boon__heart" aria-hidden="true"><i class="fas fa-heart"></i></span><span class="aw-boon__tag" aria-hidden="true">+½</span></button>
      <button type="button" class="boon-btn aw-boon aw-boon--resting" data-term="heros-boon" title="Not eligible for a Hero's Boon right now" aria-disabled="true"><span class="aw-boon__heart" aria-hidden="true"><i class="fas fa-heart"></i></span></button>
    </div>
  </div>`;
}

function liveTeacherBoon() {
  return `<div class="live-demo">
    <p class="live-demo__label"><i class="fas fa-gift" aria-hidden="true"></i> Teacher Boon</p>
    <button type="button" class="teacher-boon-launch-btn" data-term="teacher-boon" title="Teacher Boon">
      <span class="teacher-boon-launch-btn__glow" aria-hidden="true"></span>
      <span class="teacher-boon-launch-btn__halo" aria-hidden="true"></span>
      <span class="teacher-boon-launch-btn__body">
        <span class="teacher-boon-launch-btn__shimmer" aria-hidden="true"></span>
        <span class="teacher-boon-launch-btn__seal" aria-hidden="true">
          <span class="teacher-boon-launch-btn__orbit"><i>✦</i><i>✦</i></span>
          <span class="teacher-boon-launch-btn__seal-core"><i class="fas fa-gift teacher-boon-launch-btn__icon"></i></span>
        </span>
        <span class="teacher-boon-launch-btn__text">
          <span class="teacher-boon-launch-btn__kicker">Month's end gift</span>
          <span class="teacher-boon-launch-btn__label">Teacher Boon</span>
        </span>
        <span class="teacher-boon-launch-btn__gift">+2 <i class="fas fa-star"></i></span>
      </span>
      <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--a" aria-hidden="true">✦</span>
      <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--b" aria-hidden="true">✧</span>
      <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--c" aria-hidden="true">✦</span>
      <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--d" aria-hidden="true">✧</span>
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
          <article class="iface"><h4><i class="fas fa-building-shield" aria-hidden="true"></i> School Office</h4><p>Secretary. Students &amp; Classes, former students, holidays, school year, grading defaults, family messages. <span class="plan-badge plan-badge--elite">Elite</span>.</p></article>
          <article class="iface"><h4><i class="fas fa-house-user" aria-hidden="true"></i> Family Portal</h4><p>One login per child, made for phones. The week at a glance, homework and tests, progress, messages with the school. <span class="plan-badge plan-badge--pro">Pro</span> and <span class="plan-badge plan-badge--elite">Elite</span>.</p></article>
        </div>
      </div>
      <div class="panel">
        <h3><i class="fas fa-clock" aria-hidden="true"></i> A typical lesson</h3>
        <div class="loop">
          <article class="step"><div class="n">1</div><h4><i class="fas fa-compass" aria-hidden="true"></i> Orient</h4><p>Follow today’s schedule (or pick a class). Projector Mode is a wallpaper you can open any time during the lesson.</p></article>
          <article class="step"><div class="n">2–3</div><h4><i class="fas fa-star" aria-hidden="true"></i> Teach</h4><p>Award Stars for four life skills. Welcome someone back. Quest Assignment and attendance near the end.</p></article>
          <article class="step"><div class="n">4–5</div><h4><i class="fas fa-feather-alt" aria-hidden="true"></i> Close</h4><p>Crown Today's Hero picks the Hero of the Day for you, then you write the diary page. On the right week: Quiz, Wheel, or Story Weavers.</p></article>
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
  if (id === 'hero-campfire') {
    return '';
  }
  if (id === 'quest-remote') {
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
        <article class="plan elite"><h4>Elite</h4><p>AI chronicler, Training Grounds, Familiars, Quiz of the Week, School Office.</p></article>
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
      ${uiShot('ceremony-intro.png', 'Classic Arena intro: a gold shield with the class emblem in a laurel, the month, league and class chips, and the route Team Quest → Hero’s Challenge. Start Ceremony opens the arena.')}
      ${uiShot('ceremony-team-quest.png', 'Team Quest: each place arrives as a sealed card that cracks open. Bronze place here, with the quest-goal trail and chips for difficulty, map zone, stars per hero and top virtue.')}
      ${uiShot('ceremony-duel.png', 'League Duel after the drumroll: the champion is crowned on the gold step, second place takes silver. Your class wears its tag.')}
      ${uiShot('ceremony-transition.png', 'The torches turn violet: Begin Hero’s Challenge. Now the ritual is about students in this class, not the league.')}
      ${uiShot('ceremony-hero.png', 'Hero Duel: Maria is crowned Prodigy of the Month, Alex takes silver. Two crowns appear when the tie is true.')}
      ${uiShot('ceremony-standings.png', 'Final Standings: the Roll of Honour with every hero’s monthly stars and strengths. The gift marks a Teacher Boon. Finish Ceremony closes the month.')}`;
  const fourReasons = `
      ${starAwardBtnsHtml()}
      ${uiShot('award-cloud.png', 'A student cloud: portrait, Gold purse, Hero Path ribbon, the Sun, Moon and Star tallies, the virtue gems, and Spark, Shine and Supernova after you pick Teamwork.', 'ui-shot-portrait')}
      <div class="virtues">
        <article class="virtue v-teamwork"><i class="fas fa-users"></i><h4>Teamwork</h4><p>Helping, pairing, listening to a classmate.</p></article>
        <article class="virtue v-creativity"><i class="fas fa-lightbulb"></i><h4>Creativity</h4><p>A new idea, a surprising sentence, playful English.</p></article>
        <article class="virtue v-respect"><i class="fas fa-hands-helping"></i><h4>Respect</h4><p>Kindness, inclusion, care for the room.</p></article>
        <article class="virtue v-focus"><i class="fas fa-brain"></i><h4>Focus</h4><p>Effort, attention, sticking with a hard task.</p></article>
      </div>`;

  if (id === 'the-quest') {
    return [
      { match: ['The ten classroom tabs', 'Οι δέκα καρτέλες'], html: uiShot('nav-dock.png', 'The cloud dock: the ten classroom tabs as a bank of clouds along the bottom edge. Home is the first cloud; Settings lives in the header cog, not here.') }
    ];
  }
  if (id === 'classroom-chrome') {
    return [
      { match: ['What you see (desktop header)', 'Τι βλέπεις (κεφαλίδα'], html: `<div class="live-strip live-strip--header">${headerToolsHtml()}</div>${classPickerHtml()}${uiShot('header-day.png', 'The classroom header by day: title, daily quote, class picker, Adventurer’s Guide (i), Projector (TV), School Office, Settings, and log out.')}${uiShot('header-night.png', 'The same header after sunset — the sky turns to night for your school’s location.')}` },
      { match: ['The Adventurer’s Guide (i)'], html: uiShot('adventurers-guide.png', 'The Adventurer’s Guide on an Elite school: the green cloth cover with the brass compass and plan tag, Quest Master and For the class, the search box, the chapter tabs, and The three races open with a Take me there on every field note.') },
      { match: ['The cloud dock', 'Το cloud dock'], html: uiShot('nav-dock.png', 'The cloud dock awake: the active tab’s cloud glows and shows its name. On a mouse PC the dock sinks away when idle and floats back at the bottom edge.') },
      { match: ['Projector Mode'], html: uiShot('projector.png', 'Projector Mode on the classroom PC: living sky over the realm’s hills, the day arc and huge digital clock, the lesson ring on the analogue dial (“Lesson ends in 45 min”), the Junior B banner, a bounty countdown, two Sky Cards (Sky Watch “Tonight’s constellation” and a Mind & Heart “Would you rather…”), the wisdom ribbon, and the projector remote.') },
      { match: ['Mobile teacher layout', 'Κινητό'], html: mobileDockHtml() }
    ];
  }
  if (id === 'home') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('home-tab.png', 'Class Home: the greeting for the time of day, the Bounty button, weather with Quiz of the Week, reminder pills, the Quest Progress road, the class virtue and class photo, Chronicle, and class actions.') },
      { match: ['Before the lesson', 'Πριν το μάθημα'], html: uiShot('settings-quiz.png', 'Quiz setup in Teacher Settings: class from the header, this week’s unit and words, then Generate. Ready this week — play it on Home.') },
      { match: ['When it appears', 'Όταν εμφανίζεται'], html: uiShot('quiz-of-the-week.png', 'When the quiz is ready, a lit Quiz of the Week ticket appears on the Home weather card: first lesson of the week, during lesson time. After the show it reads See the results.') },
      { match: ['How play feels', 'Πώς παίζεται'], html: `${uiShot('quiz-play-intro.png', 'The quiz stage opens: the questions, the heroes on stage today, the three rules, then Raise the curtain.')}${uiShot('quiz-play-question.png', 'A question in play: the spotlight has passed it to Sofia, the answer already tried is crossed out, and the lights at the top show how each question went.')}${uiShot('quiz-play-results.png', 'The curtain call: the tier medal, first-try accuracy, stars and Team Quest bonus, the stars of the show, Glory for the guilds, any treasure, and a recap of every question.')}` },
      { match: ['Posting a Quest Bounty', 'Quest Bounty'], html: `${uiShot('bounty-poster.png', 'The bounty poster, Star Hunt: pick the quest, the star target (Quick win, Fair fight or Heroic) and the reward. The line at the bottom reads the whole bounty back before you pin it.')}${uiShot('bounty-poster-timer.png', 'Race the Clock: choose 5 to 30 minutes, your own minutes, or Until the bell, and see the time the sand runs out.')}` }
    ];
  }
  if (id === 'award-stars') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('award-stars-tab.png', 'The Award Stars tab: the star-medal title, the rose-gold Teacher Boon seal (last 7 days of the month only), the sky summary, and the student clouds. Alex and Maria are sealed for today; Maria is Hero of the Day on the gold cloud; Nikos has picked Respect; Eleni is last month’s Prodigy of the Month on the mint cloud.') },
      { match: ['The four reasons', 'Τέσσερις αρετές'], html: fourReasons },
      { match: ['Welcome Back'], html: welcomeBackHtml() },
      { match: ['Hero’s Boon', "Hero's Boon"], html: `<div class="live-strip">${liveHeroBoon()}</div>` },
      { match: ['Teacher Boon'], html: `<div class="live-strip">${liveTeacherBoon()}</div>${uiShot('teacher-boon-modal.png', 'The Teacher Boon in three steps: Hero, Reason, Bestow. Two stars, once per class, in the last week of the month.')}` }
    ];
  }
  if (id === 'team-quest') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('team-quest.png', 'Team Quest class cards: stars collected, average per hero, YOU on your class, and the Bronze → Crystal trail.') }
    ];
  }
  if (id === 'heros-challenge') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('heros-challenge.png', "Hero's Challenge: the Quest League bar with By Class / Monthly Stars, a gold, silver and bronze podium for each class, ranked rows below with each hero's gap to the one above, Hall of Prodigies and Trophy Room.") },
      { match: ['Trophy Room'], html: uiShot('trophy-room.png', 'Trophy Room: a student’s backpack. Use a relic such as Elixir of Luck, or keep a seasonal treasure vaulted.') },
      { match: ['Hall of Prodigies'], html: uiShot('hall-of-prodigies.png', 'Hall of Prodigies: a marble hall under the rose window. Maria is Prodigy of the Month for July, crowned 3× this year. The coins along the bottom show every month’s Prodigy; August is still being earned, so it is not in the hall yet.') },
      { match: ['Certificates'], html: `${uiShot('certificate-forge.png', 'Hero Certificate: Monthly Quest or Legend’s Journey ribbons, a live preview, Honours on the page, and the Oracle’s citation (Elite). Open it from Certificate on Manage Students.')}${uiShot('certificate.png', 'The printed certificate: an illuminated A4 landscape page in guild colours, wax seal, hero portrait, guild shield, honours and the Oracle’s citation.')}` }
    ];
  }
  if (id === 'ceremony') {
    return [
      { match: ['Classic Arena'], html: ceremonyShots },
      { match: ['Growth Festival garden', 'κήπος του Growth Festival'], html: `${uiShot('ceremony-growth-intro.png', 'Growth Festival garden gate: a rose arch with the class emblem and the month. Enter the Garden opens the doors.')}${uiShot('ceremony-growth-garden.png', 'Our League Garden: one flower pot per class with gentle progress words and its strength as a bloom, never ranks. The class that led the month grows last in golden light as League Pathfinder.')}${uiShot('ceremony-growth-bloom.png', 'Parade of Blooms: a seed grows into Mia’s flower and her seed-packet card tells her story. Bloom 4 of 10 with chevrons; each child already shown is planted in the bed below. No Stars, ranks or podium.')}${uiShot('ceremony-growth-finale.png', 'The Golden Bloom: Mia is Prodigy of the Month, and every learner’s flower stands in the class garden. The button is Finish Ceremony.')}` }
    ];
  }
  if (id === 'market') {
    return [
      { match: ['Legendary Artifacts'], html: uiShot('market-legendaries.png', 'Mystic Market — Legendary Artifacts. Two legendary buys per student per month. Pick a shopper, then buy.') },
      { match: ['Seasonal treasures', 'εποχιακοί θησαυροί'], html: uiShot('market-seasonal.png', 'Seasonal Treasures after an Elite Restock. Each month brings new treasures with AI-made pictures; this shows how the pictured cards look.') },
      { match: ['Familiars'], html: uiShot('market-eggs.png', 'Familiar eggs on the Elite shelf. Buy with Gold, hatch after 20 stars, then evolve at +60 and +140 stars after hatch.') }
    ];
  }
  if (id === 'guild-hall') {
    return [
      { match: ['The four guilds', 'Τα τέσσερα σπίτια'], html: `${housesHtml()}${uiShot('guild-banner.png', 'Tap a guild’s emblem and its banner unfurls: crest, motto, traits, Crowns, this Chapter’s Glory and the Unity Seal.')}${uiShot('guild-anthem.png', 'The music-note button sings the guild’s anthem in a torch-lit alcove, verse by verse.')}` },
      { match: ['Guild Placement', 'Guild Sorting', 'Τοποθέτηση'], html: uiShot('guild-sorting-quiz.png', 'Guild Sorting Ceremony: seven story-style questions, one tap each, while the orb takes on the colours the answers lean toward. The questions match the league — Pre-Junior language is not D language. The answers decide a house for life.') },
      { match: ['Glory and the Crown Race', 'Glory και Crown Race'], html: uiShot('guild-power.png', 'How the Crown Race works: every month is a Chapter won on Glory per member, Chapters pay Crowns, the Unity Seal adds one more, and most Crowns in June wins the year.') },
      { match: ['What you see', 'Τι βλέπεις στην καρτέλα'], html: uiShot('guild-hall.png', 'Guild Hall: this month’s Chapter in the top bar, four guild banners whose vials fill with this Chapter’s Glory per member, and the Crown Race board below. Tap a crest to unfurl the guild’s banner; the music-note button plays the anthem.') },
      { match: ["Fortune’s Wheel", "Fortune's Wheel"], html: uiShot('fortunes-wheel.png', "Fortune’s Wheel, the celestial Wheel of Fate: each guild takes its turn on its own 20-wedge wheel. Last lesson of a Monday–Friday week, once per class.") },
      { match: ['Fortune Ledger'], html: uiShot('fortune-ledger.png', 'Fortune Ledger: this school year’s Wheel book on Guild Hall, with a treasure count per guild and one page of fortune cards per spin. Last year’s spins stay in last year.') },
      { match: ['Grand Guild Ceremony'], html: `${uiShot('grand-ceremony-opening.png', 'Grand Guild Ceremony: a midsummer festival under the guild castle, with the four crests, the school year and the classes taking part.')}${uiShot('grand-ceremony-prodigies.png', 'Chapter III, The Crown Road: every finished month with its Prodigy of the Month, and the Most crowned plaque.')}${uiShot('grand-ceremony-crowning.png', 'Chapter V, The Guild Crowning: pillars revealed from last place up, then the drumroll crowns the guild with the most Crowns.')}${uiShot('grand-ceremony-champion.png', 'The champion guild: crest, motto and anthem, with the lyrics lighting up as it plays, and the heroes leading it in your classes.')}` }
    ];
  }
  if (id === 'adventure-log') {
    return [
      { match: ['Crown Today’s Hero, then write', 'Crown Today’s Hero και μετά', 'Log Today’s Adventure', "Log Today's Adventure"], html: uiShot('adventure-log.png', 'Adventure Log as the class diary: month tabs and This month in the diary on the desk, Crown Today’s Hero, Hall of Heroes and Ember Oaths, then today’s diary page. Quest Assignment and Attendance sit in the corners. Pressing Crown Today’s Hero chooses the Hero of the Day automatically.') },
      { match: ['Hero of the Day'], html: uiShot('hero-of-the-day.png', 'The Hero of the Day celebration after you press Crown Today’s Hero. The crown is automatic — you do not pick a name by hand.', 'ui-shot-portrait') },
      { match: ['Gather at the Campfire'], html: uiShot('campfire-entry.png', 'After you close Huzzah!, Gather at the Campfire lights up under the diary buttons. Optional: Not today hides it until the next lesson.') },
      { match: ['Hall of Heroes'], html: uiShot('hall-of-heroes.png', 'Hall of Heroes: a portrait gallery of this year’s Hero of the Day crowns — plaques, the top three in large frames, legend ranks with their Market discount, and who is still waiting for a first crown. Not the Hall of Prodigies.') },
      { match: ['Attendance Chronicle'], html: uiShot('attendance-chronicle.png', 'Attendance Chronicle: the class register — month at a glance, summary, and tick / cross marks you can tap in the live month.') }
    ];
  }
  if (id === 'scholars-scroll') {
    return [
      { match: ['Log a trial', 'Καταγραφή δοκιμασίας'], html: `${uiShot('scroll-bulk.png', 'Log New Trial opens the marking board. Dictation and Test are tabs on the sheet when the class uses both. Tap a stamp to grade, tap Present to mark someone absent; the tally shows who is still unmarked.')}${uiShot('scroll-bulk-test.png', 'A numeric test: type each score and press Enter to jump to the next student. Save results writes the trial.')}` },
      { match: ['Starfall'], html: uiShot('starfall.png', 'Starfall after a bulk save: confirm bonus Scholar’s Bonus stars for outstanding scores. Nothing is forced.') }
    ];
  }
  if (id === 'story-weavers') {
    return [
      { match: ['What you see', 'Τι βλέπεις'], html: uiShot('story-weavers.png', 'Story Weavers, the Creativity game of the Training Grounds: Current Chronicle, Word of the Day, and Game Master controls. Lock the word, then continue the tale.') }
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
      { match: ['My Classes', 'Τα τμήματά μου'], html: `${uiShot('settings-classes.png', 'My Classes: each class card shows its emblem, Quest League, days and times, then Report, Edit, Students, Oaths, and the trash can last. Add New Class opens the class charter.')}${uiShot('class-charter.png', 'Add New Class is a class charter: name, emblem, Quest League, meeting days and times, then Create Class.')}${uiShot('class-emblem-case.png', 'Tap the emblem to open the emblem case: search or browse hundreds of class logos by drawer.')}` },
      { match: ['Profile', 'Προφίλ'], html: uiShot('settings-profile.png', 'Profile: your display name, the Quest Master name on logs. The staff badge shows it as you type.') },
      { match: ['Manage Students', 'Manage Students'], html: uiShot('settings-roster.png', 'Manage Students: avatar, name, Hero Class and guild chip, then the same tools on every row in three groups: Hero path (Sort, Class, Skills), Records (Chronicle, Parents, Avatar, Certificate) and Manage (Move, Edit, Delete).') },
      { match: ["Hero’s Chronicle", "Hero's Chronicle"], html: uiShot('settings-chronicle.png', "Hero’s Chronicle: the hero’s bound book. Notes holds the History of Deeds and Write an entry; Oaths and The Oracle are the other page tabs. Only an Oracle summary you Publish to Parent Portal reaches families.") },
      { match: ['My Planning', 'Ο προγραμματισμός μου'], html: uiShot('settings-planning.png', 'My Planning: the last lesson day for the class in the header, shown on a tear-off calendar leaf. Holidays belong to the Secretary.') },
      { match: ['Class Grading', 'Βαθμολόγηση τμήματος'], html: uiShot('settings-grading.png', 'Class Grading: My classes, Tests or Dictations, then the School picture.') },
      { match: ['Family Access'], html: uiShot('settings-family.png', 'Family Access: pick a student; the key tag shows whether a parent login exists. One username and password per child.') },
      { match: ['Adventurer’s Passport', "Adventurer's Passport"], html: uiShot('adventurers-passport.png', 'The Adventurer’s Passport from Edit on the roster: portrait and identity, quest record, Birthday and Nameday stamps, the Hero path visa, and shortcuts to Chronicle, Certificate, Avatar Forge and more.') },
      { match: ['Avatar Forge'], html: uiShot('avatar-forge.png', 'The Avatar Forge (Elite): choose the creature, the colour and the relic, then Strike the Anvil and keep the portrait you like.') },
      { match: ['Quiz (Elite)', 'Quiz Elite'], html: uiShot('settings-quiz.png', 'Quiz setup: Junior B from the header, this week’s Primary Path unit and words, Generate, and a Ready banner. Play it on Home.') }
    ];
  }
  if (id === 'hero-path') {
    return [
      { match: ['How you assign a class', 'Πώς ορίζεις τάξη'], html: uiShot('hero-class.png', 'Hero Class ceremony: Alex previews Guardian; the hall morphs to that vocation. Swear this Path writes the class. First choice is free.') },
      { match: ['The eight classes', 'Οι οκτώ τάξεις'], html: heroClassesHtml() },
      { match: ['Skill Tree on screen', 'Skill Tree στην οθόνη'], html: uiShot('skill-tree.png', 'Skill Tree for a Guardian: Iron Resolve is active; level 2 is pending. The Skills button on Manage Students pulses until they pick one permanent branch.') }
    ];
  }
  if (id === 'school-office') {
    return [
      { match: ['Home — the front desk', 'Home — η υποδοχή'], html: uiShot('office-home.png', 'The front desk: the school’s counts, what is waiting on you today, the latest grade and message, the office drawers, and the former students on file.') },
      { match: ['Admin → Students & Classes'], html: uiShot('office-registry.png', 'Students & Classes as one path: open a class, then enrol students into it. Each class drawer has its own Enrol, and students waiting for a class come first.') }
    ];
  }
  if (id === 'quest-remote') {
    return [
      { match: ['Waking the Wand', 'Ξυπνώντας το Ραβδί'], html: uiShot('quest-remote-bind.png', 'The rune circle on the projector. Scan it with your phone’s camera; the four runes underneath are for phones without a camera.') },
      { match: ['The four modes on your phone', 'Οι τέσσερις λειτουργίες στο κινητό'], html: `<div class="ui-shot-row">${uiShot('wand-stars.png', 'Stars: the class as hero orbs. Gold rings shine today; the moon marks a hero who is away.', 'ui-shot-portrait')}${uiShot('wand-award.png', 'Choose the virtue, then flick the star up to the screen. Faster flick, more stars.', 'ui-shot-portrait')}${uiShot('wand-stage.png', 'Stage: the buttons of whatever is on the projector, plus Back, scrolling and Cast a screen.', 'ui-shot-portrait')}${uiShot('wand-magic.png', 'Magic: hold the crown, the wheel lever, the Fair Picker, timers and Eyes on me.', 'ui-shot-portrait')}</div>${uiShot('quest-remote-timer.png', 'A timer started from the phone: an ember ring in the corner of the projector.')}` },
      { match: ['Showdown Arena'], html: `${uiShot('quest-remote-showdown.png', 'The Showdown Arena on the projector: bars leap when you give a point, a flame shows a streak, and the clock counts down.')}${uiShot('wand-show.png', 'The same Showdown on your phone: one big button per team.', 'ui-shot-portrait')}` }
    ];
  }
  if (id === 'hero-campfire') {
    return [
      { match: ['When it appears', 'Όταν εμφανίζεται'], html: uiShot('campfire-entry.png', 'Gather at the Campfire on Adventure Log after Hero of the Day. The hearth spans the row; Oaths stays beside it. Not today hides it until tomorrow.') },
      { match: ['What the class sees', 'Τι βλέπει η τάξη'], html: `${uiShot('campfire-words.png', 'Word Embers: the practised words sit around the fire. Tap one when the class has used it — it flies into the hearth. No book codes or page numbers appear on the projector.')}${uiShot('campfire-scene.png', 'The Oath Circle: three or four children sit with their promise. Tap 🔥 / 🕯️ / 🌙 under each child. The Hero of the Day wears the crown.')}` },
      { match: ['Ember Oaths'], html: uiShot('ember-oaths.png', 'The Oath Board: one card per child, glowing embers for progress, today’s check-in, and Ready to keep. Choosing ceremony is one tap per child.') }
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

