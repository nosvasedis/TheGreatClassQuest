// Quiz of the Week question kinds preview: the real stage markup and styles with sample questions.
// The four pictures here are hand-drawn stand-ins; in the app they are drawn by the Elite image AI
// once, when the quiz is generated.
// /quiz-kinds-preview.html?view=intro|listen|listen-speaking|listen-heard|picture|picture-wrong|picture-solved|fix|fix-solved|choice|results[&shot=1]
import { quizIntroHtml, quizResultsHtml, quizStageShellHtml, quizTurnHtml, quizVerdictHtml } from './ui/modals/quizStageMarkup.js';
import { computeQuestionStats } from './features/quizReviewCore.mjs';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'listen';
if (params.has('shot')) document.body.classList.add('pv-shot');

const svg = (body) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fdf6e3"/>${body}</svg>`)}`;
const PICTURES = {
    ladder: svg('<rect x="36" y="14" width="9" height="94" rx="3" fill="#b7791f"/><rect x="75" y="14" width="9" height="94" rx="3" fill="#b7791f"/>' + [26, 44, 62, 80, 98].map((y) => `<rect x="40" y="${y}" width="40" height="7" rx="2" fill="#d69e2e"/>`).join('')),
    umbrella: svg('<path d="M14 62 Q60 6 106 62 Q94 52 83 62 Q72 52 60 62 Q48 52 37 62 Q26 52 14 62Z" fill="#e53e3e"/><path d="M60 12 V92 Q60 104 50 102" stroke="#4a5568" stroke-width="5" fill="none" stroke-linecap="round"/>'),
    bucket: svg('<path d="M30 44 H90 L82 104 H38Z" fill="#3182ce"/><ellipse cx="60" cy="44" rx="30" ry="8" fill="#63b3ed"/><path d="M32 46 Q60 4 88 46" stroke="#2c5282" stroke-width="4" fill="none"/>'),
    kite: svg('<path d="M60 10 L92 46 L60 86 L28 46Z" fill="#9f7aea"/><path d="M60 10 V86 M28 46 H92" stroke="#fff" stroke-width="3"/><path d="M60 86 Q48 96 62 102 Q76 108 62 116" stroke="#4a5568" stroke-width="3" fill="none"/><path d="M52 98 l8 3 -3 7z M66 108 l8 2 -4 7z" fill="#f6ad55"/>')
};

const questions = {
    listen: {
        id: 'q1', type: 'mcq', kind: 'listen',
        listen: 'Tom has got a big brown dog. It is very friendly.',
        question: 'Listen. What has Tom got?',
        options: ['a cat', 'a dog', 'a bike', 'a ball'], correctIndex: 1, correctAnswer: 'a dog',
        explanation: 'Tom has got a big brown dog.'
    },
    picture: {
        id: 'q2', type: 'mcq', kind: 'picture',
        question: 'Which one is a ladder?',
        options: ['umbrella', 'bucket', 'ladder', 'kite'], correctIndex: 2, correctAnswer: 'ladder',
        optionImages: [PICTURES.umbrella, PICTURES.bucket, PICTURES.ladder, PICTURES.kite],
        explanation: 'We climb up a ladder.'
    },
    fix: {
        id: 'q3', type: 'mcq', kind: 'fix',
        broken: 'He don’t like milk.',
        question: 'Which sentence is correct?',
        options: ['He don’t likes milk.', 'He not like milk.', 'He doesn’t like milk.', 'He doesn’t likes milk.'], correctIndex: 2, correctAnswer: 'He doesn’t like milk.',
        explanation: 'he + doesn’t + like'
    },
    choice: {
        id: 'q4', type: 'mcq', kind: 'choice',
        question: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'], correctIndex: 1, correctAnswer: 'goes',
        explanation: 'she + verb with -s'
    }
};

const student = { name: 'Maria Papadopoulou', avatar: null };
const shell = document.createElement('div');
shell.innerHTML = quizStageShellHtml('quiz-of-week-modal').trim();
const modal = shell.firstElementChild;
modal.classList.remove('hidden');
document.body.appendChild(modal);
const content = document.getElementById('quiz-modal-content');

const links = ['intro', 'listen', 'listen-speaking', 'listen-heard', 'picture', 'picture-wrong', 'picture-solved', 'fix', 'fix-solved', 'choice', 'results'];
document.getElementById('pv-toolbar').innerHTML = links.map((v) => `<a href="?view=${v}">${v}</a>`).join('');

