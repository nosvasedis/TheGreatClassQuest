export function simpleHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Global Solar Data (Ag. Ioannis Rentis, Greece)
// Default fallback times until API loads
export let solarData = {
    sunrise: new Date().setHours(6, 30, 0, 0),
    sunset: new Date().setHours(20, 30, 0, 0)
};

export async function fetchSolarCycle() {
    try {
        // Ag. Ioannis Rentis Coordinates
        const response = await fetch('https://api.sunrise-sunset.org/json?lat=37.9761&lng=23.6586&formatted=0');
        const data = await response.json();
        if (data.status === 'OK') {
            solarData.sunrise = new Date(data.results.sunrise).getTime();
            solarData.sunset = new Date(data.results.sunset).getTime();
            console.log(`Solar Cycle Synced with Greece — Sunrise: ${new Date(solarData.sunrise).toLocaleTimeString()}, Sunset: ${new Date(solarData.sunset).toLocaleTimeString()}`);
        }
    } catch (e) { console.warn("Using default solar times."); }
}

export function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    const header = document.querySelector('header');
    const wallScreen = document.getElementById('dynamic-wallpaper-screen');

    // 1. Real-Time Solar Check (Greece/Rentis)
    // We use the solarData fetched earlier, or defaults
    const nowTime = now.getTime();
    const sunset = solarData.sunset || new Date().setHours(20, 30, 0, 0);
    const sunrise = solarData.sunrise || new Date().setHours(6, 30, 0, 0);

    // Logic: It is night if it's AFTER sunset OR BEFORE sunrise
    const isNight = nowTime >= sunset || nowTime < sunrise;

    // 2. Apply Global Classes IMMEDIATELY
    if (isNight) {
        document.body.classList.add('night-mode');
        if (header) header.classList.add('header-night');
        if (wallScreen) wallScreen.classList.add('is-night');
    } else {
        document.body.classList.remove('night-mode');
        if (header) header.classList.remove('header-night');
        if (wallScreen) wallScreen.classList.remove('is-night');
    }

    if (dateEl && timeEl) {
        // 3. FIX: Better Random Color Variance for Glow
        // We use Day + Hour + Minute to ensure it shifts, but stays consistent for a minute
        const uniqueTimeSeed = now.getDate() + now.getHours() + (now.getMinutes() * 13);
        const hue = (uniqueTimeSeed * 137.508) % 360;

        let textShadowStyle;

        if (isNight) {
            // Night: Higher saturation, slightly darker glow
            const color = `hsl(${hue}, 80%, 60%)`;
            textShadowStyle = `0 2px 4px rgba(0,0,0,0.8), 0 0 15px ${color}, 0 0 30px ${color}`;
        } else {
            // Day: High brightness
            const color = `hsl(${hue}, 90%, 50%)`;
            textShadowStyle = `0 2px 4px rgba(0,0,0,0.3), 0 0 10px ${color}, 0 0 20px ${color}`;
        }

        dateEl.style.textShadow = textShadowStyle;
        timeEl.style.textShadow = textShadowStyle;
        dateEl.style.color = "#ffffff";
        timeEl.style.color = "#ffffff";

        dateEl.innerText = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        timeEl.innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    // 4. Force Wallpaper Re-Check (updates weather visuals in night mode)
    if (wallScreen && !wallScreen.classList.contains('hidden')) {
        // Dispatch a custom event or call the init function if exported
        // Since we can't easily cross-call here, we rely on the CSS .is-night classes we just set
    }
}

export function getDDMMYYYY(date = new Date()) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

export function parseDDMMYYYY(dateString) {
    if (!dateString || typeof dateString !== 'string') return new Date();
    const parts = dateString.split(/[-/]/);
    if (parts.length !== 3) return new Date();
    if (parts[0].length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
}

export function getAgeGroupForLeague(league) {
    const leagueAges = {
        'Junior A': '7-8', 'Junior B': '8-9', 'A': '9-10', 'B': '10-11',
        'C': '11-12', 'D': '12-13'
    };
    return leagueAges[league] || 'all ages';
}

export function getAgeCategoryForLeague(league) {
    if (league === 'Junior A' || league === 'Junior B') return 'junior';
    if (league === 'A' || league === 'B') return 'mid';
    return 'senior';
}

/** Today in canonical DD-MM-YYYY (local). Use with datesMatch/parseFlexibleDate everywhere. */
export function getTodayDateString() {
    return getDDMMYYYY(new Date());
}

export function getStartOfMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = month < 10 ? '0' + month : month;
    return `${year}-${monthStr}-01`;
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function compressImageBase64(base64, maxWidth = 512, maxHeight = 512, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (error) => reject(error);
    });
}

