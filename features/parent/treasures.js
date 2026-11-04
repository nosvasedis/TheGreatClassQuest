// features/parent/treasures.js — what the class game has given the child: the familiar and the Satchel.
// The familiar's drawing and legendary relic art load on demand once the tab is on screen.
import { escapeHtml, getSnapshot, firstName, relativeDay, tr, isGreek } from './helpers.js';

const TIER_WORDS = {
    common: ['Common', 'Κοινό'],
    rare: ['Rare', 'Σπάνιο'],
    epic: ['Epic', 'Επικό'],
    legendary: ['Legendary', 'Θρυλικό']
};

function itemArt(item) {
    if (item.image) return `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="fp-item__emoji" aria-hidden="true">${escapeHtml(item.icon || (item.kind === 'keepsake' ? '🔥' : '🎁'))}</span>`;
}

function itemNote(item) {
    const bits = [];
    if (item.kind === 'keepsake') bits.push(tr('Keepsake', 'Ενθύμιο'));
    else if (TIER_WORDS[item.tier]) bits.push(tr(...TIER_WORDS[item.tier]));
    if (item.acquiredAt) bits.push(relativeDay(item.acquiredAt));
    return bits.join(' · ');
}

function renderSatchel(items, name) {
    return `
        <div class="fp-satchel">
            <div class="fp-satchel__head">
                <span class="fp-satchel__bag" aria-hidden="true">🎒</span>
                <div>
                    <h4 class="fp-satchel__title">${tr('Satchel', 'Σακίδιο (Satchel)')}</h4>
                    <p class="fp-satchel__sub">${items.length
                        ? (isGreek() ? `${items.length} ${items.length === 1 ? 'θησαυρός' : 'θησαυροί'} από την αγορά και τις περιπέτειες της τάξης.` : `${items.length} treasure${items.length === 1 ? '' : 's'} ${escapeHtml(name)} has earned with class Gold and adventures.`)
                        : tr('Treasures bought with class Gold will be kept here.', 'Οι θησαυροί που αγοράζονται με χρυσό της τάξης φυλάγονται εδώ.')}</p>
                </div>
            </div>
            ${items.length ? `
                <ul class="fp-satchel__grid">
                    ${items.map((item, index) => `
                        <li>
                            <button type="button" class="fp-item${item.tier ? ` is-${escapeHtml(item.tier)}` : ''}${item.kind === 'keepsake' ? ' is-keepsake' : ''}" data-parent-item="${index}" aria-expanded="false">
                                <span class="fp-item__art"${item.artId ? ` data-fp-art="${escapeHtml(item.artId)}"` : ''}>${itemArt(item)}</span>
                                <span class="fp-item__name">${escapeHtml(item.name)}</span>
                            </button>
                        </li>`).join('')}
                </ul>
                <p class="fp-satchel__detail" data-parent-item-detail aria-live="polite">${tr('Tap a treasure to read about it.', 'Πατήστε έναν θησαυρό για να διαβάσετε γι’ αυτόν.')}</p>` : ''}
        </div>`;
}

function renderFamiliar(familiar, name) {
    const egg = familiar.state === 'egg';
    return `
        <div class="fp-familiar">
            <div class="fp-familiar__stage" data-fp-familiar aria-hidden="true"><span class="fp-familiar__wait">${egg ? '🥚' : '🐾'}</span></div>
            <div class="fp-familiar__copy">
                <p class="fp-kicker">${tr('Class companion', 'Σύντροφος της τάξης')}</p>
                <h4 class="fp-familiar__name" data-fp-familiar-name>${escapeHtml(familiar.name || tr('A familiar', 'Ένα ξωτικό ζωάκι'))}</h4>
                <p class="fp-familiar__form" data-fp-familiar-form>${egg ? tr('Still an egg', 'Ακόμη αυγό') : ''}</p>
                <p class="fp-familiar__note">${egg
                    ? (isGreek() ? 'Θα εκκολαφθεί καθώς κερδίζει αστέρια στην τάξη.' : `It hatches as ${escapeHtml(name)} earns stars in class.`)
                    : (isGreek() ? 'Μεγαλώνει και αλλάζει μορφή με κάθε αστέρι της τάξης.' : `It grows into a new form as ${escapeHtml(name)} earns stars.`)}</p>
            </div>
        </div>`;
}

