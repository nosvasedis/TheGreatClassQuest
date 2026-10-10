// ui/modals/chronicleNoteReading.js
// Under each Hero's Chronicle note: how the note was read ("Read as: very lively · worry"),
// with the teacher's say over it. Tap × on a chip for "not this"; "+ Add" opens a small
// picker (Greek and English labels, grouped by domain) to add a theme the reader missed.
// The correction is saved on the note (readingFix, db/actions/log.js#setChronicleNoteReadingFix)
// and wins over the words and the AI reading everywhere: Oracle, Greenhouse, AI briefs.
//
// Lazy: imported by ui/modals/hero.js#renderHeroChronicleContent after the feed is drawn.
// Reading: features/classGreenhouseNotes.mjs (pure). Styles: styles/chronicle_reading.css.

import * as state from '../../state.js';
import { readNote, noteTheme, NOTE_THEMES } from '../../features/classGreenhouseNotes.mjs';
import { NOTE_DOMAINS } from '../../features/noteLexicon.mjs';
import { hashText, tidyText } from '../../features/noteTextCore.mjs';
import { esc } from '../../features/scholarScrollCore.mjs';
import '../../styles/chronicle_reading.css';

const TONES = { worry: 'worry', better: 'getting better', strength: 'strength', context: 'background' };
const GLYPH = { worry: '●', better: '▲', strength: '★', context: '◆' };

function classmatesOf(student) {
    const all = state.get('allStudents') || [];
    return all.filter((s) => s.classId === student?.classId && s.id !== student?.id).map((s) => ({ id: s.id, name: s.name }));
}

function canEdit(note) {
    return note.source !== 'ember_oath' && note.authorRole !== 'office' && note.teacherId === state.get('currentUserId');
}

function chipHtml(t, editable) {
    const theme = noteTheme(t.id);
    if (!theme) return '';
    const dots = t.tone === 'worry' && t.intensity >= 2 ? `<span class="hc-read__dots" aria-label="said ${t.intensity >= 3 ? 'very ' : ''}strongly">${'!'.repeat(t.intensity - 1)}</span>` : '';
    const src = t.source === 'ai' ? '<i class="fas fa-wand-magic-sparkles hc-read__src" title="Read by the Oracle" aria-hidden="true"></i>'
        : t.source === 'teacher' ? '<i class="fas fa-pen hc-read__src" title="Set by you" aria-hidden="true"></i>' : '';
    const title = `${theme.label} (${theme.labelEl || ''}) · ${TONES[t.tone] || t.tone}${t.pattern === 'trait' ? ' · a pattern' : t.pattern === 'incident' ? ' · a one-off' : ''}${t.source === 'ai' ? ' · read by the Oracle' : t.source === 'teacher' ? ' · set by you' : ''}`;
    return `<span class="hc-read__chip hc-read__chip--${t.tone}" title="${esc(title)}"><span aria-hidden="true">${GLYPH[t.tone] || ''}</span>${esc(theme.label)}${dots}${src}${editable ? `<button type="button" class="hc-read__x" data-read-remove="${t.id}" aria-label="Not ${esc(theme.label)}"><i class="fas fa-xmark" aria-hidden="true"></i></button>` : ''}</span>`;
}

function rowHtml(note, reading, editable) {
    const chips = reading.themes.map((t) => chipHtml(t, editable)).join('');
    const hasFix = !!note.readingFix;
    return `
        <span class="hc-read__label"><i class="fas fa-eye" aria-hidden="true"></i> Read as</span>
        ${chips || '<span class="hc-read__none">nothing named yet</span>'}
        ${editable ? '<button type="button" class="hc-read__add" data-read-add><i class="fas fa-plus" aria-hidden="true"></i> Add</button>' : ''}
        ${editable && hasFix ? '<button type="button" class="hc-read__reset" data-read-reset>Undo my changes</button>' : ''}`;
}

/** Draws the "Read as" row under every note in the Chronicle feed. */
export function paintNoteReadings(feed, studentId) {
    if (!feed) return;
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const mates = classmatesOf(student);
    const notes = state.get('allHeroChronicleNotes') || [];
    feed.querySelectorAll('.hc-entry[data-note-id]').forEach((entry) => {
        const note = notes.find((n) => n.id === entry.dataset.noteId);
        if (!note || note.source === 'ember_oath') return;
        const reading = readNote({ ...note, text: note.noteText }, mates, { self: student });
        const body = entry.querySelector('.hc-entry__body');
        if (!body) return;
        let row = body.querySelector('.hc-read');
        if (!row) {
            row = document.createElement('div');
            row.className = 'hc-read';
            body.appendChild(row);
        }
        row.innerHTML = rowHtml(note, reading, canEdit(note));
    });
    bind(feed);
}

// ---------------------------------------------------------------- corrections

function currentFix(note) {
    const fix = note.readingFix || {};
    return { add: [...(fix.add || [])], remove: [...(fix.remove || [])] };
}

async function saveFix(note, fix) {
    const { setChronicleNoteReadingFix } = await import('../../db/actions/log.js');
    return setChronicleNoteReadingFix(note.id, { ...fix, h: hashText(tidyText(note.noteText || '').trim()) });
}

