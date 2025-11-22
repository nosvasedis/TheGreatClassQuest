export function simpleHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
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
    // Handle both YYYY-MM-DD and DD-MM-YYYY
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

/**
 * Finds the date of the lesson strictly BEFORE today.
 * Used for persistence of absence status.
 */
export function getPreviousLessonDate(classId, allSchoolClasses) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData || !classData.scheduleDays || classData.scheduleDays.length === 0) {
        return null;
    }
    
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1); // Start checking from yesterday

    for (let i = 0; i < 14; i++) { // Check back 2 weeks max
        if (classData.scheduleDays.includes(checkDate.getDay().toString())) {
            return getDDMMYYYY(checkDate);
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return null;
}

export function updateDateTime() {
    const now = new Date(), dateEl = document.getElementById('current-date'), timeEl = document.getElementById('current-time');
    if (dateEl && timeEl) {
        const dayClassMap = { 0: 'shadow-sun', 1: 'shadow-mon', 2: 'shadow-tue', 3: 'shadow-wed', 4: 'shadow-thu', 5: 'shadow-fri', 6: 'shadow-sat' };
        const shadowClass = dayClassMap[now.getDay()];
        const rawDateString = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        dateEl.className = 'text-3xl font-bold ' + shadowClass;
        dateEl.innerHTML = Array.from(rawDateString).map((char, i) => `<span class="date-char" style="animation-delay: ${i * 0.05}s">${char === ' ' ? '&nbsp;' : char}</span>`).join('');
        const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        timeEl.className = 'text-3xl pulse-subtle ' + shadowClass;
        timeEl.innerHTML = Array.from(timeString).map((char, i) => `<span class="date-char" style="animation-delay: ${i * 0.05}s">${char}</span>`).join('');
    }
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

// NEW: Helper to upload images to Firebase Storage
export async function uploadImageToStorage(base64String, path) {
    // We need to import these dynamically to avoid circular dependencies
    const { storage, ref, uploadString, getDownloadURL } = await import('./firebase.js');
    
    try {
        // Create a reference to where the file will live
        const storageRef = ref(storage, path);
        
        // Upload the Base64 string
        // We assume the base64 string includes the data:image/jpeg;base64,... prefix
        await uploadString(storageRef, base64String, 'data_url');
        
        // Get the public URL
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
}
