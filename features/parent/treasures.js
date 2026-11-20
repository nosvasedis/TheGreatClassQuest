// features/parent/treasures.js — what the class game has given the child: the familiar and the Satchel.
// The familiar's drawing and legendary relic art load on demand once the tab is on screen.
import { escapeHtml, getSnapshot, firstName, relativeDay, tr, isGreek } from './helpers.js';
import { bi, gameName, gameNameHtml } from './i18n.js';

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

const TIER_ORDER = ['legendary', 'epic', 'rare', 'common'];
const TIER_PLURAL_EL = { common: 'κοινά', rare: 'σπάνια', epic: 'επικά', legendary: 'θρυλικά' };

function tierOf(item) {
    if (item.kind === 'keepsake') return 'keepsake';
    return TIER_WORDS[item.tier] ? item.tier : 'common';
}

function renderSatchel(items, name) {
    const counts = {};
    items.forEach((item) => { counts[tierOf(item)] = (counts[tierOf(item)] || 0) + 1; });
    const tally = [...TIER_ORDER, 'keepsake'].filter((tier) => counts[tier]).map((tier) => {
        const one = counts[tier] === 1;
        const word = tier === 'keepsake' ? tr(one ? 'keepsake' : 'keepsakes', one ? 'ενθύμιο' : 'ενθύμια') : tr(TIER_WORDS[tier][0].toLowerCase(), one ? TIER_WORDS[tier][1].toLocaleLowerCase('el') : TIER_PLURAL_EL[tier]);
        return `<span class="fp-satchel__tally is-${tier}">${counts[tier]} ${escapeHtml(word)}</span>`;
    }).join('');
    return `
        <div class="fp-satchel">
            <div class="fp-satchel__flap" aria-hidden="true"><span class="fp-satchel__buckle"></span></div>
            <div class="fp-satchel__head">
                <span class="fp-satchel__bag" aria-hidden="true">🎒</span>
                <div>
                    <h4 class="fp-satchel__title">${bi('Satchel', 'Σακίδιο')}</h4>
                    <p class="fp-satchel__sub">${items.length
                        ? (isGreek() ? `${items.length} ${items.length === 1 ? 'θησαυρός' : 'θησαυροί'} από την αγορά και τις περιπέτειες της τάξης.` : `${items.length} treasure${items.length === 1 ? '' : 's'} ${escapeHtml(name)} has earned with class Gold and adventures.`)
                        : tr('Treasures bought with class Gold will be kept here.', 'Οι θησαυροί που αγοράζονται με χρυσό της τάξης φυλάγονται εδώ.')}</p>
                </div>
            </div>
            ${tally ? `<div class="fp-satchel__tallies">${tally}</div>` : ''}
            ${items.length ? `
                <ul class="fp-satchel__grid">
                    ${items.map((item, index) => `
                        <li style="--i:${Math.min(index, 16)}">
                            <button type="button" class="fp-item is-${tierOf(item)}" data-parent-item="${index}" aria-expanded="false">
                                <span class="fp-item__art"${item.artId ? ` data-fp-art="${escapeHtml(item.artId)}"` : ''}>${itemArt(item)}</span>
                                <span class="fp-item__name">${escapeHtml(item.name)}</span>
                                <span class="fp-item__gem" aria-hidden="true"></span>
                            </button>
                        </li>`).join('')}
                </ul>
                <div class="fp-satchel__detail" data-parent-item-detail aria-live="polite"><i class="fas fa-hand-pointer" aria-hidden="true"></i> ${tr('Tap a treasure to read about it.', 'Πατήστε έναν θησαυρό για να διαβάσετε γι’ αυτόν.')}</div>` : ''}
        </div>`;
}