async function removeTheme(note, id) {
    const fix = currentFix(note);
    if (fix.add.some((a) => a.id === id)) fix.add = fix.add.filter((a) => a.id !== id);
    if (!fix.remove.includes(id)) fix.remove.push(id);
    await saveFix(note, fix);
}

async function addTheme(note, id, tone) {
    const fix = currentFix(note);
    fix.remove = fix.remove.filter((x) => x !== id);
    fix.add = [...fix.add.filter((a) => a.id !== id), { id, tone }];
    await saveFix(note, fix);
}

function pickerHtml() {
    const groups = NOTE_DOMAINS.map((d) => {
        const themes = NOTE_THEMES.filter((t) => t.domain === d.id);
        if (!themes.length) return '';
        return `<div class="hc-pick__group" data-domain="${d.id}">
            <p class="hc-pick__domain"><i class="fas ${d.icon}" aria-hidden="true"></i> ${esc(d.label)} · ${esc(d.labelEl)}</p>
            ${themes.map((t) => `<button type="button" class="hc-pick__theme" data-pick="${t.id}" data-kind="${t.kind}" data-search="${esc(`${t.label} ${t.labelEl || ''}`.toLowerCase())}"><i class="fas ${t.icon}" aria-hidden="true"></i><span>${esc(t.label)}</span><small>${esc(t.labelEl || '')}</small></button>`).join('')}
        </div>`;
    }).join('');
    return `
        <div class="hc-pick" role="dialog" aria-label="Add what this note is about">
            <div class="hc-pick__top">
                <input type="search" class="hc-pick__search" placeholder="Search… (e.g. lively, ζωηρός, spelling)" aria-label="Search themes">
                <div class="hc-pick__tones" role="radiogroup" aria-label="How it reads">
                    <button type="button" class="hc-pick__tone is-on" data-tone="worry" role="radio" aria-checked="true">${GLYPH.worry} Worry</button>
                    <button type="button" class="hc-pick__tone" data-tone="better" role="radio" aria-checked="false">${GLYPH.better} Getting better</button>
                    <button type="button" class="hc-pick__tone" data-tone="strength" role="radio" aria-checked="false">${GLYPH.strength} Strength</button>
                </div>
                <button type="button" class="hc-pick__close" data-pick-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </div>
            <div class="hc-pick__list">${groups}</div>
        </div>`;
}

function closePickers(feed) {
    feed.querySelectorAll('.hc-pick').forEach((p) => p.remove());
}

function openPicker(feed, row) {
    closePickers(feed);
    row.insertAdjacentHTML('afterend', pickerHtml());
    const picker = row.nextElementSibling;
    const search = picker.querySelector('.hc-pick__search');
    search.focus();
    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        picker.querySelectorAll('.hc-pick__theme').forEach((b) => {
            const hay = b.dataset.search.normalize('NFD').replace(/[̀-ͯ]/g, '');
            b.hidden = !!q && !hay.includes(q);
        });
        picker.querySelectorAll('.hc-pick__group').forEach((g) => { g.hidden = ![...g.querySelectorAll('.hc-pick__theme')].some((b) => !b.hidden); });
    });
    picker.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); picker.remove(); }
    });
}

function bind(feed) {
    if (feed.dataset.readBound) return;
    feed.dataset.readBound = '1';
    feed.addEventListener('click', async (e) => {
        const entry = e.target.closest('.hc-entry[data-note-id]');
        const note = entry && (state.get('allHeroChronicleNotes') || []).find((n) => n.id === entry.dataset.noteId);
        const removeBtn = e.target.closest('[data-read-remove]');
        if (removeBtn && note && canEdit(note)) {
            removeBtn.disabled = true;
            await removeTheme(note, removeBtn.dataset.readRemove);
            return;
        }
        if (e.target.closest('[data-read-reset]') && note && canEdit(note)) {
            const { setChronicleNoteReadingFix } = await import('../../db/actions/log.js');
            await setChronicleNoteReadingFix(note.id, null);
            return;
        }
        if (e.target.closest('[data-read-add]') && note && canEdit(note)) {
            openPicker(feed, entry.querySelector('.hc-read'));
            return;
        }
        if (e.target.closest('[data-pick-close]')) { closePickers(feed); return; }
        const tone = e.target.closest('.hc-pick__tone');
        if (tone) {
            tone.parentElement.querySelectorAll('.hc-pick__tone').forEach((b) => {
                const on = b === tone;
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-checked', String(on));
            });
            return;
        }
        const pick = e.target.closest('[data-pick]');
        if (pick && note && canEdit(note)) {
            const picker = pick.closest('.hc-pick');
            const chosen = picker.querySelector('.hc-pick__tone.is-on')?.dataset.tone || 'worry';
            // Background themes are never a judgement; strengths are never a worry.
            const kind = pick.dataset.kind;
            const finalTone = kind === 'context' ? 'context' : kind === 'strength' ? 'strength' : chosen;
            picker.remove();
            await addTheme(note, pick.dataset.pick, finalTone);
        }
    });
}
