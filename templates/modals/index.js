// templates/modals/index.js

import { baseModalsHTML } from './base.js';
import { classModalsHTML } from './class.js';
import { plannerModalHTML } from './planner.js';
import { reportsModalsHTML } from './reports.js';
import { studentModalsHTML } from './student.js';
import { aiModalsHTML } from './ai.js';
import { attendanceModalsHTML } from './attendance.js';
import { heroModalsHTML } from './hero.js';
import { rankingsModalsHTML } from './rankings.js';
import { trophyRoomModalsHTML } from './trophyRoom.js';
import { miscModalsHTML } from './misc.js';
import { sortingQuizModalsHTML } from './sortingQuiz.js';
import { skillTreeModalHTML } from './skillTree.js';

export const allModalsHTML =
    baseModalsHTML +
    classModalsHTML +
    plannerModalHTML +
    reportsModalsHTML +
    studentModalsHTML +
    aiModalsHTML +
    attendanceModalsHTML +
    heroModalsHTML +
    rankingsModalsHTML +
    trophyRoomModalsHTML +
    miscModalsHTML +
    sortingQuizModalsHTML +
    skillTreeModalHTML;