export function compressAvatarImageBase64(base64, targetSize = 256, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
            resolve(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = (error) => reject(error);
    });
}

export function getClassesOnDay(dateString, allSchoolClasses, allScheduleOverrides) {
    const day = parseDDMMYYYY(dateString).getDay().toString();
    let classes = allSchoolClasses.filter(c => c.scheduleDays && c.scheduleDays.includes(day));
    const overridesForDay = allScheduleOverrides.filter(o => o.date === dateString);
    const cancelledClassIds = overridesForDay.filter(o => o.type === 'cancelled').map(o => o.classId);
    classes = classes.filter(c => !cancelledClassIds.includes(c.id));
    const oneTimeClassIds = overridesForDay.filter(o => o.type === 'one-time').map(o => o.classId);
    oneTimeClassIds.forEach(classId => {
        if (!classes.some(c => c.id === classId)) {
            const classToAdd = allSchoolClasses.find(c => c.id === classId);
            if (classToAdd) classes.push(classToAdd);
        }
    });
    return classes.sort((a, b) => (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99'));
}

export function getLastLessonDate(classId, allSchoolClasses) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData || !classData.scheduleDays || classData.scheduleDays.length === 0) {
        return getTodayDateString();
    }

    let checkDate = new Date();
    // Check today first, then go back
    for (let i = 0; i < 7; i++) {
        if (classData.scheduleDays.includes(checkDate.getDay().toString())) {
            return getDDMMYYYY(checkDate);
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return getTodayDateString();
}

export function getPreviousLessonDate(classId, allSchoolClasses) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData || !classData.scheduleDays || classData.scheduleDays.length === 0) {
        return null;
    }

    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);

    for (let i = 0; i < 14; i++) {
        if (classData.scheduleDays.includes(checkDate.getDay().toString())) {
            return getDDMMYYYY(checkDate);
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return null;
}

export function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export async function uploadImageToStorage(base64String, path) {
    const { storage, ref, uploadString, getDownloadURL } = await import('./firebase.js');
    try {
        const storageRef = ref(storage, path);
        await uploadString(storageRef, base64String, 'data_url');
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
}

/**
 * SMART DATE PARSER — use everywhere in the app for any date string or Date.
 * Handles: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, Date instances.
 * Parses as LOCAL date so "today" and calendar day comparisons are correct in all timezones.
 */
export function parseFlexibleDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

    const str = typeof dateInput === 'string' ? dateInput.trim() : String(dateInput);
    if (!str) return null;

    // YYYY-MM-DD: parse as local date to avoid UTC-midnight timezone bugs
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    const parts = str.split(/[^0-9]/).filter(Boolean);
    if (parts.length === 3) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const p3 = parseInt(parts[2], 10);
        if (p2 < 1 || p2 > 12) return null;
        if (p3 > 1000) return new Date(p3, p2 - 1, p1);  // DD-MM-YYYY
        if (p1 > 1000) return new Date(p1, p2 - 1, p3);  // YYYY-MM-DD (already handled above, but safe)
    }

    const rawParse = new Date(str);
    return !isNaN(rawParse.getTime()) ? rawParse : null;
}

/** Returns canonical DD-MM-YYYY from any date input. Use for storage or string comparison. */
export function normalizeToDateString(dateInput) {
    const d = parseFlexibleDate(dateInput);
    return d ? getDDMMYYYY(d) : '';
}

export function isSpecialOccasion(dateStr, scheduleDays) {
    if (!dateStr) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse "YYYY-MM-DD" or "0000-MM-DD"
    const parts = dateStr.split('-');
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const currentYearOccasion = new Date(today.getFullYear(), month, day);

    // Check Today
    if (currentYearOccasion.getTime() === today.getTime()) return true;

    // Check +/- 1 Day logic based on schedule
    const diff = (today - currentYearOccasion) / (1000 * 60 * 60 * 24);

    // If today is NOT the birthday (diff != 0), checks if we should celebrate today instead
    // e.g. Birthday was yesterday (Sunday), today is Monday (Lesson day). diff is +1.
    // e.g. Birthday is tomorrow (Saturday), today is Friday (Lesson day). diff is -1.

    if (Math.abs(diff) === 1) {
        // Was there a lesson on the actual birthday?
        const bdayDayOfWeek = currentYearOccasion.getDay().toString();

        // If the actual birthday was NOT a lesson day, allow celebration today
        if (!scheduleDays.includes(bdayDayOfWeek)) {
            return true;
        }
    }

    return false;
}

/** Compare two date inputs (any format). Use everywhere instead of string === or raw Date. */
export function datesMatch(dateInput1, dateInput2) {
    const d1 = parseFlexibleDate(dateInput1);
    const d2 = parseFlexibleDate(dateInput2);
    if (!d1 || !d2) return false;
    return d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();
}

