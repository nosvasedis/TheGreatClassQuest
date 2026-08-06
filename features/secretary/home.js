import * as state from '../../state.js';
import {
    escapeHtml,
    formatFlexibleDate,
    greetingTime
} from '../roles/shared.js';
import {
    getStudentMap,
    getClassMap,
    getLatestScoreSummary,
    getThreadTypeMeta,
    getThreadStudentLabel
} from './helpers.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';

export function renderSecretaryHome() {
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const threads = state.get('currentCommunicationThreads') || [];
    const totalStars = scores.reduce((sum, item) => sum + Number(item.totalStars || 0), 0);
    const totalGold = scores.reduce((sum, item) => sum + Number(item.gold || 0), 0);
    const unreadThreads = threads.filter((t) => !t.lastReadAt || t.lastReadAt < t.lastMessageAt).length;
    const latestThread = threads[0] || null;
    const latestScoreInfo = getLatestScoreSummary();
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const profile = state.get('currentUserProfile') || {};
    const schoolName = state.get('schoolName') || 'Your school';
    const hasFullConsole = canUseFeature('secretaryAccess');
    const tier = String(getTier() || 'starter');
    const secretaryName = profile.displayName || 'Secretary';

    return `
        <div class="secretary-home">
            <section class="secretary-home-hero card-appear" style="--stagger:0">
                <div class="secretary-home-hero__copy">
                    <span class="secretary-home-hero__badge"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> ${escapeHtml(schoolName)}</span>
                    <p class="secretary-home-hero__hello">Good ${greetingTime()}, ${escapeHtml(secretaryName)}!</p>
                    <h2 class="secretary-home-hero__title">Your school day,<br><span>beautifully organised.</span></h2>
                    <p class="secretary-home-hero__description">See what is happening, find anyone quickly, and keep the whole school moving from one calm place.</p>
                    <div class="secretary-home-hero__actions">
                        <button type="button" class="secretary-home-primary-action" data-secretary-tab-link="school">
                            <i class="fas fa-school" aria-hidden="true"></i> Browse your school
                        </button>
                        <button type="button" class="secretary-home-secondary-action" data-secretary-tab-link="admin">
                            <i class="fas fa-sliders" aria-hidden="true"></i> School settings
                        </button>
                    </div>
                </div>
                <div class="secretary-home-hero__visual" aria-hidden="true">
                    <div class="secretary-home-hero__orb">
                        <i class="fas fa-school-flag"></i>
                    </div>
                    <span class="secretary-home-float secretary-home-float--classes"><i class="fas fa-chalkboard"></i><strong>${classes.length}</strong> classes</span>
                    <span class="secretary-home-float secretary-home-float--students"><i class="fas fa-user-graduate"></i><strong>${students.length}</strong> students</span>
                    <span class="secretary-home-float secretary-home-float--ready"><i class="fas fa-circle-check"></i> Ready for today</span>
                </div>
            </section>

            <section class="secretary-home-section card-appear" style="--stagger:1" aria-labelledby="secretary-home-shortcuts-title">
                <div class="secretary-home-section__heading">
                    <div>
                        <p class="role-card__eyebrow">Where would you like to go?</p>
                        <h3 id="secretary-home-shortcuts-title" class="role-card__title">Quick actions</h3>
                    </div>
                    <span class="secretary-home-plan"><i class="fas fa-gem" aria-hidden="true"></i> ${escapeHtml(tier)} plan</span>
                </div>
                <div class="secretary-home-shortcuts">
                    <button type="button" class="secretary-home-shortcut secretary-home-shortcut--sky" data-secretary-tab-link="school" data-secretary-school-subtab="classes">
                        <span class="secretary-home-shortcut__icon"><i class="fas fa-chalkboard"></i></span>
                        <span><strong>Find a class</strong><small>Schedules, levels and teachers</small></span>
                        <i class="fas fa-arrow-right secretary-home-shortcut__arrow"></i>
                    </button>
                    <button type="button" class="secretary-home-shortcut secretary-home-shortcut--emerald" data-secretary-tab-link="school" data-secretary-school-subtab="students">
                        <span class="secretary-home-shortcut__icon"><i class="fas fa-user-graduate"></i></span>
                        <span><strong>Find a student</strong><small>Details, notes and family access</small></span>
                        <i class="fas fa-arrow-right secretary-home-shortcut__arrow"></i>
                    </button>
                    ${hasFullConsole ? `<button type="button" class="secretary-home-shortcut secretary-home-shortcut--amber" data-secretary-tab-link="grades">
                        <span class="secretary-home-shortcut__icon"><i class="fas fa-chart-simple"></i></span>
                        <span><strong>Review grades</strong><small>The latest school results</small></span>
                        <i class="fas fa-arrow-right secretary-home-shortcut__arrow"></i>
                    </button>
                    <button type="button" class="secretary-home-shortcut secretary-home-shortcut--violet" data-secretary-tab-link="messages">
                        <span class="secretary-home-shortcut__icon"><i class="fas fa-comments"></i></span>
                        <span><strong>Open messages</strong><small>${unreadThreads ? `${unreadThreads} conversation${unreadThreads === 1 ? '' : 's'} to check` : 'You are all caught up'}</small></span>
                        <i class="fas fa-arrow-right secretary-home-shortcut__arrow"></i>
                    </button>` : ''}
                </div>
            </section>

            <section class="secretary-home-stats" aria-label="School at a glance">
                <article class="secretary-home-stat secretary-home-stat--sky card-appear" style="--stagger:2">
                    <span class="secretary-home-stat__icon"><i class="fas fa-chalkboard"></i></span>
                    <div><span>Classes</span><strong>${classes.length.toLocaleString()}</strong><small>Across the school</small></div>
                </article>
                <article class="secretary-home-stat secretary-home-stat--emerald card-appear" style="--stagger:3">
                    <span class="secretary-home-stat__icon"><i class="fas fa-user-graduate"></i></span>
                    <div><span>Students</span><strong>${students.length.toLocaleString()}</strong><small>Learning with you</small></div>
                </article>
                <article class="secretary-home-stat secretary-home-stat--amber card-appear" style="--stagger:4">
                    <span class="secretary-home-stat__icon"><i class="fas fa-star"></i></span>
                    <div><span>Stars</span><strong>${totalStars.toLocaleString()}</strong><small>Celebrated so far</small></div>
                </article>
                <article class="secretary-home-stat secretary-home-stat--violet card-appear" style="--stagger:5">
                    <span class="secretary-home-stat__icon"><i class="fas fa-coins"></i></span>
                    <div><span>Gold</span><strong>${totalGold.toLocaleString()}</strong><small>Earned by students</small></div>
                </article>
            </section>

            <div class="secretary-home-feed">
                <article class="role-card secretary-home-update-card card-appear" style="--stagger:6">
                <div class="role-card__header">
                    <div>
                            <p class="role-card__eyebrow">Latest school update</p>
                            <h3 class="role-card__title">A new grade</h3>
                    </div>
                        ${hasFullConsole ? '<button type="button" class="role-inline-link" data-secretary-tab-link="grades">See all grades</button>' : ''}
                </div>
                ${latestScoreInfo
                        ? `<div class="secretary-home-update">
                            <span class="secretary-home-update__icon secretary-home-update__icon--amber"><i class="fas fa-star"></i></span>
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(latestScoreInfo.score.title || latestScoreInfo.score.type || 'Assessment')}</div>
                            <div class="role-list-row__meta">${escapeHtml(latestScoreInfo.student?.name || 'Student')} • ${escapeHtml(latestScoreInfo.classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(latestScoreInfo.score.date))}</div>
                        </div>
                        <span class="role-score-pill">${escapeHtml(latestScoreInfo.label)}</span>
                    </div>`
                        : '<div class="role-empty-state">New grades will appear here when teachers add them.</div>'
                }
            </article>

                <article class="role-card secretary-home-update-card card-appear" style="--stagger:7">
                <div class="role-card__header">
                    <div>
                            <p class="role-card__eyebrow">Family connection</p>
                            <h3 class="role-card__title">Latest conversation</h3>
                    </div>
                        ${hasFullConsole ? '<button type="button" class="role-inline-link" data-secretary-tab-link="messages">Open inbox</button>' : ''}
                </div>
                    ${latestThread && hasFullConsole
                    ? (() => {
                        const meta = getThreadTypeMeta(latestThread.threadType);
                        const labels = getThreadStudentLabel(latestThread, studentMap, classMap);
                        return `<button type="button" class="role-inbox-item role-inbox-item--active" data-secretary-thread="${latestThread.id}" data-secretary-open-messages="1" style="margin-bottom:0">
                            <div class="role-inbox-item__icon role-inbox-item__icon--${meta.tone}"><i class="fas ${meta.icon}"></i></div>
                            <div>
                                <div class="role-inbox-item__title">${escapeHtml(meta.label)}</div>
                                <div class="role-inbox-item__meta">${escapeHtml(labels.studentName)} • ${escapeHtml(labels.className)}</div>
                            </div>
                        </button>`;
                    })()
                        : `<div class="role-empty-state">${hasFullConsole ? 'Family conversations will appear here when they begin.' : 'Family messaging is available with the Elite plan.'}</div>`
                }
            </article>
            </div>
        </div>
    `;
}
