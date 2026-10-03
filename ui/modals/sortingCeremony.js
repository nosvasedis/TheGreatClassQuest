// /ui/modals/sortingCeremony.js — The Guild Sorting Ceremony (lazy; opened via ui/modals/sortingQuiz.js): intro → questions → seal → reveal → result.
// Markup: templates/modals/sortingQuiz.js. Styles: styles/sorting_ceremony.css.
// Pure maths / words: features/sortingCeremonyCore.mjs. Quiz state + save: features/sortingQuiz.js.

import * as state from '../../state.js';
import * as sortingQuiz from '../../features/sortingQuiz.js';
import { GUILDS, getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import {
    SORTING_RING_ORDER,
    GUILD_REVEAL_LINES,
    GUILD_WELCOME_LINES,
    firstName,
    computeGuildAffinity,
    orbColorsForShares,
    buildRevealSequence,
    buildAffinityEcho,
    splitOptionGlyph,
    questionLabel,
} from '../../features/sortingCeremonyCore.mjs';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const QUIZ_MODAL_ID = 'sorting-quiz-modal';
const ADVANCE_MS = 720;

/** Per-run ceremony context (timers, flags, the student being sorted). */
let ctx = freshContext();

function freshContext() {
    return { studentId: null, student: null, busy: false, saved: false, resultId: null, timers: [], savePromise: null };
}

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function reducedMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// ─── Low-power mode ─────────────────────────────────────────────────────────
// Weak classroom laptops get .sq--lite (styles/sorting_ceremony.css): the same
// scene minus a few costly extras. It starts on low-core / low-memory machines
// and switches on by itself if frames keep running long; once on, it stays on
// for the rest of the session.

let _lite = (() => {
    try {
        const cores = Number(navigator.hardwareConcurrency) || 8;
        const memory = Number(navigator.deviceMemory) || 8;
        return cores <= 4 || memory <= 4;
    } catch (_) {
        return false;
    }
})();
let _frameWatch = 0;

function applyLite() {
    modalEl()?.classList.toggle('sq--lite', _lite);
}

/** Watch frame times while the ceremony is open; slow frames switch on lite mode. */
function watchFrames() {
    stopFrameWatch();
    if (_lite) return;
    const samples = [];
    let last = 0;
    const step = (t) => {
        const modal = modalEl();
        if (!modal || modal.classList.contains('hidden')) { _frameWatch = 0; return; }
        if (last && !document.hidden && !modal.classList.contains('is-entering')) {
            samples.push(t - last);
            if (samples.length > 40) samples.shift();
            if (samples.length === 40) {
                const sorted = [...samples].sort((a, b) => a - b);
                if (sorted[20] > 30) {
                    _lite = true;
                    applyLite();
                    _frameWatch = 0;
                    return;
                }
            }
        }
        last = t;
        _frameWatch = requestAnimationFrame(step);
    };
    _frameWatch = requestAnimationFrame(step);
}

function stopFrameWatch() {
    if (_frameWatch) cancelAnimationFrame(_frameWatch);
    _frameWatch = 0;
}

function later(fn, ms) {
    const id = setTimeout(fn, ms);
    ctx.timers.push(id);
    return id;
}

function clearTimers() {
    ctx.timers.forEach(clearTimeout);
    ctx.timers = [];
}

function sound(name) {
    import('../../audio.js').then((a) => a.playSound?.(name)).catch(() => {});
}

const _guildAudio = {};
function playGuildVoice(guildId) {
    const guild = getGuildById(guildId);
    if (!guild?.sound) return;
    try {
        if (!_guildAudio[guildId]) {
            _guildAudio[guildId] = new Audio(guild.sound);
            _guildAudio[guildId].volume = 0.7;
        }
        _guildAudio[guildId].currentTime = 0;
        _guildAudio[guildId].play().catch(() => {});
    } catch (_) { /* audio is decoration */ }
}

function modalEl() {
    return $(QUIZ_MODAL_ID);
}

function setStage(stage) {
    const modal = modalEl();
    if (!modal) return;
    modal.dataset.stage = stage;
    const panel = modal.querySelector(`[data-panel="${stage}"]`);
    const focusTarget = panel?.querySelector('.sq-btn--gold, .sq-btn--guild, .sq-option');
    if (focusTarget) requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
}

function resolveStudent(studentId) {
    const students = state.get('allStudents') || [];
    return students.find((s) => s.id === studentId) || null;
}

function resolveQuestLevel(student) {
    if (!student?.classId) return null;
    const classes = state.get('allSchoolClasses') || [];
    const cls = classes.find((c) => c.id === student.classId);
    return cls ? (cls.questLevel || null) : null;
}

// ─── Render pieces ──────────────────────────────────────────────────────────

function renderRing() {
    const ring = $('sq-ring');
    if (!ring) return;
    ring.innerHTML = SORTING_RING_ORDER.map((id, i) => {
        const g = GUILDS[id];
        const url = getGuildEmblemUrl(id);
        const face = url
            ? `<img src="${url}" alt="" class="sq-seat__emblem" draggable="false">`
            : `<span class="sq-seat__emblem sq-seat__emblem--emoji">${g.emoji}</span>`;
        return `<div class="sq-seat" data-guild="${id}" style="--seat:${i}; --seat-glow:${g.glow}; --seat-a:${g.primary}; --seat-b:${g.secondary};">
            <div class="sq-seat__body">
                <span class="sq-seat__halo"></span>
                ${face}
                <span class="sq-seat__name">${escapeHtml(g.name)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderHero(student) {
    const hero = $('sq-hero');
    if (!hero) return;
    const name = student?.name || 'Hero';
    const face = student?.avatar
        ? `<img src="${escapeHtml(student.avatar)}" alt="" class="sq-hero__img" draggable="false">`
        : `<span class="sq-hero__initial">${escapeHtml(firstName(name).charAt(0).toUpperCase())}</span>`;
    hero.innerHTML = `<div class="sq-hero__frame">${face}</div><span class="sq-hero__name">${escapeHtml(name)}</span>`;
    const lede = $('sq-intro-lede');
    if (lede) {
        lede.textContent = `${firstName(name)}, four great houses are waiting for you. Answer from the heart: there are no wrong answers.`;
    }
}

let _nebFront = 0;

/**
 * Recolour the nebula by fading a second, freshly painted layer in over it.
 * Easing the colour itself would repaint the whole sky every frame, which
 * stalls weak laptops; a cross-fade paints once and lets the GPU do the rest.
 */
function paintNebula(a, b, ms = 900) {
    const layers = modalEl()?.querySelectorAll('.sq-sky__nebula');
    if (!layers || layers.length < 2) return;
    const front = layers[_nebFront];
    if (front.dataset.a === a && front.dataset.b === b) return;
    const next = layers[1 - _nebFront];
    [front, next].forEach((el) => el.getAnimations().forEach((anim) => anim.cancel()));
    front.style.opacity = '1';
    front.style.zIndex = '0';
    next.dataset.a = a;
    next.dataset.b = b;
    next.style.setProperty('--neb-a', a);
    next.style.setProperty('--neb-b', b);
    next.style.zIndex = '1';
    next.style.visibility = 'visible';
    _nebFront = 1 - _nebFront;
    const settle = () => {
        next.style.opacity = '1';
        front.style.visibility = 'hidden';
    };
    if (ms <= 0 || reducedMotion() || !next.animate) { settle(); return; }
    next.style.opacity = '0';
    const anim = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease', fill: 'forwards' });
    anim.onfinish = () => { settle(); anim.cancel(); };
}

function setOrbColors(a, b, nebulaMs, nebula = true) {
    const modal = modalEl();
    if (!modal) return;
    modal.style.setProperty('--sq-orb-a', a);
    modal.style.setProperty('--sq-orb-b', b);
    if (nebula) paintNebula(a, b, nebulaMs);
}

function applyOrbColors(nebulaMs) {
    const { questions, answers } = sortingQuiz.getQuizState();
    const { shares } = computeGuildAffinity(questions, answers);
    const { a, b } = orbColorsForShares(shares, GUILDS);
    setOrbColors(a, b, nebulaMs);
}

function renderRunes(step, total, answers) {
    const runes = $('sorting-quiz-dots');
    if (!runes) return;
    runes.innerHTML = Array.from({ length: total }, (_, i) => {
        const cls = i === step - 1 ? 'is-current' : (answers[i] !== undefined ? 'is-lit' : '');
        return `<span class="sq-rune ${cls}"><i></i></span>`;
    }).join('');
}

function renderQuizStep(animate = false) {
    const { step, answers, questions } = sortingQuiz.getQuizState();
    const total = questions?.length || 0;
    const question = questions?.[step - 1];
    if (!question) return;

    const progressEl = $('sorting-quiz-progress');
    if (progressEl) progressEl.textContent = questionLabel(step, total);
    renderRunes(step, total, answers);

    const glyph = $('sorting-quiz-question-emoji');
    if (glyph) {
        glyph.textContent = question.emoji || '✨';
        if (animate) {
            glyph.classList.remove('is-arriving');
            void glyph.offsetWidth;
            glyph.classList.add('is-arriving');
        }
    }

    const wrap = $('sorting-quiz-question');
    if (wrap && animate) {
        wrap.classList.remove('is-entering', 'is-leaving');
        void wrap.offsetWidth;
        wrap.classList.add('is-entering');
    }

    const textEl = $('sorting-quiz-question-text');
    if (textEl) textEl.textContent = question.question;

    const optionsEl = $('sorting-quiz-options');
    if (optionsEl) {
        const selectedIdx = answers[step - 1];
        optionsEl.innerHTML = question.options.map((opt, i) => {
            const raw = typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : opt;
            const { glyph: pic, text, isEmoji } = splitOptionGlyph(raw, OPTION_LABELS[i] || String(i + 1));
            const chosen = selectedIdx === i;
            return `<button type="button" class="sq-option${chosen ? ' is-chosen' : ''}" data-option-index="${i}" style="--i:${i}" aria-pressed="${chosen}">
                <span class="sq-option__key">${OPTION_LABELS[i] || i + 1}</span>
                <span class="sq-option__glyph${isEmoji ? '' : ' sq-option__glyph--letter'}">${escapeHtml(pic)}</span>
                <span class="sq-option__text">${escapeHtml(text)}</span>
            </button>`;
        }).join('');
    }

    const backBtn = $('sq-back-btn');
    if (backBtn) backBtn.querySelector('span').textContent = step === 1 ? 'Start' : 'Back';

    applyOrbColors();
}

// ─── Moments ────────────────────────────────────────────────────────────────

function orbPulse() {
    const orb = $('sq-orb');
    if (!orb) return;
    orb.classList.remove('is-drinking');
    void orb.offsetWidth;
    orb.classList.add('is-drinking');
}

/** A spark flies from the chosen card into the orb. */
function flySpark(fromEl) {
    const orb = $('sq-orb');
    const modal = modalEl();
    if (!orb || !fromEl || !modal || reducedMotion()) { orbPulse(); return; }
    const a = fromEl.getBoundingClientRect();
    const b = orb.getBoundingClientRect();
    const spark = document.createElement('span');
    spark.className = 'sq-flying-spark';
    modal.appendChild(spark);
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2;
    const y1 = b.top + b.height / 2;
    const mx = (x0 + x1) / 2 + (x1 > x0 ? -60 : 60);
    const my = Math.min(y0, y1) - 40;
    const anim = spark.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${mx}px, ${my}px) scale(1.3)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.4)`, opacity: 0.9 },
    ], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' });
    anim.onfinish = () => { spark.remove(); orbPulse(); };
    anim.oncancel = () => spark.remove();
}

function chooseOption(idx) {
    if (ctx.busy || modalEl()?.dataset.stage !== 'question') return;
    const { step, questions } = sortingQuiz.getQuizState();
    const question = questions?.[step - 1];
    if (!question || !question.options?.[idx]) return;
    ctx.busy = true;
    sortingQuiz.selectAnswer(idx);

    const optionsEl = $('sorting-quiz-options');
    optionsEl?.querySelectorAll('.sq-option').forEach((btn) => {
        const mine = Number(btn.dataset.optionIndex) === idx;
        btn.classList.toggle('is-chosen', mine);
        btn.classList.toggle('is-dimmed', !mine);
        btn.setAttribute('aria-pressed', String(mine));
    });
    const chosenBtn = optionsEl?.querySelector(`[data-option-index="${idx}"]`);
    flySpark(chosenBtn);
    sound('magic_chime');
    const { answers } = sortingQuiz.getQuizState();
    renderRunes(step, questions.length, answers);
    later(applyOrbColors, 380);

    later(() => {
        ctx.busy = false;
        if (step >= questions.length) {
            setStage('seal');
            sound('quiz_open');
            return;
        }
        const wrap = $('sorting-quiz-question');
        wrap?.classList.remove('is-entering');
        wrap?.classList.add('is-leaving');
        later(() => {
            sortingQuiz.goNext();
            renderQuizStep(true);
            sound('quiz_question_in');
        }, reducedMotion() ? 0 : 200);
    }, ADVANCE_MS);
}

function goBack() {
    if (ctx.busy) return;
    const stage = modalEl()?.dataset.stage;
    if (stage === 'seal') {
        setStage('question');
        renderQuizStep(true);
        return;
    }
    const { step } = sortingQuiz.getQuizState();
    if (step <= 1) {
        setStage('intro');
        return;
    }
    sortingQuiz.goBack();
    renderQuizStep(true);
}

function beginQuestions() {
    setStage('question');
    renderQuizStep(true);
    sound('quiz_open');
}

// ─── The reveal ─────────────────────────────────────────────────────────────

function lightSeat(guildId) {
    const ring = $('sq-ring');
    ring?.querySelectorAll('.sq-seat').forEach((seat) => {
        seat.classList.toggle('is-lit', seat.dataset.guild === guildId);
    });
    const g = GUILDS[guildId];
    // On lite machines the sky stays put while the spotlight races; the orb still follows it.
    if (g) setOrbColors(g.glow, g.secondary, 260, !_lite);
}

async function startReveal() {
    if (ctx.busy) return;
    const { questions, answers } = sortingQuiz.getQuizState();
    if (!questions?.length || answers.filter((a) => a !== undefined).length !== questions.length) return;
    // The pick is decided once up front, so the spotlight knows where to land
    // while the save runs alongside the drama.
    const guildId = sortingQuiz.decideGuild();
    if (!guildId) return;
    ctx.busy = true;

    ctx.resultId = guildId;
    ctx.savePromise = sortingQuiz.submitQuiz().then((r) => {
        ctx.saved = !!r;
        if (!r) throw new Error('Sorting was not saved');
        // Closed mid-reveal: the roster still needs the new house.
        const m = modalEl();
        if (m?.classList.contains('hidden') || m?.classList.contains('is-leaving')) {
            import('../../ui/tabs.js').then((t) => t.renderManageStudentsTab?.());
        }
        return r;
    });
    ctx.savePromise.catch(() => {}); // handled at landing

    setStage('reveal');
    const line = $('sq-reveal-line');
    if (line) line.textContent = 'The stars are deciding…';

    const audio = await import('../../audio.js').catch(() => null);
    const sequence = reducedMotion()
        ? [{ guildId, delay: 700 }]
        : buildRevealSequence(guildId);
    if (!reducedMotion()) audio?.playDrumRoll?.();

    let i = 0;
    const tick = () => {
        const stepInfo = sequence[i];
        lightSeat(stepInfo.guildId);
        if (!reducedMotion() && stepInfo.delay >= 160) sound('click');
        if (i === Math.floor(sequence.length * 0.6) && line) line.textContent = 'Almost there…';
        i += 1;
        if (i < sequence.length) {
            later(tick, stepInfo.delay);
        } else {
            later(() => land(audio), stepInfo.delay);
        }
    };
    later(tick, reducedMotion() ? 200 : 900);
}

async function land(audio) {
    const guildId = ctx.resultId;
    try {
        await ctx.savePromise;
    } catch (err) {
        console.error('Sorting Ceremony: could not save the guild', err);
        audio?.stopDrumRoll?.();
        ctx.busy = false;
        setStage('error');
        return;
    }
    audio?.stopDrumRoll?.();
    fillResult(guildId);

    const modal = modalEl();
    const g = GUILDS[guildId];
    if (modal && g) {
        modal.style.setProperty('--sq-g1', g.primary);
        modal.style.setProperty('--sq-g2', g.secondary);
        modal.style.setProperty('--sq-glow', g.glow);
        modal.dataset.guild = guildId;
    }
    modal?.classList.remove('is-flashing');
    void modal?.offsetWidth;
    modal?.classList.add('is-flashing');

    setStage('result');
    sound('star3');
    playGuildVoice(guildId);
    ctx.busy = false;

    if (!reducedMotion() && g) {
        requestAnimationFrame(() => {
            const crest = $('sorting-quiz-result-emblem');
            const r = crest?.getBoundingClientRect();
            const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
            const cy = r ? r.top + r.height / 2 : window.innerHeight / 3;
            burstSparks(cx, cy, [g.glow, g.secondary, g.primary, '#fde68a', '#ffffff'], 150);
            later(() => burstSparks(cx, cy, [g.glow, '#fde68a', '#ffffff'], 70), 520);
        });
    }
}

function fillResult(guildId) {
    const g = getGuildById(guildId);
    if (!g) return;
    const url = getGuildEmblemUrl(guildId);
    const emblem = $('sorting-quiz-result-emblem');
    if (emblem) {
        emblem.innerHTML = url
            ? `<img src="${url}" alt="${escapeHtml(g.name)}" class="sq-crest__img" draggable="false">`
            : `<span class="sq-crest__emoji">${g.emoji}</span>`;
    }
    const who = $('sq-result-who');
    if (who) who.textContent = `${ctx.student?.name || 'Our hero'} joins`;
    const name = $('sorting-quiz-result-name');
    if (name) {
        name.innerHTML = [...g.name].map((ch, i) =>
            ch === ' ' ? '<span class="sq-letter sq-letter--space"> </span>' : `<span class="sq-letter" style="--l:${i}">${escapeHtml(ch)}</span>`
        ).join('');
        name.setAttribute('aria-label', g.name);
    }
    const motto = $('sorting-quiz-result-motto');
    if (motto) motto.textContent = `“${g.motto || ''}”`;
    const traits = $('sq-result-traits');
    if (traits) {
        traits.innerHTML = (g.traits || []).map((t, i) => `<span class="sq-trait" style="--t:${i}">${escapeHtml(t)}</span>`).join('');
    }
    const why = $('sq-result-why');
    if (why) why.textContent = `${GUILD_WELCOME_LINES[guildId] || ''} ${GUILD_REVEAL_LINES[guildId] || ''}`.trim();

    const echo = $('sq-result-echo');
    if (echo) {
        const { questions, answers } = sortingQuiz.getQuizState();
        const rows = buildAffinityEcho(computeGuildAffinity(questions, answers).shares).filter((r) => r.percent > 0);
        echo.innerHTML = `<p class="sq-echo__label">Your answers echoed</p>
            <div class="sq-echo__bar">${rows.map((r) => {
                const rg = GUILDS[r.guildId];
                return `<span class="sq-echo__seg" style="--w:${r.percent}%; --c:${rg.glow};" title="${escapeHtml(rg.name)} ${r.percent}%"></span>`;
            }).join('')}</div>
            <div class="sq-echo__legend">${rows.map((r) => {
                const rg = GUILDS[r.guildId];
                return `<span><i style="background:${rg.glow}"></i>${rg.emoji} ${r.percent}%</span>`;
            }).join('')}</div>`;
    }
}

// ─── Sparks (Canvas 2D, short-lived) ────────────────────────────────────────

let _sparks = [];
let _sparkRaf = 0;

function burstSparks(cx, cy, colors, count) {
    const canvas = $('sq-sparks');
    if (!canvas?.getContext) return;
    const dpr = Math.min(window.devicePixelRatio || 1, _lite ? 1 : 2);
    if (_lite) count = Math.round(count * 0.55);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 9;
        _sparks.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 1,
            decay: 0.008 + Math.random() * 0.014,
            size: 2 + Math.random() * 4,
            color: colors[i % colors.length],
            star: Math.random() < 0.35,
            spin: Math.random() * Math.PI,
        });
    }
    if (!_sparkRaf) _sparkRaf = requestAnimationFrame(() => drawSparks(canvas, dpr));
}