/** True if dateInput is the same calendar day as today (local). */
export function isToday(dateInput) {
    return datesMatch(dateInput, getTodayDateString());
}

/**
 * SOURCE OF TRUTH: Calculates the dynamic goal for a class based on global holidays and class-specific cancellations.
 */
export function calculateMonthlyClassGoal(classData, studentCount, schoolHolidayRanges, allScheduleOverrides) {
    if (studentCount === 0) return 18;

    const BASE_GOAL = 18;
    const SCALING_FACTOR = 2.5;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 1. Calculate Holiday Days Lost (Exact Leaderboard logic)
    let holidayDaysLost = 0;
    const ranges = schoolHolidayRanges || [];

    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            const diffTime = Math.abs(overlapEnd - overlapStart);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            holidayDaysLost += diffDays;
        }
    });

    // Add class-specific cancellations (No School days / explicitly cancelled days)
    const overrides = allScheduleOverrides || [];
    overrides.filter(o => o.classId === classData.id && o.type === 'cancelled').forEach(c => {
        const parts = c.date.split('-');
        if (parts.length === 3) {
            const oDate = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
            // Ensure this cancelled day isn't already inside a holiday range, to prevent double counting
            let isInsideGlobHoliday = false;
            ranges.forEach(range => {
                const start = new Date(range.start);
                const end = new Date(range.end);
                start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
                if (oDate >= start && oDate <= end) isInsideGlobHoliday = true;
            });

            if (oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear && !isInsideGlobHoliday) {
                holidayDaysLost += 1;
            }
        }
    });

    // 2. Apply Month Modifier (Exact Leaderboard logic)
    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    if (currentMonth === 5) { // June
        monthModifier = 0.5;
    } else {
        monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));
    }

    // 3. Handle Difficulty & Completion (Exact Leaderboard logic)
    let isCompletedThisMonth = false;
    if (classData.questCompletedAt) {
        const completedDate = typeof classData.questCompletedAt.toDate === 'function' ? classData.questCompletedAt.toDate() : new Date(classData.questCompletedAt);
        if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) {
            isCompletedThisMonth = true;
        }
    }
    const dbDifficulty = classData.difficultyLevel || 0;
    const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;

    // 4. Final Calculation
    const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;
    return Math.round(studentCount * adjustedGoalPerStudent);
}

/**
 * SOURCE OF TRUTH: Centralized formula for extracting tie-breaker stats for a given student
 * Returns an object containing { count3, count2, academicAvg, uniqueReasons }
 */
export function calculateStudentStats(studentId, relevantLogs, relevantScores) {
    let count3 = 0;
    let count2 = 0;
    const reasons = new Set();

    // Process behavioral logs
    (relevantLogs || []).forEach(l => {
        if (l.studentId === studentId) {
            if (l.stars >= 3) count3++;
            else if (l.stars >= 2) count2++;
            if (l.reason) reasons.add(l.reason);
        }
    });

    // Process academic scores
    const sScores = (relevantScores || []).filter(sc => sc.studentId === studentId);
    let acadSum = 0;
    sScores.forEach(sc => {
        if (sc.scoreNumeric !== null && sc.maxScore) {
            acadSum += (Number(sc.scoreNumeric) / Number(sc.maxScore)) * 100;
        } else if (sc.scoreQualitative === 'Great!!!') {
            acadSum += 100;
        } else if (sc.scoreQualitative === 'Great!!') {
            acadSum += 75;
        }
    });
    const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;

    return {
        count3,
        count2,
        academicAvg,
        uniqueReasons: reasons.size
    };
}

/**
 * SOURCE OF TRUTH: Standard sorting algorithm for leaderboards and ceremonies.
 * Expects objects with: { name, stars, stats: { count3, count2, uniqueReasons, academicAvg } }
 */
export function sortStudentsByTieBreaker(a, b) {
    // 1. Primary Sort: Total Stars
    if (b.stars !== a.stars) return b.stars - a.stars;

    // --- The Tie-Breaker Cascade ---
    // 2. Number of 3-star (or more) awards
    if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;

    // 3. Number of 2-star awards
    if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;

    // 4. Number of distinct reasons awarded (Breadth of skill)
    if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;

    // 5. Academic Average Comparison
    if (b.stats.academicAvg !== a.stats.academicAvg) return (b.stats.academicAvg || 0) - (a.stats.academicAvg || 0);

    // 6. Alphabetical Backup (to prevent random jumping of equivalent scores)
    return (a.name || '').localeCompare(b.name || '');
}
