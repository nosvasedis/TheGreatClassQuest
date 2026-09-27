/** Pure shared rotation. Priorities bypass the cycle (as the Protagonist mask did). */
export function pickFairRotation({ presentIds = [], cycleIds = [], lastIds = [], priorityIds = [], count = 1, random = Math.random } = {}) {
    const present = [...new Set(presentIds.filter(Boolean))];
    let cycle = [...new Set(cycleIds.filter(id => present.includes(id)))];
    const selectedIds = [];
    for (let i = 0; i < Math.min(Math.max(0, count), present.length); i++) {
        const priority = priorityIds.find(id => present.includes(id) && !selectedIds.includes(id));
        let chosen = priority;
        if (!chosen) {
            let unused = present.filter(id => !cycle.includes(id) && !selectedIds.includes(id));
            if (!unused.length) { cycle = []; unused = present.filter(id => !selectedIds.includes(id)); }
            let candidates = unused;
            if (candidates.length > 1) {
                const withoutLast = candidates.filter(id => !lastIds.includes(id));
                if (withoutLast.length) candidates = withoutLast;
            }
            chosen = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
        }
        if (!chosen) break;
        selectedIds.push(chosen);
        if (!cycle.includes(chosen)) cycle.push(chosen);
    }
    return { selectedIds, cycleIds: cycle, lastIds: selectedIds, cycleSize: present.length };
}
