import * as state from '../../state.js';
import { escapeHtml, renderTabHero } from '../roles/shared.js';
import { celebrationEmoji } from './helpers.js';

function getSnapshot() {
    return state.get('currentParentSnapshot') || {};
}

export function renderParentHome() {
    const snapshot = getSnapshot();
    const studentName = snapshot.studentName || 'Your child';
    const className = snapshot.className || 'Class';
    const schoolName = snapshot.schoolName || state.get('schoolName') || '';
    const progress = snapshot.progress || {};
    const recentCelebrations = snapshot.recentCelebrations || [];
    const publishedNotes = snapshot.publishedNotes || [];

    return `
        ${renderTabHero({
            icon: 'fa-home',
            iconColor: 'text-cyan-500',
            title: `${escapeHtml(studentName)}'s progress`,
            subtitle: schoolName
                ? `See how ${escapeHtml(studentName)} is doing at ${escapeHtml(schoolName)}.`
                : `Class: ${escapeHtml(className)}`
        })}

        <article class="role-card">
            <div class="role-hero-card">
                <div class="role-hero-avatar">${escapeHtml((studentName || '?').charAt(0).toUpperCase())}</div>
                <div>
                    <h3 class="role-card__title">${escapeHtml(studentName)}</h3>
                    <p class="text-sm text-slate-600 mt-1">${escapeHtml(className)}${snapshot.questLevel ? ` • ${escapeHtml(snapshot.questLevel)}` : ''}</p>
                </div>
            </div>
            <div class="role-stat-grid">
                <div class="role-stat-tile role-stat-tile--amber">
                    <div class="role-stat-tile__label">Total stars</div>
                    <div class="role-stat-tile__value">${Number(progress.totalStars || 0)}</div>
                </div>
                <div class="role-stat-tile role-stat-tile--violet">
                    <div class="role-stat-tile__label">This month</div>
                    <div class="role-stat-tile__value">${Number(progress.monthlyStars || 0)}</div>
                </div>
                <div class="role-stat-tile role-stat-tile--emerald">
                    <div class="role-stat-tile__label">Attendance</div>
                    <div class="role-stat-tile__value" style="font-size:1.25rem">${escapeHtml(snapshot.attendanceSummary?.rateLabel || 'N/A')}</div>
                </div>
                <div class="role-stat-tile role-stat-tile--sky">
                    <div class="role-stat-tile__label">Homework</div>
                    <div class="role-stat-tile__value">${Number(snapshot.homeworkCount || 0)}</div>
                </div>
            </div>
        </article>

        <article class="role-card">
            <p class="role-card__eyebrow">Quick links</p>
            <h3 class="role-card__title mb-3">Where would you like to go?</h3>
            <div class="role-shortcut-grid">
                <button type="button" class="tool-btn-pop" data-parent-tab-link="homework">
                    <i class="fas fa-book text-amber-500"></i><span>Homework</span>
                </button>
                <button type="button" class="tool-btn-pop" data-parent-tab-link="progress">
                    <i class="fas fa-chart-line text-green-500"></i><span>Progress</span>
                </button>
                <button type="button" class="tool-btn-pop" data-parent-tab-link="messages">
                    <i class="fas fa-envelope text-purple-500"></i><span>Messages</span>
                </button>
            </div>
        </article>

        <div class="grid gap-4 md:grid-cols-2">
            <article class="role-card">
                <p class="role-card__eyebrow">At a glance</p>
                <h3 class="role-card__title mb-3">Latest results</h3>
                <div class="role-stat-grid">
                    <div class="role-stat-tile role-stat-tile--sky">
                        <div class="role-stat-tile__label">Latest test</div>
                        <div class="role-stat-tile__value" style="font-size:1.15rem">${escapeHtml(snapshot.latestGrade?.label || '—')}</div>
                    </div>
                    <div class="role-stat-tile role-stat-tile--amber">
                        <div class="role-stat-tile__label">Recent scores</div>
                        <div class="role-stat-tile__value" style="font-size:1rem">${escapeHtml(snapshot.gradeAverageLabel || 'N/A')}</div>
                    </div>
                </div>
                <p class="text-sm text-slate-500 mt-3">Next lesson: ${escapeHtml(snapshot.nextLessonLabel || 'Not scheduled yet')}</p>
            </article>

            <article class="role-card">
                <p class="role-card__eyebrow">Star moments</p>
                <h3 class="role-card__title mb-3">Recent celebrations</h3>
                ${recentCelebrations.length
                    ? recentCelebrations.slice(0, 3).map((item, i) => `
                        <div class="role-preview-chip">
                            <span>${celebrationEmoji(item)}</span>
                            <div class="role-preview-chip__title">${escapeHtml(item.title || item.reason || 'Celebration')}</div>
                            ${item.description ? `<div class="role-preview-chip__body">${escapeHtml(item.description)}</div>` : ''}
                        </div>
                    `).join('')
                    : '<div class="role-empty-state">New celebrations will appear here.</div>'
                }
            </article>
        </div>

        <article class="role-card">
            <p class="role-card__eyebrow">Messages from teacher</p>
            <h3 class="role-card__title mb-3">Latest notes</h3>
            ${publishedNotes.length
                ? publishedNotes.slice(0, 3).map((item) => `
                    <div class="role-preview-chip">
                        <div class="role-preview-chip__title">${escapeHtml(item.label || 'Teacher note')}</div>
                        <div class="role-preview-chip__body">${escapeHtml(item.body || item.text || '')}</div>
                    </div>
                `).join('')
                : '<div class="role-empty-state">No notes published yet.</div>'
            }
        </article>
    `;
}

export function updateParentHeader(snapshot) {
    const studentName = snapshot.studentName || 'Your child';
    const schoolName = snapshot.schoolName || state.get('schoolName') || 'Your school';
    const titleEl = document.querySelector('[data-parent-title]');
    const subtitleEl = document.querySelector('[data-parent-student-name]');
    if (titleEl) titleEl.textContent = `${studentName}'s Progress`;
    if (subtitleEl) {
        subtitleEl.textContent = snapshot.studentName
            ? `See how ${studentName} is doing at ${schoolName}.`
            : 'Waiting for school data...';
    }
}