function turn(kind, opts = {}) {
    content.dataset.screen = 'turn';
    content.innerHTML = quizTurnHtml({
        question: questions[kind], questionNumber: opts.number || 3, total: 9, attemptNumber: opts.attempt || 1, student,
        stars: 14, trail: ['first', 'late', ...(opts.trail || [])], firstTryCount: 1, triedIndexes: opts.tried || []
    });
}

function verdict(html, kindClass) {
    const area = document.getElementById('quiz-explanation-area');
    area.innerHTML = html;
    area.className = `qs-verdict qs-verdict--${kindClass}`;
    const next = document.getElementById('quiz-next-btn');
    next.classList.remove('hidden');
    document.getElementById('quiz-skip-btn')?.classList.add('hidden');
}

function pick(index, cls) {
    const btn = content.querySelector(`.qs-answer[data-answer-index="${index}"]`);
    content.querySelectorAll('.qs-answer').forEach((b) => { b.disabled = true; });
    btn.classList.add('is-picked', cls);
}

if (view === 'intro') {
    content.dataset.screen = 'intro';
    const names = ['Maria', 'Nikos', 'Eleni', 'Kostas', 'Sofia', 'Giorgos', 'Anna', 'Dimitris', 'Katerina', 'Yannis', 'Ioanna', 'Petros'];
    content.innerHTML = quizIntroHtml({
        questionCount: 9,
        contestants: names.map((name) => ({ name })),
        absentCount: 1,
        topic: 'Mix · Unit 4: Pets and animals',
        kinds: { listen: 3, picture: 3, fix: 1, choice: 2 }
    });
} else if (view === 'listen' || view === 'listen-speaking') {
    turn('listen');
    if (view === 'listen-speaking') document.getElementById('quiz-listen-btn').classList.add('is-speaking');
} else if (view === 'listen-heard') {
    turn('listen');
    pick(1, 'is-correct');
    content.querySelector('[data-quiz-heard]').classList.remove('hidden');
    content.querySelector('.qs-body').classList.add('is-solved');
    verdict(quizVerdictHtml({ kind: 'correct', attemptNumber: 1, explanation: questions.listen.explanation }), 'correct');
} else if (view === 'picture') {
    turn('picture');
} else if (view === 'picture-wrong') {
    turn('picture', { attempt: 2, tried: [1] });
} else if (view === 'picture-solved') {
    turn('picture');
    pick(2, 'is-correct');
    content.querySelector('.qs-answers--pictures').classList.add('is-resolved');
    verdict(quizVerdictHtml({ kind: 'correct', attemptNumber: 1, explanation: questions.picture.explanation }), 'correct');
} else if (view === 'fix') {
    turn('fix');
} else if (view === 'fix-solved') {
    turn('fix', { attempt: 2, tried: [0] });
    pick(2, 'is-correct');
    verdict(quizVerdictHtml({ kind: 'correct', attemptNumber: 2, explanation: questions.fix.explanation }), 'correct');
} else if (view === 'choice') {
    turn('choice');
} else if (view === 'results') {
    content.dataset.screen = 'results';
    const list = [questions.listen, questions.picture, questions.fix, questions.choice];
    const attempts = [
        { questionId: 'q1', studentId: 's1', correct: true, attemptNumber: 1 },
        { questionId: 'q2', studentId: 's2', correct: false, attemptNumber: 1, selectedAnswer: 'bucket' },
        { questionId: 'q2', studentId: 's3', correct: true, attemptNumber: 2 },
        { questionId: 'q3', studentId: 's4', correct: true, attemptNumber: 1 },
        { questionId: 'q4', studentId: 's5', correct: false, attemptNumber: 1, selectedAnswer: 'go' }
    ];
    content.innerHTML = quizResultsHtml({
        totalQuestions: 4, correctFirstTry: 2, firstTryCorrectPct: 50,
        questionStats: computeQuestionStats(list, attempts),
        rewards: { tier: 'common', questBonus: 0.5, studentRewards: [{ stars: 1 }, { stars: 0.5 }, { stars: 1 }], correctStudentDetails: [] }
    }, { replay: true });
    content.querySelector('.qs-section--recap')?.scrollIntoView();
}
