// features/parent/diary.js — "From class": the class's latest diary page, what was learned and the new words
import { escapeHtml, getSnapshot, firstName, relativeDay, shortDate, tr, isGreek } from './helpers.js';

function dateLine(date) {
    const rel = relativeDay(date);
    const short = shortDate(date);
    const text = rel === short ? short : `${rel} · ${short}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function pageHtml(page) {
    const learned = Array.isArray(page.learned) ? page.learned : [];
    const words = Array.isArray(page.words) ? page.words : [];
    return `
        ${page.imageUrl ? `<figure class="fp-diary__picture"><img src="${escapeHtml(page.imageUrl)}" alt="${escapeHtml(tr('The class diary picture for this lesson', 'Η εικόνα του ημερολογίου για αυτό το μάθημα'))}" loading="lazy" decoding="async"></figure>` : ''}
        ${page.date ? `<p class="fp-diary__date">${escapeHtml(dateLine(page.date))}</p>` : ''}
        ${page.title ? `<h4 class="fp-diary__title">${escapeHtml(page.title)}</h4>` : ''}
        <p class="fp-diary__text">${escapeHtml(page.text || '')}</p>
        ${learned.length ? `
            <div class="fp-diary__learned">
                <p class="fp-diary__label"><i class="fas fa-graduation-cap" aria-hidden="true"></i> ${tr('What we learned', 'Τι μάθαμε')}</p>
                <ul>${learned.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>` : ''}
        ${words.length ? `
            <div class="fp-diary__words">
                <p class="fp-diary__label"><i class="fas fa-spell-check" aria-hidden="true"></i> ${tr('New words to practise at home', 'Νέες λέξεις για εξάσκηση στο σπίτι')}</p>
                <p class="fp-diary__chips">${words.map((word) => `<span class="fp-word" lang="en">${escapeHtml(word)}</span>`).join('')}</p>
            </div>` : ''}`;
}

/** Home: the class diary as a page torn from the class's storybook. */
export function renderClassDiary() {
    const snapshot = getSnapshot();
    const pages = (Array.isArray(snapshot.classDiary) ? snapshot.classDiary : []).filter((page) => page?.text);
    if (!pages.length) return '';
    const [latest, ...earlier] = pages;
    const name = firstName(snapshot.studentName);
    return `
        <article class="fp-card fp-diary fp-rise" style="--fp-delay:4" id="fp-class-diary">
            <span class="fp-diary__ribbon" aria-hidden="true"></span>
            <p class="fp-kicker"><i class="fas fa-book-open" aria-hidden="true"></i> ${tr('From the class diary', 'Από το ημερολόγιο της τάξης')}</p>
            ${latest.isHero ? `
                <p class="fp-diary__crown">
                    <span aria-hidden="true">👑</span>
                    <span>${isGreek() ? 'Αναδείχθηκε Ήρωας της Ημέρας σε αυτό το μάθημα!' : `${escapeHtml(name)} was Hero of the Day in this lesson!`}</span>
                </p>` : ''}
            ${pageHtml(latest)}
            <p class="fp-diary__tip"><i class="fas fa-comments" aria-hidden="true"></i> ${isGreek()
                ? 'Ρωτήστε το παιδί σας τι έγινε στην ιστορία, στα αγγλικά αν μπορεί.'
                : `Ask ${escapeHtml(name)} what happened in the story, in English if they can.`}</p>
            ${earlier.length ? `
                <details class="fp-diary__earlier">
                    <summary>${tr('Earlier pages', 'Προηγούμενες σελίδες')} (${earlier.length})</summary>
                    ${earlier.map((page) => `<div class="fp-diary__page">${pageHtml(page)}</div>`).join('')}
                </details>` : ''}
        </article>`;
}
