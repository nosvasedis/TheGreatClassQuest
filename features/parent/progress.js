import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, renderTabHero, renderEmptyState } from '../roles/shared.js';

function getSnapshot() {
    return state.get('currentParentSnapshot') || {};
}

function renderGradeHistoryModal(history) {
    return `
        <div id="parent-progress-modal" class="fixed inset-0 bg-slate-950/60 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div class="role-card pop-in max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" style="margin:0">
                <div class="role-card__header">
                    <h3 class="role-card__title">Full grade history</h3>
                    <button type="button" id="parent-progress-modal-close" class="role-header-icon-btn" style="background:#f1f5f9;color:#475569;border-color:#e2e8f0"><i class="fas fa-times"></i></button>
                </div>
                <div class="role-message-stack custom-scrollbar flex-1">
                    ${history.length
                        ? history.map((item) => `
                            <div class="role-list-row" style="cursor:default;margin-bottom:0.35rem">
                                <div class="role-list-row__body">
                                    <div class="role-list-row__title">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                    <div class="role-list-row__meta">${escapeHtml(formatFlexibleDate(item.date))}</div>
                                </div>
                                <span class="role-score-pill">${escapeHtml(item.scoreLabel || item.label || 'N/A')}</span>
                            </div>
                        `).join('')
                        : renderEmptyState('No grades published yet.')
                    }
                </div>
            </div>
        </div>
    `;
}

export function renderParentProgress() {
    const snapshot = getSnapshot();
    const gradeHistory = snapshot.gradeHistory || [];
    const attendance = snapshot.attendanceSummary || {};
    const showModal = state.get('parentView')?.progressModalOpen;

    return `
        ${renderTabHero({
            icon: 'fa-chart-line',
            iconColor: 'text-green-600',
            title: 'Progress',
            subtitle: 'Grades and attendance at a glance.'
        })}

        <div class="role-stat-grid mb-4">
            <div class="role-stat-tile role-stat-tile--sky">
                <div class="role-stat-tile__label">Latest test</div>
                <div class="role-stat-tile__value" style="font-size:1.2rem">${escapeHtml(snapshot.latestGrade?.label || '—')}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--amber">
                <div class="role-stat-tile__label">Recent scores</div>
                <div class="role-stat-tile__value" style="font-size:1rem">${escapeHtml(snapshot.gradeAverageLabel || 'N/A')}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--emerald">
                <div class="role-stat-tile__label">Attendance</div>
                <div class="role-stat-tile__value" style="font-size:1.2rem">${escapeHtml(attendance.rateLabel || 'N/A')}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--violet">
                <div class="role-stat-tile__label">Lessons</div>
                <div class="role-stat-tile__value">${Number(attendance.lessonsHeld || 0)}</div>
            </div>
        </div>

        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Recent grades</p>
                    <h3 class="role-card__title">Latest results</h3>
                </div>
                ${gradeHistory.length > 5 ? `<button type="button" class="role-inline-link" id="parent-show-full-history">See full history</button>` : ''}
            </div>
            ${gradeHistory.length
                ? gradeHistory.slice(0, 5).map((item) => `
                    <div class="role-list-row" style="cursor:default">
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                            <div class="role-list-row__meta">${escapeHtml(formatFlexibleDate(item.date))}</div>
                        </div>
                        <span class="role-score-pill">${escapeHtml(item.scoreLabel || item.label || 'N/A')}</span>
                    </div>
                `).join('')
                : renderEmptyState('Published grades will appear here.')
            }
        </article>

        <article class="role-card">
            <p class="role-card__eyebrow">Attendance</p>
            <h3 class="role-card__title mb-3">Lesson record</h3>
            <div class="role-stat-grid">
                <div class="role-stat-tile role-stat-tile--emerald">
                    <div class="role-stat-tile__label">Rate</div>
                    <div class="role-stat-tile__value" style="font-size:1.2rem">${escapeHtml(attendance.rateLabel || 'N/A')}</div>
                </div>
                <div class="role-stat-tile role-stat-tile--sky">
                    <div class="role-stat-tile__label">Lessons held</div>
                    <div class="role-stat-tile__value">${Number(attendance.lessonsHeld || 0)}</div>
                </div>
                <div class="role-stat-tile role-stat-tile--rose">
                    <div class="role-stat-tile__label">Absences</div>
                    <div class="role-stat-tile__value">${Number(attendance.absences || 0)}</div>
                </div>
            </div>
        </article>

        ${showModal ? renderGradeHistoryModal(gradeHistory) : ''}
    `;
}
