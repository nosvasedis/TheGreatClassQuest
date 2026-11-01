/**
 * Markup for the "Your Year of Quest" chapter: the road of stages, the strip of dated moments and the
 * "when it happens" cards. Data: year-journey.mjs. Behaviour (start month, plan filter, "you are here",
 * links into a chapter's section): guidebook.js#bindYearJourney. Print gets the same road without controls.
 */
import { YEAR_STAGES, YEAR_MOMENTS, YEAR_TRIGGERS, YEAR_PLAN_ORDER } from './year-journey.mjs';

export const SCHOOL_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

export const MONTH_NAMES = {
  en: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  el: ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
};

const WORDS = {
  en: {
    started: 'We started in',
    plan: 'Our plan',
    all: 'All plans',
    here: 'You are here',
    read: 'Read',
    locked: 'Not on your plan',
    restOnPlan: 'Nothing new on your plan here. Keep your rhythm.',
    nextYear: 'next school year',
    road: 'The road of the year',
    hint: 'Choose the month your classes started the Quest and your plan. The months and the “You are here” mark follow.',
    printNote: 'Months shown for a September start.'
  },
  el: {
    started: 'Ξεκινήσαμε τον',
    plan: 'Το πλάνο μας',
    all: 'Όλα τα πλάνα',
    here: 'Είσαι εδώ',
    read: 'Διάβασε',
    locked: 'Δεν είναι στο πλάνο σου',
    restOnPlan: 'Τίποτα καινούργιο στο πλάνο σου εδώ. Κράτα τον ρυθμό σου.',
    nextYear: 'επόμενη χρονιά',
    road: 'Ο δρόμος της χρονιάς',
    hint: 'Διάλεξε τον μήνα που ξεκίνησαν τα τμήματά σου το Quest και το πλάνο σου. Οι μήνες και η ένδειξη «Είσαι εδώ» προσαρμόζονται.',
    printNote: 'Οι μήνες αντιστοιχούν σε έναρξη τον Σεπτέμβριο.'
  }
};

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', elite: 'Elite' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The same loose form guidebook.js compares headings in (plan badges drop the brackets around a plan name). */
export function headingKey(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Calendar month for a stage `at` months after a start month, or 0 once it runs past June. */
export function monthAt(startMonth, at) {
  const startIdx = SCHOOL_MONTHS.indexOf(startMonth);
  const idx = (startIdx < 0 ? 0 : startIdx) + Math.max(0, at);
  return idx < SCHOOL_MONTHS.length ? SCHOOL_MONTHS[idx] : 0;
}

function planBadge(plan) {
  return `<span class="plan-badge plan-badge--${plan}">${PLAN_LABEL[plan]}</span>`;
}

function chapterTitle(chapters, id, lang) {
  const ch = chapters.find((c) => c.id === id);
  return ch ? ch.title[lang] || ch.title.en : id;
}

function goLink(go, lang, chapters, print) {
  const chapter = chapterTitle(chapters, go.chapter, lang);
  const head = go[lang] || '';
  const label = head ? `${esc(chapter)} › ${esc(head.replace(/\*\*/g, ''))}` : esc(chapter);
  if (print) return `<span class="yj-go yj-go--print"><i class="fas fa-book-open" aria-hidden="true"></i> ${label}</span>`;
  return `<button type="button" class="yj-go" data-yj-chapter="${esc(go.chapter)}" data-yj-head="${esc(headingKey(head))}"><i class="fas fa-book-open" aria-hidden="true"></i> ${label}</button>`;
}

function stageMonthLabel(stage, lang, startMonth) {
  const names = MONTH_NAMES[lang];
  if (stage.at < 0) return names[startMonth];
  const m = monthAt(startMonth, stage.at);
  if (!m) return WORDS[lang].nextYear;
  return stage.id === 'finale' ? `${names[m]} → ${names[6]}` : names[m];
}

function controlsHtml(lang) {
  const w = WORDS[lang];
  const months = SCHOOL_MONTHS.map((m) => `<option value="${m}">${MONTH_NAMES[lang][m]}</option>`).join('');
  const plans = ['all', ...YEAR_PLAN_ORDER]
    .map((p) => `<button type="button" class="yj-plan${p === 'all' ? ' is-on' : ''}" data-yj-plan="${p}" aria-pressed="${p === 'all'}">${p === 'all' ? w.all : PLAN_LABEL[p]}</button>`)
    .join('');
  return `<div class="yj-controls">
      <label class="yj-start"><i class="fas fa-flag" aria-hidden="true"></i> <span>${w.started}</span>
        <select data-yj-start>${months}</select></label>
      <div class="yj-plans" role="group" aria-label="${esc(w.plan)}"><span class="yj-plans__label"><i class="fas fa-layer-group" aria-hidden="true"></i> ${w.plan}</span>${plans}</div>
      <p class="yj-hint">${w.hint}</p>
    </div>`;
}

/** The road: one stage card after another along a path. */
export function yearRoadHtml(lang, chapters, print = false) {
  const w = WORDS[lang];
  const start = 9;
  const stages = YEAR_STAGES.map((stage, i) => {
    const steps = stage.steps.map((step) => `
          <li class="yj-step" data-yj-tier="${step.plan}">
            <span class="yj-step__ico" aria-hidden="true"><i class="fas ${step.icon}"></i></span>
            <div class="yj-step__body">
              <p class="yj-step__name">${esc(step.name[lang])} ${planBadge(step.plan)}<span class="yj-step__lock"><i class="fas fa-lock" aria-hidden="true"></i> ${w.locked}</span></p>
              <p class="yj-step__what">${esc(step.what[lang])}</p>
              ${goLink(step.go, lang, chapters, print)}
            </div>
          </li>`).join('');
    return `
      <li class="yj-stage yj-tone--${stage.tone}" data-yj-at="${stage.at}" data-yj-stage="${stage.id}">
        <div class="yj-stage__pin" aria-hidden="true"><i class="fas ${stage.icon}"></i></div>
        <article class="yj-stage__card">
          <header class="yj-stage__head">
            <p class="yj-stage__when"><span class="yj-stage__n">${i + 1}</span> ${esc(stage.when[lang])} · <span class="yj-month" data-yj-month>${esc(stageMonthLabel(stage, lang, start))}</span></p>
            <span class="yj-here"><i class="fas fa-location-dot" aria-hidden="true"></i> ${w.here}</span>
            <h4 class="yj-stage__title">${esc(stage.title[lang])}</h4>
            <p class="yj-stage__lede">${esc(stage.lede[lang])}</p>
          </header>
          <ul class="yj-steps">${steps}</ul>
          <p class="yj-stage__rest">${w.restOnPlan}</p>
        </article>
      </li>`;
  }).join('');
  return `<section class="yj${print ? ' yj--print' : ''}" data-yj data-yj-lang="${lang}" aria-label="${esc(w.road)}">
      ${print ? `<p class="yj-hint">${w.printNote}</p>` : controlsHtml(lang)}
      <ol class="yj-road">${stages}</ol>
    </section>`;
}

/** The dated moments, month by month (October to June). */
export function yearMomentsHtml(lang, chapters, print = false) {
  const names = MONTH_NAMES[lang];
  const months = SCHOOL_MONTHS.filter((m) => YEAR_MOMENTS.some((mo) => mo.months.includes(m)));
  const cols = months.map((m) => {
    const chips = YEAR_MOMENTS.filter((mo) => mo.months.includes(m)).map((mo) => `
        <li class="yj-moment" data-yj-tier="${mo.plan}">
          <span class="yj-moment__ico" aria-hidden="true"><i class="fas ${mo.icon}"></i></span>
          <span class="yj-moment__name">${esc(mo.name[lang])} ${planBadge(mo.plan)}</span>
        </li>`).join('');
    return `<div class="yj-cal__month" data-yj-cal="${m}"><p class="yj-cal__name">${names[m]}</p><ul>${chips}</ul></div>`;
  }).join('');
  const notes = YEAR_MOMENTS.map((mo) => `
      <li data-yj-tier="${mo.plan}"><strong>${esc(mo.name[lang])}</strong> · ${esc(mo.when[lang])} ${goLink(mo.go, lang, chapters, print)}</li>`).join('');
  return `<div class="yj-cal${print ? ' yj-cal--print' : ''}" data-yj-cal-root>
      <div class="yj-cal__strip">${cols}</div>
      <ul class="yj-cal__notes">${notes}</ul>
    </div>`;
}

/** Moments that come when the class gets there. */
export function yearTriggersHtml(lang, chapters, print = false) {
  const cards = YEAR_TRIGGERS.map((tr) => `
      <article class="yj-trigger" data-yj-tier="${tr.plan}">
        <span class="yj-trigger__ico" aria-hidden="true"><i class="fas ${tr.icon}"></i></span>
        <h5>${esc(tr.name[lang])} ${planBadge(tr.plan)}</h5>
        <p>${esc(tr.what[lang])}</p>
        ${goLink(tr.go, lang, chapters, print)}
      </article>`).join('');
  return `<div class="yj-triggers">${cards}</div>`;
}

/**
 * Every link must point at a chapter that exists and a heading that is still in it.
 * `sources` = [{ id, en: markdown, el: markdown }]. Returns a list of problems (empty when all is well).
 */
export function checkYearJourneyLinks(sources) {
  const problems = [];
  const headsOf = (md) => new Set(String(md || '').split(/\r?\n/).filter((l) => /^#{2,4} /.test(l)).map((l) => headingKey(l.replace(/^#+ /, ''))));
  const all = [
    ...YEAR_STAGES.flatMap((s) => s.steps.map((st) => ({ where: `${s.id}: ${st.name.en}`, go: st.go }))),
    ...YEAR_MOMENTS.map((m) => ({ where: `moment ${m.id}`, go: m.go })),
    ...YEAR_TRIGGERS.map((t) => ({ where: `trigger ${t.name.en}`, go: t.go }))
  ];
  for (const { where, go } of all) {
    const src = sources.find((s) => s.id === go.chapter);
    if (!src) { problems.push(`${where}: no chapter "${go.chapter}"`); continue; }
    for (const lang of ['en', 'el']) {
      if (!go[lang]) continue;
      if (!headsOf(src[lang]).has(headingKey(go[lang]))) problems.push(`${where}: ${lang} heading "${go[lang]}" not found in ${go.chapter}`);
    }
  }
  return problems;
}
