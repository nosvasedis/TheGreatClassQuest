import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { db, doc, setDoc, writeBatch } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import { postCommunicationMessage, backfillRoleAccessData } from '../utils/adminRuntime.js';
import {
    getAssessmentDefaultsEditorHtml,
    getAssessmentConfigCardHtml,
    readAssessmentCardValue,
    readAssessmentDefaultsFromContainer,
    wireAssessmentEditor
} from '../ui/assessmentEditor.js';
import {
    describeAssessmentScheme,
    getAssessmentValueLabel,
    getNormalizedPercentForScore,
    getSchoolAssessmentDefaults,
    normalizeAssessmentDefaultsByLeague,
    normalizeClassAssessmentConfig
} from './assessmentConfig.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
let listenersWired = false;
let secretaryCallbacks = {
    onLogout: null,
    onOpenTeacherView: null,
    onSelectThread: null
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFlexibleDate(value, withTime = false) {
    if (!value) return 'Unknown';
    const options = withTime
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', options);
    }
    if (value?.toDate) {
        return value.toDate().toLocaleString('en-GB', options);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('en-GB', options);
}

function initials(value) {
    return String(value || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';
}

function getThreadTypeMeta(threadType) {
    const type = String(threadType || 'message').trim().toLowerCase();
    const metaMap = {
        homework: { label: 'Homework Dispatch', icon: 'fa-scroll', tone: 'sky' },
        'progress-share': { label: 'Progress Share', icon: 'fa-chart-line', tone: 'emerald' },
        celebration: { label: 'Celebration', icon: 'fa-star', tone: 'amber' },
        'attendance-alert': { label: 'Attendance Alert', icon: 'fa-calendar-xmark', tone: 'rose' },
        'meeting-request': { label: 'Meeting Request', icon: 'fa-handshake', tone: 'violet' },
        'admin-announcement': { label: 'Admin Announcement', icon: 'fa-bullhorn', tone: 'indigo' }
    };
    return metaMap[type] || { label: 'School Message', icon: 'fa-envelope-open-text', tone: 'slate' };
}

function getStudentMap() {
    return new Map((state.get('allStudents') || []).map((item) => [item.id, item]));
}

function getClassMap() {
    return new Map((state.get('allSchoolClasses') || []).map((item) => [item.id, item]));
}

function getStudentScoreMap() {
    return new Map((state.get('allStudentScores') || []).map((item) => [item.id, item]));
}

function getLatestScoresByStudent() {
    const latestMap = new Map();
    (state.get('allWrittenScores') || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .forEach((item) => {
            if (item.studentId && !latestMap.has(item.studentId)) {
                latestMap.set(item.studentId, item);
            }
        });
    return latestMap;
}

function filteredClasses() {
    const query = String(state.get('secretaryView')?.classFilter || '').trim().toLowerCase();
    const classes = state.get('allSchoolClasses') || [];
    if (!query) return classes;
    return classes.filter((item) =>
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.questLevel || '').toLowerCase().includes(query) ||
        String(item.createdBy?.name || '').toLowerCase().includes(query)
    );
}

function filteredStudents() {
    const query = String(state.get('secretaryView')?.studentFilter || '').trim().toLowerCase();
    const students = state.get('allStudents') || [];
    if (!query) return students;
    return students.filter((item) =>
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.heroClass || '').toLowerCase().includes(query)
    );
}

function getActiveThread() {
    const threads = state.get('currentCommunicationThreads') || [];
    const selectedThreadId = state.get('currentCommunicationThreadId');
    return threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null;
}

function getThreadStudentLabel(thread, studentMap, classMap) {
    const student = studentMap.get(thread.studentId);
    const classData = student ? classMap.get(student.classId) : null;
    return {
        studentName: student?.name || thread.studentName || 'Linked student',
        className: classData?.name || thread.className || 'Class not found'
    };
}

function setBusyState(button, isBusy, busyLabel) {
    if (!button) return;
    if (!button.dataset.idleHtml) {
        button.dataset.idleHtml = button.innerHTML;
    }
    button.disabled = isBusy;
    button.classList.toggle('opacity-70', isBusy);
    button.classList.toggle('cursor-wait', isBusy);
    button.innerHTML = isBusy
        ? `<i class="fas fa-spinner fa-spin mr-2"></i>${escapeHtml(busyLabel)}`
        : button.dataset.idleHtml;
}

function renderOverviewSection() {
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const writtenScores = state.get('allWrittenScores') || [];
    const threads = state.get('currentCommunicationThreads') || [];
    const notes = state.get('allHeroChronicleNotes') || [];
    const attendance = state.get('allAttendanceRecords') || [];
    const totalStars = scores.reduce((sum, item) => sum + Number(item.totalStars || 0), 0);
    const totalGold = scores.reduce((sum, item) => sum + Number(item.gold || 0), 0);
    const latestThreads = threads.slice(0, 4);
    const latestScores = writtenScores.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 4);
    const studentMap = getStudentMap();
    const classMap = getClassMap();

    return `
        <section class="secretary-hero">
            <div class="secretary-hero__copy">
                <p class="secretary-hero__eyebrow">Elite Oversight</p>
                <h2 class="secretary-hero__title">A front-office view that actually controls the school day.</h2>
                <p class="secretary-hero__body">Track classes, intervene in academics, monitor family communication, and manage the school's grading framework without dropping into a bare admin list.</p>
                <div class="secretary-hero__actions">
                    <button type="button" class="secretary-hero__primary" data-secretary-tab-link="communications">
                        <i class="fas fa-comments mr-2"></i>Open Communications
                    </button>
                    <button type="button" class="secretary-hero__secondary" data-secretary-tab-link="settings">
                        <i class="fas fa-sliders mr-2"></i>Open Governance
                    </button>
                </div>
            </div>
            <div class="secretary-hero__ledger">
                <div class="secretary-ledger-card secretary-ledger-card--sky">
                    <div class="secretary-ledger-card__label">Classes</div>
                    <div class="secretary-ledger-card__value">${classes.length}</div>
                    <div class="secretary-ledger-card__meta">Live across every league</div>
                </div>
                <div class="secretary-ledger-card secretary-ledger-card--emerald">
                    <div class="secretary-ledger-card__label">Students</div>
                    <div class="secretary-ledger-card__value">${students.length}</div>
                    <div class="secretary-ledger-card__meta">Roster in one place</div>
                </div>
                <div class="secretary-ledger-card secretary-ledger-card--amber">
                    <div class="secretary-ledger-card__label">Total Stars</div>
                    <div class="secretary-ledger-card__value">${totalStars}</div>
                    <div class="secretary-ledger-card__meta">Schoolwide hero progress</div>
                </div>
                <div class="secretary-ledger-card secretary-ledger-card--violet">
                    <div class="secretary-ledger-card__label">Treasury</div>
                    <div class="secretary-ledger-card__value">${totalGold}</div>
                    <div class="secretary-ledger-card__meta">Combined student gold</div>
                </div>
            </div>
        </section>

        <div class="secretary-overview-grid">
            <article class="secretary-card secretary-card--featured">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">School Pulse</p>
                        <h3 class="secretary-card__title">What needs attention today</h3>
                    </div>
                </div>
                <div class="secretary-pulse-grid">
                    <div class="secretary-pulse-chip">
                        <i class="fas fa-pen-nib"></i>
                        <div>
                            <strong>${writtenScores.length}</strong>
                            <span>recorded assessments in the current feed</span>
                        </div>
                    </div>
                    <div class="secretary-pulse-chip">
                        <i class="fas fa-book-open"></i>
                        <div>
                            <strong>${notes.length}</strong>
                            <span>hero chronicle notes visible schoolwide</span>
                        </div>
                    </div>
                    <div class="secretary-pulse-chip">
                        <i class="fas fa-comments"></i>
                        <div>
                            <strong>${threads.length}</strong>
                            <span>parent communication threads in motion</span>
                        </div>
                    </div>
                    <div class="secretary-pulse-chip">
                        <i class="fas fa-user-clock"></i>
                        <div>
                            <strong>${attendance.length}</strong>
                            <span>recent attendance entries available to inspect</span>
                        </div>
                    </div>
                </div>
            </article>

            <article class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">Recent Assessments</p>
                        <h3 class="secretary-card__title">Latest academic activity</h3>
                    </div>
                    <button type="button" class="secretary-inline-link" data-secretary-tab-link="academics">Open academics</button>
                </div>
                <div class="secretary-stack">
                    ${latestScores.length
                        ? latestScores.map((item) => {
                            const student = studentMap.get(item.studentId);
                            const classData = classMap.get(item.classId);
                            const label = getAssessmentValueLabel(item, classData) || item.scoreQualitative || 'Pending';
                            return `
                                <div class="secretary-feed-item">
                                    <div class="secretary-feed-item__icon"><i class="fas fa-feather-pointed"></i></div>
                                    <div>
                                        <div class="font-semibold text-slate-800">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                        <div class="text-sm text-slate-500 mt-1">${escapeHtml(student?.name || 'Student')} • ${escapeHtml(classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(item.date))}</div>
                                    </div>
                                    <div class="secretary-score-pill">${escapeHtml(label)}</div>
                                </div>
                            `;
                        }).join('')
                        : '<div class="secretary-empty">Academic results will appear here as soon as teachers record them.</div>'
                    }
                </div>
            </article>

            <article class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">Family Inbox</p>
                        <h3 class="secretary-card__title">Newest parent-facing threads</h3>
                    </div>
                    <button type="button" class="secretary-inline-link" data-secretary-tab-link="communications">Reply now</button>
                </div>
                <div class="secretary-stack">
                    ${latestThreads.length
                        ? latestThreads.map((thread) => {
                            const meta = getThreadTypeMeta(thread.threadType);
                            const labels = getThreadStudentLabel(thread, studentMap, classMap);
                            return `
                                <button type="button" class="secretary-thread-spark" data-secretary-thread="${thread.id}" data-secretary-tab-jump="communications">
                                    <div class="secretary-thread-spark__icon secretary-thread-spark__icon--${meta.tone}">
                                        <i class="fas ${meta.icon}"></i>
                                    </div>
                                    <div class="secretary-thread-spark__body">
                                        <div class="font-semibold text-slate-800">${escapeHtml(meta.label)}</div>
                                        <div class="text-sm text-slate-500 mt-1">${escapeHtml(labels.studentName)} • ${escapeHtml(labels.className)}</div>
                                        <div class="text-xs text-slate-400 mt-2">${escapeHtml(thread.previewText || 'Open to inspect the thread.')}</div>
                                    </div>
                                </button>
                            `;
                        }).join('')
                        : '<div class="secretary-empty">No parent threads yet. Once teachers publish homework or summaries, the secretary inbox will populate here.</div>'
                    }
                </div>
            </article>
        </div>
    `;
}