function drawStar(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r : r * 0.42;
        const a = rot + (i * Math.PI) / 4;
        c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
    c.fill();
}

function drawSparks(canvas, dpr) {
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.globalCompositeOperation = 'lighter';
    _sparks = _sparks.filter((p) => p.life > 0);
    for (const p of _sparks) {
        p.vx *= 0.975;
        p.vy = p.vy * 0.975 + 0.09;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.spin += 0.08;
        c.globalAlpha = Math.max(0, p.life);
        c.fillStyle = p.color;
        if (p.star) {
            drawStar(c, p.x, p.y, p.size * 1.8, p.spin);
        } else {
            c.beginPath();
            c.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
            c.fill();
        }
    }
    c.globalAlpha = 1;
    if (_sparks.length) {
        _sparkRaf = requestAnimationFrame(() => drawSparks(canvas, dpr));
    } else {
        _sparkRaf = 0;
        c.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function stopSparks() {
    if (_sparkRaf) cancelAnimationFrame(_sparkRaf);
    _sparkRaf = 0;
    _sparks = [];
    const canvas = $('sq-sparks');
    canvas?.getContext?.('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

// ─── Listeners (wired once) ─────────────────────────────────────────────────

let _listenersWired = false;

function onKeydown(e) {
    const modal = modalEl();
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSortingCeremony();
        return;
    }
    if (modal.dataset.stage === 'question' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        const idx = ['1', '2', '3', '4'].indexOf(key) >= 0 ? Number(key) - 1 : ['a', 'b', 'c', 'd'].indexOf(key);
        if (idx >= 0) {
            e.preventDefault();
            chooseOption(idx);
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            goBack();
        }
    }
}

function wireQuizListeners() {
    if (_listenersWired) return;
    const modal = modalEl();
    if (!modal) return;
    _listenersWired = true;

    $('sorting-quiz-options')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sq-option');
        if (!btn) return;
        const idx = parseInt(btn.dataset.optionIndex, 10);
        if (!Number.isNaN(idx)) chooseOption(idx);
    });
    $('sq-begin-btn')?.addEventListener('click', beginQuestions);
    $('sq-back-btn')?.addEventListener('click', goBack);
    $('sq-seal-back-btn')?.addEventListener('click', goBack);
    $('sorting-quiz-next-btn')?.addEventListener('click', startReveal);
    $('sq-retry-btn')?.addEventListener('click', () => {
        lightSeat(null);
        applyOrbColors();
        setStage('seal');
    });
    $('sorting-quiz-cancel-btn')?.addEventListener('click', () => closeSortingCeremony());
    $('sorting-quiz-result-done-btn')?.addEventListener('click', () => closeSortingCeremony());
    document.addEventListener('keydown', onKeydown);
}

// ─── Public API ─────────────────────────────────────────────────────────────

// ─── Opening and closing: a golden portal ───────────────────────────────────

const OPEN_SETTLE_MS = 1900;
const CLOSE_MS = 820;
let _leaveTimer = 0;

/** Where the portal opens / closes, in viewport px. */
function setPortalPoint(modal, point) {
    const x = Number.isFinite(point?.x) ? point.x : window.innerWidth / 2;
    const y = Number.isFinite(point?.y) ? point.y : window.innerHeight / 2;
    modal.style.setProperty('--sq-ox', `${Math.round(x)}px`);
    modal.style.setProperty('--sq-oy', `${Math.round(y)}px`);
}

/** The ceremony folds back into whatever is glowing at its heart: orb or crest. */
function closingPoint(modal) {
    const heart = modal.dataset.stage === 'result' ? $('sorting-quiz-result-emblem') : $('sq-orb');
    const r = heart?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Open the Sorting Ceremony for a student (plan gate lives in ui/modals/sortingQuiz.js).
 * @param {string} studentId
 * @param {{ origin?: {x:number, y:number} }} [opts] - where the portal opens (the tapped hat)
 */
export function openSortingCeremony(studentId, opts = {}) {
    const modal = modalEl();
    if (!modal) return;

    const student = resolveStudent(studentId);
    // Guilds are for life: never run the ceremony for a student who is already sorted.
    if (student?.guildId && getGuildById(student.guildId)) return;
    const data = sortingQuiz.startQuiz(studentId, resolveQuestLevel(student));
    if (!data.question) return;

    clearTimers();
    stopSparks();
    clearTimeout(_leaveTimer);
    ctx = freshContext();
    ctx.studentId = studentId;
    ctx.student = student;

    wireQuizListeners();
    renderRing();
    renderHero(student);
    const count = $('sq-intro-count');
    if (count) count.textContent = `🎲 ${data.totalSteps} questions, just for you`;
    const glyph = $('sorting-quiz-question-emoji');
    if (glyph) glyph.textContent = '🔮';

    ['--sq-g1', '--sq-g2', '--sq-glow'].forEach((p) => modal.style.removeProperty(p));
    delete modal.dataset.guild;
    modal.classList.remove('is-flashing', 'is-leaving', 'is-entering');
    applyOrbColors(0);

    // Start folded (sq-pre), then let the portal open and the sigil unfurl.
    setPortalPoint(modal, opts.origin);
    modal.classList.add('sq-pre');
    applyLite();
    modal.classList.remove('hidden');
    document.body.classList.add('sq-open');
    setStage('intro');
    void modal.offsetWidth;
    modal.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.remove('sq-pre')));
    later(() => modal.classList.remove('is-entering'), reducedMotion() ? 0 : OPEN_SETTLE_MS);
    if (!reducedMotion()) watchFrames();
    sound('magic_chime');
}

/** Close the ceremony (any stage). Refreshes the roster if a house was saved. */
export function closeSortingCeremony() {
    const modal = modalEl();
    if (!modal || modal.classList.contains('hidden') || modal.classList.contains('is-leaving')) return;
    clearTimers();
    stopSparks();
    stopFrameWatch();
    import('../../audio.js').then((a) => a.stopDrumRoll?.()).catch(() => {});
    const saved = ctx.saved;
    ctx.busy = false;

    setPortalPoint(modal, closingPoint(modal));
    modal.classList.remove('is-entering', 'is-flashing', 'sq-pre');
    modal.classList.add('is-leaving');
    clearTimeout(_leaveTimer);
    _leaveTimer = setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('is-leaving');
        document.body.classList.remove('sq-open');
        if (saved) import('../../ui/tabs.js').then((t) => t.renderManageStudentsTab?.());
    }, reducedMotion() ? 0 : CLOSE_MS);
}