function renderFamiliar(familiar, name) {
    const egg = familiar.state === 'egg';
    const steps = [1, 2, 3, 4, 5].map((n) => `<span class="fp-fam__step" data-fp-fam-step="${n}"><span>${n}</span></span>`).join('');
    return `
        <div class="fp-fam${egg ? ' is-egg' : ''}" data-fp-fam>
            <div class="fp-fam__scene" aria-hidden="true">
                <span class="fp-fam__sun"></span>
                <span class="fp-fam__hill"></span>
                <span class="fp-fam__sparkle" style="--x:18%;--y:22%;--d:0s"></span>
                <span class="fp-fam__sparkle" style="--x:78%;--y:30%;--d:1.1s"></span>
                <span class="fp-fam__sparkle" style="--x:62%;--y:12%;--d:2s"></span>
                <div class="fp-fam__stage" data-fp-familiar><span class="fp-familiar__wait">${egg ? '🥚' : '🐾'}</span></div>
            </div>
            <div class="fp-fam__copy">
                <p class="fp-fam__kicker">${tr('Familiar', 'Ζωάκι-σύντροφος')}</p>
                <h4 class="fp-fam__name" data-fp-familiar-name>${escapeHtml(familiar.name || tr('A familiar', 'Ένα ζωάκι-σύντροφος'))}</h4>
                <p class="fp-fam__form" data-fp-familiar-form>${egg ? tr('Still an egg', 'Ακόμη αυγό') : ''}</p>
                <div class="fp-fam__steps" aria-hidden="true">${steps}</div>
                <div class="fp-fam__meter" data-fp-fam-meter hidden><span class="fp-fam__fill" data-fp-fam-fill></span></div>
                <p class="fp-fam__next" data-fp-fam-next></p>
                <p class="fp-fam__note">${isGreek()
                    ? 'Κάθε αστέρι που κερδίζει στην τάξη το μοιράζεται με το ζωάκι του. Σε 20, 80, 160, 300 και 500 αστέρια μαζί αλλάζει μορφή.'
                    : `Every star ${escapeHtml(name)} earns in class is shared with the familiar. It takes a new form at 20, 80, 160, 300 and 500 stars together.`}</p>
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
        <article class="fp-card fp-treasures fp-rise" style="--fp-delay:5">
            <p class="fp-kicker">${tr('Treasures from the class game', 'Θησαυροί από το παιχνίδι της τάξης')}</p>
            <h3 class="fp-card__title">${isGreek() ? 'Τι έχει κερδίσει' : `What ${escapeHtml(name)} has earned`}</h3>
            <div class="fp-treasures__body">
                ${familiar ? renderFamiliar(familiar, name) : ''}
                ${items ? renderSatchel(items, name) : ''}
            </div>
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
    detail.classList.remove('is-shown');
    detail.innerHTML = `
        <span class="fp-satchel__dart is-${tierOf(item)}" aria-hidden="true">${button.querySelector('.fp-item__art')?.innerHTML || ''}</span>
        <span class="fp-satchel__dcopy"><strong>${escapeHtml(item.name)}</strong>${note ? `<span class="fp-satchel__meta is-${tierOf(item)}">${escapeHtml(note)}</span>` : ''}${item.description ? `<span class="fp-satchel__desc">${escapeHtml(item.description)}</span>` : ''}</span>`;
    void detail.offsetWidth; // restart the reveal
    detail.classList.add('is-shown');
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
                const growth = progression.getFamiliarProgress(familiar, totalStars);
                const progress = progression.getFamiliarProgressPercent(growth);
                stage.innerHTML = fam.familiarArtSvg(familiar, snapshot.studentId || '', egg ? { egg: true, progress: pending ? 100 : progress, starbond: 0 } : { level, starbond: 0 });
                stage.classList.add('is-drawn');
                const card = root.querySelector('[data-fp-fam]');
                if (card) {
                    card.style.setProperty('--fam-a', typeDef.eggColor || '#8fbf7a');
                    card.style.setProperty('--fam-b', typeDef.eggAccent || '#e8f3dc');
                    card.classList.add('is-ready');
                }
                const nameEl = root.querySelector('[data-fp-familiar-name]');
                const formEl = root.querySelector('[data-fp-familiar-form]');
                if (nameEl) {
                    nameEl.innerHTML = familiar.name
                        ? `${escapeHtml(familiar.name)} <span class="fp-fam__species">${escapeHtml(gameName(typeDef.name))}</span>`
                        : gameNameHtml(typeDef.name, escapeHtml);
                }
                if (formEl && !egg) formEl.innerHTML = `${gameNameHtml(fam.familiarStageName(familiar.typeId, level), escapeHtml)}`;
                root.querySelectorAll('[data-fp-fam-step]').forEach((step) => {
                    const n = Number(step.dataset.fpFamStep);
                    step.classList.toggle('is-done', !egg && n < level);
                    step.classList.toggle('is-now', !egg && n === level);
                });
                const meter = root.querySelector('[data-fp-fam-meter]');
                const fill = root.querySelector('[data-fp-fam-fill]');
                const next = root.querySelector('[data-fp-fam-next]');
                const together = Math.floor(Number(growth.bond || 0));
                let line = '';
                if (pending) {
                    line = egg
                        ? tr('Ready to hatch! It will hatch in class.', 'Έτοιμο να εκκολαφθεί! Θα γίνει μέσα στην τάξη.')
                        : tr('A new form is waiting to be revealed in class!', 'Μια νέα μορφή περιμένει να αποκαλυφθεί στην τάξη!');
                } else if (growth.phase === 'max') {
                    line = tr(`Its final form! ${together} stars together.`, `Η τελευταία του μορφή! ${together} αστέρια μαζί.`);
                } else if (Number.isFinite(growth.remaining)) {
                    const left = Math.ceil(growth.remaining);
                    line = egg
                        ? tr(`${left} more ${left === 1 ? 'star' : 'stars'} to hatch.`, `Ακόμη ${left} ${left === 1 ? 'αστέρι' : 'αστέρια'} για να εκκολαφθεί.`)
                        : tr(`${together} stars together · ${left} more for form ${level + 1}.`, `${together} αστέρια μαζί · ακόμη ${left} για τη μορφή ${level + 1}.`);
                }
                if (next) next.textContent = line;
                if (meter && fill && growth.phase !== 'max') {
                    meter.hidden = false;
                    requestAnimationFrame(() => { fill.style.width = `${pending ? 100 : Math.max(4, progress)}%`; });
                }
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