function renderClassSection() {
    const classes = filteredClasses().slice().sort((a, b) => a.name.localeCompare(b.name));
    const students = state.get('allStudents') || [];
    const writtenScores = state.get('allWrittenScores') || [];

    return `
        <article class="secretary-card">
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">Class Atlas</p>
                    <h3 class="secretary-card__title">Every class, with context</h3>
                </div>
                <div class="secretary-card__badge">${classes.length} visible</div>
            </div>
            <div class="secretary-class-grid">
                ${classes.length
                    ? classes.map((item) => {
                        const classStudents = students.filter((student) => student.classId === item.id);
                        const classScores = writtenScores.filter((score) => score.classId === item.id);
                        const schedule = (item.scheduleDays || [])
                            .map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
                            .join(', ');
                        return `
                            <article class="secretary-class-card">
                                <div class="secretary-class-card__crest">${escapeHtml(item.logo || '📚')}</div>
                                <div class="secretary-class-card__body">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 class="secretary-class-card__title">${escapeHtml(item.name)}</h4>
                                            <div class="secretary-class-card__subtitle">${escapeHtml(item.questLevel || 'League')} • ${escapeHtml(item.createdBy?.name || 'Teacher')}</div>
                                        </div>
                                        <button type="button" class="secretary-chip-btn" data-secretary-edit-class="${item.id}">Edit Class</button>
                                    </div>
                                    <div class="secretary-class-card__stats">
                                        <div><strong>${classStudents.length}</strong><span>students</span></div>
                                        <div><strong>${classScores.length}</strong><span>assessments</span></div>
                                        <div><strong>${escapeHtml(item.timeStart || 'TBD')}</strong><span>starts</span></div>
                                    </div>
                                    <div class="secretary-class-card__schedule">${escapeHtml(schedule || 'Schedule not set')}</div>
                                </div>
                            </article>
                        `;
                    }).join('')
                    : '<div class="secretary-empty">No classes match the current filter.</div>'
                }
            </div>
        </article>
    `;
}

