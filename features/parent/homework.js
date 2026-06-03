import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, renderTabHero, renderEmptyState } from '../roles/shared.js';

function getHomeworkItems() {
    return state.get('currentParentHomework') || [];
}

function renderHomeworkList() {
    const items = getHomeworkItems();

    return `
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Homework list</p>
                    <h3 class="role-card__title">All assignments</h3>
                </div>
                <div class="role-card__badge">${items.length} items</div>
            </div>
            ${items.length
                ? items.map((item) => `
                    <button type="button" class="role-list-row" data-parent-homework-id="${escapeHtml(item.id)}">
                        <div class="role-list-row__avatar role-list-row__avatar--amber"><i class="fas fa-book"></i></div>
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(item.title || 'Homework')}</div>
                            <div class="role-list-row__meta">${escapeHtml(formatFlexibleDate(item.lessonDate || item.updatedAt))}</div>
                        </div>
                        <i class="fas fa-chevron-right text-slate-400"></i>
                    </button>
                `).join('')
                : renderEmptyState('No homework has been shared yet. Check back after the next lesson.', { large: true })
            }
        </article>
    `;
}

function renderHomeworkDetail(item) {
    if (!item) {
        return renderEmptyState('Homework not found.', { large: true });
    }

    return `
        <button type="button" class="role-back-btn" data-parent-homework-view="list"><i class="fas fa-arrow-left"></i> Back to homework</button>
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Homework detail</p>
                    <h3 class="role-card__title">${escapeHtml(item.title || 'Homework')}</h3>
                </div>
                <div class="role-card__badge">${escapeHtml(formatFlexibleDate(item.lessonDate || item.updatedAt))}</div>
            </div>
            <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(item.body || 'No details provided.')}</div>
            ${item.teacherName ? `<p class="text-sm text-slate-500 mt-4">From: ${escapeHtml(item.teacherName)}</p>` : ''}
        </article>
    `;
}

export function renderParentHomework() {
    const view = state.get('parentView') || {};
    const items = getHomeworkItems();
    const selectedId = view.selectedHomeworkId;
    const selectedItem = items.find((item) => item.id === selectedId) || null;
    const homeworkView = view.homeworkView === 'detail' && selectedItem ? 'detail' : 'list';

    return `
        ${homeworkView === 'list' ? renderTabHero({
            icon: 'fa-book',
            iconColor: 'text-amber-500',
            title: 'Homework',
            subtitle: 'Tap an assignment to read the full details.'
        }) : ''}
        ${homeworkView === 'detail' ? renderHomeworkDetail(selectedItem) : renderHomeworkList()}
    `;
}