/** Progress tab: the familiar and the Satchel, when the class game has given any. */
export function renderTreasures() {
    const snapshot = getSnapshot();
    const items = Array.isArray(snapshot.satchel) ? snapshot.satchel : null;
    const familiar = snapshot.familiar?.typeId ? snapshot.familiar : null;
    if (!items && !familiar) return '';
    const name = firstName(snapshot.studentName);
    return `
        <article class="fp-card fp-treasures fp-rise" style="--fp-delay:4">
            <p class="fp-kicker">${tr('Treasures from the class game', 'Θησαυροί από το παιχνίδι της τάξης')}</p>
            <h3 class="fp-card__title">${isGreek() ? 'Τι έχει κερδίσει' : `What ${escapeHtml(name)} has earned`}</h3>
            ${familiar ? renderFamiliar(familiar, name) : ''}
            ${items ? renderSatchel(items, name) : ''}
        </article>`;
}

/** Shows a treasure's story under the grid. */
export function showTreasureDetail(button) {
    const items = getSnapshot().satchel || [];
    const item = items[Number(button.dataset.parentItem)];
    const detail = document.querySelector('[data-parent-item-detail]');
    if (!item || !detail) return;
    document.querySelectorAll('[data-parent-item]').forEach((el) => {
        const on = el === button;
        el.classList.toggle('is-open', on);
        el.setAttribute('aria-expanded', String(on));
    });
    const note = itemNote(item);
    detail.innerHTML = `<strong>${escapeHtml(item.name)}</strong>${note ? ` <span class="fp-satchel__meta">${escapeHtml(note)}</span>` : ''}${item.description ? `<br>${escapeHtml(item.description)}` : ''}`;
}

/** Draws the familiar and any legendary relic art once the Progress tab is on screen. */
export async function hydrateTreasures(root = document) {
    const snapshot = getSnapshot();
    const stage = root.querySelector('[data-fp-familiar]');
    const familiar = snapshot.familiar;
    if (stage && familiar?.typeId) {
        try {
            const [fam, progression] = await Promise.all([
                import('../familiars.js'),
                import('../familiarProgression.mjs')
            ]);
            const typeDef = fam.FAMILIAR_TYPES[familiar.typeId];
            if (typeDef && stage.isConnected) {
                // A new form the class has not watched yet stays a surprise: show the form they last saw.
                const pending = fam.getPendingFamiliarMoment(familiar);
                const totalStars = Number(snapshot.progress?.totalStars || 0);
                const egg = familiar.state === 'egg' || pending?.from === 0;
                const level = pending ? Math.max(1, pending.from) : (familiar.level || 1);
                const progress = progression.getFamiliarProgressPercent(progression.getFamiliarProgress(familiar, totalStars));
                stage.innerHTML = fam.familiarArtSvg(familiar, snapshot.studentId || '', egg ? { egg: true, progress: pending ? 100 : progress, starbond: 0 } : { level, starbond: 0 });
                stage.classList.add('is-drawn');
                const nameEl = root.querySelector('[data-fp-familiar-name]');
                const formEl = root.querySelector('[data-fp-familiar-form]');
                if (nameEl && !familiar.name) nameEl.textContent = typeDef.name;
                if (formEl && !egg) formEl.innerHTML = `${escapeHtml(fam.familiarStageName(familiar.typeId, level))} · <span class="fp-nowrap">${escapeHtml(tr(`form ${level} of 5`, `μορφή ${level} από 5`))}</span>`;
            }
        } catch (error) {
            console.warn('Family familiar drawing skipped:', error);
        }
    }
    const artSlots = [...root.querySelectorAll('[data-fp-art]')];
    if (artSlots.length) {
        try {
            const { legendaryArtSvg } = await import('../legendaryArt.mjs');
            artSlots.forEach((slot) => {
                const svg = legendaryArtSvg(slot.dataset.fpArt, { className: 'lg-art fp-item__lg' });
                if (svg) slot.innerHTML = svg;
            });
        } catch (error) {
            console.warn('Family relic art skipped:', error);
        }
    }
}
