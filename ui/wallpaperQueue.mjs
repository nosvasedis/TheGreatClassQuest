// ui/wallpaperQueue.mjs — cards a tool asks Projector Mode to show next (e.g. Team Maker's teams).
// Tiny on purpose: tools import it without pulling in the whole projector chunk.

const queue = [];
const MAX_AGE_MS = 30 * 60 * 1000;

export function queueProjectorCard(type, classId) {
    const at = Date.now();
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].type === type && queue[i].classId === classId) queue.splice(i, 1);
    queue.push({ type, classId, at });
}

/** The oldest fresh request for this class (or any class when classId is null), removed from the queue. */
export function takeProjectorCard(classId) {
    const now = Date.now();
    for (let i = queue.length - 1; i >= 0; i--) if (now - queue[i].at > MAX_AGE_MS) queue.splice(i, 1);
    const index = queue.findIndex((q) => !classId || q.classId === classId);
    return index >= 0 ? queue.splice(index, 1)[0] : null;
}
