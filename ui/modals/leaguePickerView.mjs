// Quest League picker markup: a gallery of league pennants hanging from four
// stage rods (styles/league_controls.css). Pure, no app state, so the preview
// page (league-controls-preview.js) draws exactly what the app draws.

// The picker walks the leagues in age order, grouped into the four stages of
// a hero's journey (QUEST_LEAGUE_DEFINITIONS' ageCategory).
export const LEAGUE_PICKER_STAGES = [
    { key: 'early', title: 'Little Explorers', icon: 'fa-shapes' },
    { key: 'junior', title: 'Junior Adventurers', icon: 'fa-seedling' },
    { key: 'mid', title: 'Pathfinders', icon: 'fa-compass' },
    { key: 'senior', title: 'Champions', icon: 'fa-crown' }
];

export function escapeLeaguePickerText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function leagueAgeLabel(ageGroup) {
    return String(ageGroup || '').replace('-', '–');
}

export function leagueStageAgeLabel(definitions) {
    const first = String(definitions[0]?.ageGroup || '');
    const last = String(definitions[definitions.length - 1]?.ageGroup || '');
    const min = first.split('-')[0].replace('+', '');
    if (last.endsWith('+')) return `Ages ${min}+`;
    const max = last.split('-').pop();
    return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
}

/** The active class ticket at the top: "Following", or one tap back while peeking. */
export function leaguePickerFollowHtml({ activeClass, peeking, currentLeague }) {
    if (!activeClass && !peeking) return '';
    const action = peeking
        ? `<button type="button" class="league-match-active-btn lp-follow__btn">
                <i class="fas fa-rotate-left" aria-hidden="true"></i><span>${activeClass ? 'Follow my class' : 'Back to my league'}</span>
            </button>`
        : `<span class="lp-follow__state"><i class="fas fa-circle-check" aria-hidden="true"></i>Following</span>`;
    const logo = activeClass?.logo
        ? `<span class="lp-follow__logo" aria-hidden="true">${activeClass.logo}</span>`
        : '<span class="lp-follow__logo lp-follow__logo--icon" aria-hidden="true"><i class="fas fa-chalkboard-teacher"></i></span>';
    const name = activeClass ? escapeLeaguePickerText(activeClass.name) : 'Your league';
    const league = activeClass?.questLevel
        ? `${escapeLeaguePickerText(activeClass.questLevel)} League`
        : 'Your selected class sets the league';
    const note = peeking && currentLeague
        ? `<span class="lp-follow__peek"><span class="lp-follow__peek-lens" aria-hidden="true"><i class="fas fa-eye"></i></span>Peeking at ${escapeLeaguePickerText(currentLeague)}</span>`
        : '';
    return `
        <div class="lp-follow${peeking ? ' is-peeking' : ''}">
            ${logo}
            <div class="lp-follow__copy">
                <span class="lp-follow__kicker">Your active class</span>
                <span class="lp-follow__name font-title">${name}</span>
                <span class="lp-follow__league"><i class="fas fa-shield-halved" aria-hidden="true"></i>${league}${note}</span>
            </div>
            ${action}
        </div>`;
}

/** One league pennant. */
export function leaguePickerCardHtml(definition, index, { currentLeague, classCounts, myCounts }) {
    const ageLabel = leagueAgeLabel(definition.ageGroup);
    const count = classCounts.get(definition.name) || 0;
    const mine = myCounts.get(definition.name) || 0;
    const isCurrent = definition.name === currentLeague;
    const countHtml = count
        ? `<span class="lp-card__count"><i class="fas fa-flag" aria-hidden="true"></i>${count} class${count === 1 ? '' : 'es'}</span>`
        : '<span class="lp-card__count lp-card__count--none">No classes yet</span>';
    const mineHtml = mine
        ? `<span class="lp-card__mine" title="${mine} of your classes race here"><i class="fas fa-star" aria-hidden="true"></i>${mine === 1 ? 'Your class' : `${mine} yours`}</span>`
        : '';
    const nowHtml = isCurrent
        ? '<span class="lp-card__now"><i class="fas fa-eye" aria-hidden="true"></i>Watching</span>'
        : '';
    const label = `${definition.name} league, ages ${ageLabel}, ${count || 'no'} class${count === 1 ? '' : 'es'}${mine ? `, ${mine} yours` : ''}${isCurrent ? ', currently shown' : ''}`;
    return `<button
            type="button"
            class="league-select-btn league-picker-option lp-pennant league-picker-option--${definition.pickerTheme}${isCurrent ? ' is-current' : ''}${count ? '' : ' is-empty'}"
            style="--league-order:${index}"
            data-league="${escapeLeaguePickerText(definition.name)}"
            aria-pressed="${isCurrent ? 'true' : 'false'}"
            aria-label="${escapeLeaguePickerText(label)}"
        >
            ${nowHtml}
            <span class="lp-pennant__rings" aria-hidden="true"></span>
            <span class="lp-pennant__shadow" aria-hidden="true"></span>
            <span class="lp-pennant__cloth">
                <span class="lp-pennant__icon" aria-hidden="true"><i class="fas ${definition.pickerIcon}"></i></span>
                <span class="league-picker-option__label">${escapeLeaguePickerText(definition.name)}</span>
                <span class="league-picker-option__age">Ages ${ageLabel}</span>
                <span class="lp-card__meta">${countHtml}${mineHtml}</span>
            </span>
        </button>`;
}

/**
 * The whole picker body.
 * @param {object} opts
 * @param {Array} opts.definitions QUEST_LEAGUE_DEFINITIONS
 * @param {string|null} opts.currentLeague the league on screen
 * @param {Map<string, number>} opts.classCounts classes per league (school)
 * @param {Map<string, number>} opts.myCounts the teacher's classes per league
 * @param {string} [opts.followHtml] the active class ticket, if any
 */
export function renderLeaguePickerHtml({ definitions, currentLeague, classCounts, myCounts, followHtml = '' }) {
    let order = 0;
    const stages = LEAGUE_PICKER_STAGES.map((stage, stageIndex) => {
        const leagues = definitions.filter((d) => d.ageCategory === stage.key);
        if (!leagues.length) return '';
        const cards = leagues
            .map((definition) => leaguePickerCardHtml(definition, order++, { currentLeague, classCounts, myCounts }))
            .join('');
        return `
            <section class="lp-stage lp-stage--${stage.key}" style="--stage-i:${stageIndex};--stage-n:${leagues.length}" aria-label="${escapeLeaguePickerText(stage.title)}">
                <div class="lp-stage__label">
                    <b class="lp-stage__step" aria-hidden="true">${stageIndex + 1}</b>
                    <span class="lp-stage__copy">
                        <span class="lp-stage__title font-title">${escapeLeaguePickerText(stage.title)}</span>
                        <span class="lp-stage__ages">${leagueStageAgeLabel(leagues)}</span>
                    </span>
                </div>
                <span class="lp-stage__rod" aria-hidden="true"></span>
                <div class="lp-stage__grid">${cards}</div>
            </section>`;
    }).join('');
    return `${followHtml}<div class="lp-gallery">${stages}</div>`;
}
