// /features/sortingQuiz.js — Quiz state, navigation, submit → guild assignment

import * as state from '../state.js';
import { assignGuildFromQuizResults, getRandomizedQuestionsForLevel, SORTING_QUIZ_QUESTIONS } from './guildQuiz.js';
import { getGuildById } from './guilds.js';
import { assignStudentToGuild } from '../db/actions/guilds.js';

/** Module-level quiz state. questions = the set used for this run (per age/league). */
let sortingQuizState = {
    studentId: null,
    step: 0,
    answers: [],
    questions: [], // age/league-appropriate question set for this run
};

/**
 * Start the quiz for a student. Uses the student's class quest level for age-appropriate questions.
 * @param {string} studentId
 * @param {string} [questLevel] - Student's class quest level (e.g. "Junior A", "A"). Resolved from state if not provided.
 * @returns {{ question: object, totalSteps: number, step: number }}
 */
export function startQuiz(studentId, questLevel = null) {
    const resolvedLevel = questLevel || resolveQuestLevelForStudent(studentId);
    // Randomised: each student gets a unique selection from the level's 35-question pool,
    // with options also shuffled per question so answer positions differ every time.
    const questions = getRandomizedQuestionsForLevel(resolvedLevel);
    sortingQuizState = {
        studentId,
        step: 1,
        answers: [],
        questions: questions.slice(),
    };
    const question = questions[0];
    return {
        question: question ? { id: question.id, text: question.question, options: question.options.map((o) => o.text) } : null,
        totalSteps: questions.length,
        step: 1,
    };
}

/** Resolve student's class quest level from state (for per-level quiz content). */
function resolveQuestLevelForStudent(studentId) {
    const students = state.get('allStudents') || [];
    const classes = state.get('allSchoolClasses') || [];
    const student = students.find((s) => s.id === studentId);
    if (!student || !student.classId) return null;
    const cls = classes.find((c) => c.id === student.classId);
    return cls ? (cls.questLevel || null) : null;
}

/**
 * Select an option for the current question (by index). Does not advance step.
 * @param {number} optionIndex - 0-based index into current question's options
 */
export function selectAnswer(optionIndex) {
    const len = sortingQuizState.questions.length;
    if (sortingQuizState.step < 1 || (len && sortingQuizState.step > len)) return;
    const qIndex = sortingQuizState.step - 1;
    sortingQuizState.answers[qIndex] = optionIndex;
}

/**
 * Get current answers (for UI to show selected).
 * @returns {number[]}
 */
export function getCurrentAnswers() {
    return [...sortingQuizState.answers];
}

/**
 * Advance to next question. Returns next question or null if quiz is complete.
 * @returns {{ question: object|null, totalSteps: number, step: number, done: boolean }}
 */
export function goNext() {
    const questions = sortingQuizState.questions;
    const total = questions.length;
    const currentStep = sortingQuizState.step;
    if (currentStep >= total) {
        return { question: null, totalSteps: total, step: currentStep, done: true };
    }
    const nextQ = questions[currentStep];
    sortingQuizState.step = currentStep + 1;
    return {
        question: nextQ ? { id: nextQ.id, text: nextQ.question, options: nextQ.options.map((o) => o.text) } : null,
        totalSteps: total,
        step: sortingQuizState.step,
        done: sortingQuizState.step > total,
    };
}

/**
 * Submit the quiz: compute guild, persist assignment, return result for celebration.
 * @returns {Promise<{ guildId: string, guildName: string }|null>}
 */
export async function submitQuiz() {
    const { studentId, questions, answers } = sortingQuizState;
    if (!studentId || !questions.length || answers.length !== questions.length) return null;
    const guildId = assignGuildFromQuizResults(answers, null, questions);
    await assignStudentToGuild(studentId, guildId);
    const guild = getGuildById(guildId);
    return guild ? { guildId: guild.id, guildName: guild.name } : null;
}

/**
 * Get current quiz state (for modal to know step/answers).
 * @returns {{ studentId: string|null, step: number, answers: number[] }}
 */
export function getQuizState() {
    return {
        studentId: sortingQuizState.studentId,
        step: sortingQuizState.step,
        answers: [...sortingQuizState.answers],
        questions: sortingQuizState.questions,
    };
}

/** Number of questions in the current run (for UI progress). */
export function getCurrentQuestionSetLength() {
    return sortingQuizState.questions.length;
}

export { SORTING_QUIZ_QUESTIONS };