function renderStudentSection() {
    const students = filteredStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const classMap = getClassMap();
    const scoreMap = getStudentScoreMap();
    const latestScores = getLatestScoresByStudent();
    const threads = state.get('currentCommunicationThreads') || [];

    return `
        <article class="secretary-card">
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">Student Ledger</p>
                    <h3 class="secretary-card__title">Students with the right details at first glance</h3>
                </div>
                <div class="secretary-card__badge">${students.length} visible</div>
            </div>
            <div class="secretary-student-grid">
                ${students.length
                    ? students.map((student) => {
                        const classData = classMap.get(student.classId);
                        const score = scoreMap.get(student.id) || {};
                        const latestScore = latestScores.get(student.id);
                        const thread = threads.find((item) => item.studentId === student.id);
                        return `
                            <article class="secretary-student-card">
                                <div class="secretary-student-card__avatar">${escapeHtml(initials(student.name))}</div>
                                <div class="secretary-student-card__content">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 class="secretary-student-card__name">${escapeHtml(student.name)}</h4>
                                            <div class="secretary-student-card__meta">${escapeHtml(classData?.name || 'Class missing')} • ${escapeHtml(student.heroClass || 'Hero path')}</div>
                                        </div>
                                        <div class="secretary-score-pill secretary-score-pill--soft">${Number(score.totalStars || 0)} stars</div>
                                    </div>
                                    <div class="secretary-student-card__facts">
                                        <div><span>Latest grade</span><strong>${escapeHtml(latestScore ? (getAssessmentValueLabel(latestScore, classData) || latestScore.scoreQualitative || 'Recorded') : 'No grade yet')}</strong></div>
                                        <div><span>Hero level</span><strong>${Number(score.heroLevel || 0)}</strong></div>
                                        <div><span>Gold</span><strong>${Number(score.gold || 0)}</strong></div>
                                    </div>
                                    <div class="secretary-student-card__actions">
                                        <button type="button" class="secretary-chip-btn" data-secretary-edit-student="${student.id}">Edit</button>
                                        <button type="button" class="secretary-chip-btn secretary-chip-btn--emerald" data-secretary-chronicle="${student.id}">Chronicle</button>
                                        <button type="button" class="secretary-chip-btn secretary-chip-btn--violet ${thread ? '' : 'opacity-50'}" ${thread ? `data-secretary-thread="${thread.id}" data-secretary-tab-jump="communications"` : 'disabled'}>${thread ? 'Message Family' : 'No Thread Yet'}</button>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')
                    : '<div class="secretary-empty">No students match the current filter.</div>'
                }
            </div>
        </article>
    `;
}

function renderAcademicSection() {
    const scores = (state.get('allWrittenScores') || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const numericScores = scores.filter((item) => item.gradingMode !== 'qualitative');
    const qualitativeScores = scores.length - numericScores.length;
    const normalizedValues = scores
        .map((item) => getNormalizedPercentForScore(item, classMap.get(item.classId)))
        .filter((value) => Number.isFinite(value));
    const averagePercent = normalizedValues.length
        ? `${Math.round(normalizedValues.reduce((sum, value) => sum + value, 0) / normalizedValues.length)}%`
        : 'N/A';

    return `
        <div class="grid gap-5">
            <div class="secretary-stat-grid">
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Assessments Loaded</p>
                    <h3 class="secretary-card__metric">${scores.length}</h3>
                    <p class="text-sm text-slate-500">Recent written score records schoolwide</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Average Normalized</p>
                    <h3 class="secretary-card__metric">${escapeHtml(averagePercent)}</h3>
                    <p class="text-sm text-slate-500">Cross-mode comparison across numeric and word scales</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Numeric Records</p>
                    <h3 class="secretary-card__metric">${numericScores.length}</h3>
                    <p class="text-sm text-slate-500">Traditional score entries</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Word Scale Records</p>
                    <h3 class="secretary-card__metric">${qualitativeScores}</h3>
                    <p class="text-sm text-slate-500">Qualitative grading entries</p>
                </article>
            </div>

            <article class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">Academic Feed</p>
                        <h3 class="secretary-card__title">Readable results, not raw ids</h3>
                    </div>
                    <button type="button" class="secretary-inline-link" data-secretary-tab-link="settings">Edit grading rules</button>
                </div>
                <div class="secretary-academic-list">
                    ${scores.length
                        ? scores.slice(0, 30).map((item) => {
                            const student = studentMap.get(item.studentId);
                            const classData = classMap.get(item.classId);
                            const label = getAssessmentValueLabel(item, classData) || item.scoreQualitative || 'Recorded';
                            const normalizedPercent = getNormalizedPercentForScore(item, classData);
                            return `
                                <article class="secretary-academic-row">
                                    <div class="secretary-academic-row__main">
                                        <div class="secretary-academic-row__title">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                        <div class="secretary-academic-row__meta">${escapeHtml(student?.name || 'Student')} • ${escapeHtml(classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(item.date))}</div>
                                    </div>
                                    <div class="secretary-academic-row__badges">
                                        ${normalizedPercent !== null ? `<span class="secretary-score-pill">${normalizedPercent}%</span>` : ''}
                                        <span class="secretary-score-pill secretary-score-pill--soft">${escapeHtml(label)}</span>
                                    </div>
                                </article>
                            `;
                        }).join('')
                        : '<div class="secretary-empty">No academic results loaded yet.</div>'
                    }
                </div>
            </article>
        </div>
    `;
}

function renderCommunicationSection() {
    const threads = state.get('currentCommunicationThreads') || [];
    const activeThread = getActiveThread();
    const messages = state.get('currentCommunicationMessages') || [];
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const labels = activeThread ? getThreadStudentLabel(activeThread, studentMap, classMap) : null;
    const activeMeta = getThreadTypeMeta(activeThread?.threadType);

    return `
        <div class="secretary-message-layout">
            <article class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">Thread Navigator</p>
                        <h3 class="secretary-card__title">Inbox with context</h3>
                    </div>
                    <div class="secretary-card__badge">${threads.length} threads</div>
                </div>
                <div class="secretary-list secretary-list--threads">
                    ${threads.length
                        ? threads.map((thread) => {
                            const meta = getThreadTypeMeta(thread.threadType);
                            const threadLabels = getThreadStudentLabel(thread, studentMap, classMap);
                            return `
                                <button type="button" class="secretary-thread-btn ${thread.id === activeThread?.id ? 'secretary-thread-btn-active' : ''}" data-secretary-thread="${thread.id}">
                                    <div class="secretary-thread-btn__icon secretary-thread-btn__icon--${meta.tone}">
                                        <i class="fas ${meta.icon}"></i>
                                    </div>
                                    <div class="secretary-thread-btn__body">
                                        <div class="secretary-thread-btn__title">${escapeHtml(meta.label)}</div>
                                        <div class="secretary-thread-btn__meta">${escapeHtml(threadLabels.studentName)} • ${escapeHtml(threadLabels.className)}</div>
                                        <div class="secretary-thread-btn__preview">${escapeHtml(thread.previewText || 'Open this thread to inspect the full conversation.')}</div>
                                    </div>
                                </button>
                            `;
                        }).join('')
                        : '<div class="secretary-empty">No communication threads yet. Teacher-published homework, summaries, and family replies will appear here.</div>'
                    }
                </div>
            </article>

            <article class="secretary-card">
                ${activeThread
                    ? `
                        <div class="secretary-card__header secretary-card__header--conversation">
                            <div class="flex items-start gap-4">
                                <div class="secretary-thread-sigil secretary-thread-sigil--${activeMeta.tone}">
                                    <i class="fas ${activeMeta.icon}"></i>
                                </div>
                                <div>
                                    <p class="secretary-card__eyebrow">Active Conversation</p>
                                    <h3 class="secretary-card__title">${escapeHtml(activeMeta.label)}</h3>
                                    <p class="text-sm text-slate-500 mt-1">${escapeHtml(labels.studentName)} • ${escapeHtml(labels.className)}</p>
                                </div>
                            </div>
                            <div class="secretary-card__badge">${escapeHtml(formatFlexibleDate(activeThread.lastMessageAt, true))}</div>
                        </div>

                        <div class="secretary-message-stack">
                            ${messages.length
                                ? messages.map((message) => {
                                    const isSecretary = message.authorRole === 'secretary';
                                    const authorLabel = isSecretary
                                        ? 'Secretary'
                                        : message.authorRole === 'parent'
                                            ? 'Parent'
                                            : message.authorRole === 'teacher'
                                                ? 'Teacher'
                                                : 'School';
                                    return `
                                        <div class="secretary-message-bubble ${isSecretary ? 'secretary-message-bubble--own' : ''}">
                                            <div class="secretary-message-bubble__meta">
                                                <span>${escapeHtml(authorLabel)}</span>
                                                <span>${escapeHtml(formatFlexibleDate(message.createdAt, true))}</span>
                                            </div>
                                            <div class="secretary-message-bubble__body">${escapeHtml(message.body || '')}</div>
                                        </div>
                                    `;
                                }).join('')
                                : '<div class="secretary-empty">No messages in this thread yet.</div>'
                            }
                        </div>

                        <form id="secretary-message-form" class="secretary-composer">
                            <div class="secretary-composer__topline">
                                <label class="secretary-field">
                                    <span>Message type</span>
                                    <select id="secretary-message-type">
                                        <option value="admin-announcement">Admin announcement</option>
                                        <option value="meeting-request">Meeting request</option>
                                        <option value="attendance-alert">Attendance alert</option>
                                        <option value="celebration">Celebration</option>
                                        <option value="progress-share">Progress share</option>
                                        <option value="homework">Homework</option>
                                    </select>
                                </label>
                            </div>
                            <label class="secretary-field">
                                <span>Reply as secretary</span>
                                <textarea id="secretary-message-text" placeholder="Write a polished message to the family or the teaching team..."></textarea>
                            </label>
                            <div class="secretary-composer__actions">
                                <button type="submit" id="secretary-message-send-btn" class="secretary-shell__primary-btn">
                                    <i class="fas fa-paper-plane mr-2"></i>Send Message
                                </button>
                            </div>
                        </form>
                    `
                    : `
                        <div class="secretary-empty secretary-empty--large">
                            <h3 class="font-title text-2xl text-slate-700">Choose a thread</h3>
                            <p class="mt-3 text-sm text-slate-500">Select any parent communication on the left to inspect the history and send a secretary reply from here.</p>
                        </div>
                    `
                }
            </article>
        </div>
    `;
}

function renderSettingsSection() {
    const profile = state.get('currentUserProfile');
    const schoolName = state.get('schoolName') || 'Your School';
    const classes = (state.get('allSchoolClasses') || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const schoolDefaults = getSchoolAssessmentDefaults();

    return `
        <div class="grid gap-5">
            <div class="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <article class="secretary-card">
                    <div class="secretary-card__header">
                        <div>
                            <p class="secretary-card__eyebrow">School Identity</p>
                            <h3 class="secretary-card__title">Live school controls</h3>
                        </div>
                        <div class="secretary-card__badge">Secretary tools</div>
                    </div>
                    <form id="secretary-school-name-form" class="secretary-settings-form">
                        <label class="secretary-field">
                            <span>School name</span>
                            <input type="text" id="secretary-school-name-input" value="${escapeHtml(schoolName)}" placeholder="School name">
                        </label>
                        <div class="secretary-settings-actions">
                            <button type="submit" id="secretary-school-name-save-btn" class="secretary-shell__primary-btn">
                                <i class="fas fa-save mr-2"></i>Save School Name
                            </button>
                            <button type="button" id="secretary-open-teacher-from-settings-btn" class="secretary-shell__secondary-btn">
                                <i class="fas fa-compass mr-2"></i>Open Teacher Workspace
                            </button>
                        </div>
                    </form>
                    <div class="secretary-stack mt-5">
                        <div class="secretary-inline-note">
                            <strong>Signed in as:</strong> ${escapeHtml(profile?.displayName || 'Secretary')}
                        </div>
                        <div class="secretary-inline-note">
                            <strong>Scope:</strong> all classes, all students, all written scores, all notes, and all communication threads.
                        </div>
                    </div>
                </article>

                <article class="secretary-card">
                    <div class="secretary-card__header">
                        <div>
                            <p class="secretary-card__eyebrow">Operations</p>
                            <h3 class="secretary-card__title">Useful admin actions</h3>
                        </div>
                    </div>
                    <div class="secretary-ops-grid">
                        <button type="button" id="secretary-run-backfill-btn" class="secretary-operation-tile">
                            <i class="fas fa-shuffle"></i>
                            <span>Refresh parent snapshots</span>
                            <small>Rebuild parent-safe summaries for every student.</small>
                        </button>
                        <button type="button" class="secretary-operation-tile" data-secretary-tab-link="academics">
                            <i class="fas fa-scroll"></i>
                            <span>Audit academics</span>
                            <small>Jump into the schoolwide assessment feed.</small>
                        </button>
                        <button type="button" class="secretary-operation-tile" data-secretary-tab-link="communications">
                            <i class="fas fa-envelope-open-text"></i>
                            <span>Answer families</span>
                            <small>Reply directly inside any parent thread.</small>
                        </button>
                        <button type="button" class="secretary-operation-tile" data-secretary-tab-link="students">
                            <i class="fas fa-user-gear"></i>
                            <span>Inspect students</span>
                            <small>Open the roster with edit and chronicle shortcuts.</small>
                        </button>
                    </div>
                </article>
            </div>

            <article class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">Assessment Governance</p>
                        <h3 class="secretary-card__title">School grading rules and per-class overrides</h3>
                    </div>
                    <button type="button" id="secretary-save-assessment-btn" class="secretary-shell__primary-btn">
                        <i class="fas fa-save mr-2"></i>Save Assessment Settings
                    </button>
                </div>
                <div class="secretary-assessment-preview">
                    ${Object.entries(schoolDefaults).map(([league, config]) => `
                        <div class="secretary-assessment-preview__item">
                            <strong>${escapeHtml(league)}</strong>
                            <span>Tests: ${escapeHtml(describeAssessmentScheme(config.tests))}</span>
                            <span>Dictations: ${escapeHtml(describeAssessmentScheme(config.dictations))}</span>
                        </div>
                    `).join('')}
                </div>
                <div id="secretary-assessment-defaults-editor" class="mt-5">
                    ${getAssessmentDefaultsEditorHtml(schoolDefaults)}
                </div>
                <div id="secretary-class-assessment-editor" class="mt-5 space-y-4">
                    ${classes.map((classData) => getAssessmentConfigCardHtml(
                        classData.assessmentConfig || normalizeClassAssessmentConfig(null, classData.questLevel),
                        `secretary-class-${classData.id}`,
                        {
                            allowInherit: true,
                            questLevel: classData.questLevel,
                            title: `${classData.logo || '📚'} ${classData.name}`,
                            description: `${classData.questLevel || 'League'} class`
                        }
                    )).join('')}
                </div>
            </article>
        </div>
    `;
}

export function activateSecretaryTab(tabKey) {
    document.querySelectorAll('.secretary-nav-btn').forEach((btn) => {
        btn.classList.toggle('secretary-nav-btn-active', btn.dataset.secretaryTab === tabKey);
    });
    document.querySelectorAll('[data-secretary-section]').forEach((section) => {
        section.classList.toggle('hidden', section.dataset.secretarySection !== tabKey);
    });
}

export function renderSecretaryConsole() {
    const sections = {
        overview: renderOverviewSection(),
        classes: renderClassSection(),
        students: renderStudentSection(),
        academics: renderAcademicSection(),
        communications: renderCommunicationSection(),
        settings: renderSettingsSection()
    };

    Object.entries(sections).forEach(([key, html]) => {
        const section = document.querySelector(`[data-secretary-section="${key}"]`);
        if (section) section.innerHTML = html;
    });

    const defaultsEditor = document.getElementById('secretary-assessment-defaults-editor');
    const classEditor = document.getElementById('secretary-class-assessment-editor');
    if (defaultsEditor) wireAssessmentEditor(defaultsEditor);
    if (classEditor) wireAssessmentEditor(classEditor);
}

async function saveSecretarySchoolName(button) {
    const input = document.getElementById('secretary-school-name-input');
    const newName = input?.value?.trim() || '';
    if (!newName) {
        showToast('School name cannot be empty.', 'error');
        return;
    }

    try {
        setBusyState(button, true, 'Saving School Name...');
        await setDoc(doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays'), { schoolName: newName }, { merge: true });
        state.setSchoolName(newName);
        document.querySelectorAll('[data-school-name]').forEach((el) => {
            el.textContent = newName;
        });
        showToast('School name updated.', 'success');
    } catch (error) {
        console.error('Could not save school name:', error);
        showToast('Could not save the school name.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function saveSecretaryAssessmentSettings(button) {
    const defaultsContainer = document.getElementById('secretary-assessment-defaults-editor');
    const classesContainer = document.getElementById('secretary-class-assessment-editor');
    if (!defaultsContainer || !classesContainer) return;

    try {
        setBusyState(button, true, 'Saving Assessment Settings...');
        const schoolDefaults = normalizeAssessmentDefaultsByLeague(readAssessmentDefaultsFromContainer(defaultsContainer));
        const batch = writeBatch(db);
        batch.set(doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays'), { assessmentDefaultsByLeague: schoolDefaults }, { merge: true });

        const updatedSchoolClasses = (state.get('allSchoolClasses') || []).map((classData) => ({ ...classData }));
        classesContainer.querySelectorAll('[data-assessment-card]').forEach((card) => {
            const classId = (card.dataset.cardKey || '').replace('secretary-class-', '');
            if (!classId) return;
            const classData = updatedSchoolClasses.find((item) => item.id === classId);
            if (!classData) return;
            const assessmentConfig = normalizeClassAssessmentConfig(
                readAssessmentCardValue(card, { allowInherit: true }),
                classData.questLevel
            );
            classData.assessmentConfig = assessmentConfig;
            batch.set(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), { assessmentConfig }, { merge: true });
        });

        await batch.commit();
        state.setSchoolAssessmentDefaults(schoolDefaults);
        state.setAllSchoolClasses(updatedSchoolClasses);
        state.setAllTeachersClasses(updatedSchoolClasses);
        showToast('Assessment settings updated.', 'success');
        renderSecretaryConsole();
    } catch (error) {
        console.error('Could not save assessment settings:', error);
        showToast('Could not save assessment settings.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

export function wireSecretaryConsoleListeners({ onLogout, onOpenTeacherView, onSelectThread }) {
    secretaryCallbacks = { onLogout, onOpenTeacherView, onSelectThread };
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('secretary-logout-btn')?.addEventListener('click', () => secretaryCallbacks.onLogout?.());
    document.getElementById('secretary-open-teacher-app-btn')?.addEventListener('click', () => secretaryCallbacks.onOpenTeacherView?.());
    document.getElementById('secretary-class-filter')?.addEventListener('input', (event) => {
        state.setSecretaryView({ classFilter: event.target.value });
        renderSecretaryConsole();
    });
    document.getElementById('secretary-student-filter')?.addEventListener('input', (event) => {
        state.setSecretaryView({ studentFilter: event.target.value });
        renderSecretaryConsole();
    });

    document.getElementById('secretary-screen')?.addEventListener('click', async (event) => {
        const navBtn = event.target.closest('.secretary-nav-btn');
        if (navBtn) {
            activateSecretaryTab(navBtn.dataset.secretaryTab || 'overview');
            return;
        }

        const tabLinkBtn = event.target.closest('[data-secretary-tab-link]');
        if (tabLinkBtn) {
            activateSecretaryTab(tabLinkBtn.dataset.secretaryTabLink || 'overview');
            return;
        }

        const editClassBtn = event.target.closest('[data-secretary-edit-class]');
        if (editClassBtn) {
            modals.openEditClassModal(editClassBtn.dataset.secretaryEditClass);
            return;
        }

        const editStudentBtn = event.target.closest('[data-secretary-edit-student]');
        if (editStudentBtn) {
            modals.openEditStudentModal(editStudentBtn.dataset.secretaryEditStudent);
            return;
        }

        const chronicleBtn = event.target.closest('[data-secretary-chronicle]');
        if (chronicleBtn) {
            modals.openHeroChronicleModal(chronicleBtn.dataset.secretaryChronicle);
            return;
        }

        const threadBtn = event.target.closest('[data-secretary-thread]');
        if (threadBtn) {
            const threadId = threadBtn.dataset.secretaryThread;
            secretaryCallbacks.onSelectThread?.(threadId);
            if (threadBtn.dataset.secretaryTabJump) {
                activateSecretaryTab(threadBtn.dataset.secretaryTabJump);
            }
            return;
        }

        const saveAssessmentBtn = event.target.closest('#secretary-save-assessment-btn');
        if (saveAssessmentBtn) {
            await saveSecretaryAssessmentSettings(saveAssessmentBtn);
            return;
        }

        const backfillBtn = event.target.closest('#secretary-run-backfill-btn');
        if (backfillBtn) {
            try {
                setBusyState(backfillBtn, true, 'Refreshing Parent Snapshots...');
                const result = await backfillRoleAccessData({});
                showToast(`Parent snapshots refreshed for ${result?.parentSnapshotsUpdated || 0} students.`, 'success');
            } catch (error) {
                console.error('Could not refresh parent snapshots:', error);
                showToast(error?.message || 'Could not refresh parent snapshots.', 'error');
            } finally {
                setBusyState(backfillBtn, false);
            }
            return;
        }

        const teacherBtn = event.target.closest('#secretary-open-teacher-from-settings-btn');
        if (teacherBtn) {
            secretaryCallbacks.onOpenTeacherView?.();
        }
    });

    document.getElementById('secretary-screen')?.addEventListener('submit', async (event) => {
        if (event.target.id === 'secretary-message-form') {
            event.preventDefault();
            const activeThread = getActiveThread();
            const body = document.getElementById('secretary-message-text')?.value?.trim();
            const messageType = document.getElementById('secretary-message-type')?.value || 'admin-announcement';
            const sendBtn = document.getElementById('secretary-message-send-btn');
            if (!activeThread || !body) {
                showToast('Write a message first.', 'info');
                return;
            }
            try {
                setBusyState(sendBtn, true, 'Sending Message...');
                await postCommunicationMessage({
                    threadId: activeThread.id,
                    studentId: activeThread.studentId,
                    body,
                    messageType
                });
                document.getElementById('secretary-message-text').value = '';
                showToast('Message sent.', 'success');
            } catch (error) {
                console.error('Could not send secretary message:', error);
                showToast(error?.message || 'Could not send the message right now.', 'error');
            } finally {
                setBusyState(sendBtn, false);
            }
            return;
        }

        if (event.target.id === 'secretary-school-name-form') {
            event.preventDefault();
            const saveBtn = document.getElementById('secretary-school-name-save-btn');
            await saveSecretarySchoolName(saveBtn);
        }
    });
}
