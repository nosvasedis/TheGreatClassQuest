import * as state from '../../state.js';
import {
    escapeHtml,
    formatFlexibleDate,
    renderTabHero,
    greetingTime
} from '../roles/shared.js';
import {
    getStudentMap,
    getClassMap,
    getLatestScoreSummary,
    getThreadTypeMeta,
    getThreadStudentLabel
} from './helpers.js';

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

    return `
        ${renderTabHero({
            icon: 'fa-home',
            iconColor: 'text-cyan-500',
            title: `Good ${greetingTime()}!`,
            subtitle: 'Here is a quick look at your school today.'
        })}

        <div class="role-stat-grid mb-4">
            <div class="role-stat-tile role-stat-tile--sky card-appear" style="--stagger:0">
                <div class="role-stat-tile__label">Classes</div>
                <div class="role-stat-tile__value">${classes.length}</div>
                <div class="role-stat-tile__meta">Active classes</div>
            </div>
            <div class="role-stat-tile role-stat-tile--emerald card-appear" style="--stagger:1">
                <div class="role-stat-tile__label">Students</div>
                <div class="role-stat-tile__value">${students.length}</div>
                <div class="role-stat-tile__meta">Enrolled students</div>
            </div>
            <div class="role-stat-tile role-stat-tile--amber card-appear" style="--stagger:2">
                <div class="role-stat-tile__label">Stars</div>
                <div class="role-stat-tile__value">${totalStars}</div>
                <div class="role-stat-tile__meta">Earned schoolwide</div>
            </div>
            <div class="role-stat-tile role-stat-tile--violet card-appear" style="--stagger:3">
                <div class="role-stat-tile__label">Gold</div>
                <div class="role-stat-tile__value">${totalGold}</div>
                <div class="role-stat-tile__meta">Student gold total</div>
            </div>
        </div>

        <article class="role-card card-appear" style="--stagger:4">
            <p class="role-card__eyebrow">Quick links</p>
            <h3 class="role-card__title mb-3">Jump to a section</h3>
            <div class="role-shortcut-grid">
                <button type="button" class="tool-btn-pop" data-secretary-tab-link="school">
                    <i class="fas fa-school text-sky-500"></i><span>Classes & Students</span>
                </button>
                <button type="button" class="tool-btn-pop" data-secretary-tab-link="grades">
                    <i class="fas fa-chart-bar text-amber-500"></i><span>Grades</span>
                </button>
                <button type="button" class="tool-btn-pop" data-secretary-tab-link="messages">
                    <i class="fas fa-comments text-violet-500"></i><span>Messages${unreadThreads > 0 ? ` (${unreadThreads})` : ''}</span>
                </button>
                <button type="button" class="tool-btn-pop" data-secretary-tab-link="admin">
                    <i class="fas fa-cog text-indigo-500"></i><span>Admin</span>
                </button>
            </div>
        </article>

        <div class="grid gap-4 md:grid-cols-2">
            <article class="role-card card-appear" style="--stagger:5">
                <div class="role-card__header">
                    <div>
                        <p class="role-card__eyebrow">Latest grade</p>
                        <h3 class="role-card__title">Most recent entry</h3>
                    </div>
                    <button type="button" class="role-inline-link" data-secretary-tab-link="grades">See all</button>
                </div>
                ${latestScoreInfo
                    ? `<div class="role-list-row" style="cursor:default;margin-bottom:0">
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(latestScoreInfo.score.title || latestScoreInfo.score.type || 'Assessment')}</div>
                            <div class="role-list-row__meta">${escapeHtml(latestScoreInfo.student?.name || 'Student')} • ${escapeHtml(latestScoreInfo.classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(latestScoreInfo.score.date))}</div>
                        </div>
                        <span class="role-score-pill">${escapeHtml(latestScoreInfo.label)}</span>
                    </div>`
                    : '<div class="role-empty-state">Grades will appear here once teachers record them.</div>'
                }
            </article>

            <article class="role-card card-appear" style="--stagger:6">
                <div class="role-card__header">
                    <div>
                        <p class="role-card__eyebrow">Latest message</p>
                        <h3 class="role-card__title">Most recent family thread</h3>
                    </div>
                    <button type="button" class="role-inline-link" data-secretary-tab-link="messages">See all</button>
                </div>
                ${latestThread
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
                    : '<div class="role-empty-state">Messages will appear once teachers share updates with families.</div>'
                }
            </article>
        </div>
    `;
}
