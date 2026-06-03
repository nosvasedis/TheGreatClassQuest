export function threadTone(threadType) {
    const t = (threadType || '').toLowerCase();
    if (t.includes('meeting') || t.includes('request')) return 'amber';
    if (t.includes('concern') || t.includes('issue')) return 'rose';
    if (t.includes('praise') || t.includes('celebr')) return 'emerald';
    if (t.includes('general') || t.includes('message')) return 'sky';
    return 'violet';
}

export function threadIcon(threadType) {
    const t = (threadType || '').toLowerCase();
    if (t.includes('meeting') || t.includes('request')) return 'fa-calendar-check';
    if (t.includes('concern') || t.includes('issue')) return 'fa-exclamation-circle';
    if (t.includes('praise') || t.includes('celebr')) return 'fa-star';
    return 'fa-comment-dots';
}

export function threadLabel(threadType) {
    const t = (threadType || '').toLowerCase();
    if (t.includes('meeting')) return 'Meeting request';
    if (t.includes('homework')) return 'Homework';
    if (t.includes('progress')) return 'Progress update';
    if (t.includes('celebr')) return 'Celebration';
    return 'Message';
}

export function celebrationVariant(i) {
    return ['gold', 'rose', 'teal'][i % 3];
}

export function celebrationEmoji(item) {
    const t = (item.reason || item.title || '').toLowerCase();
    if (t.includes('star') || t.includes('award')) return '⭐';
    if (t.includes('attend')) return '📅';
    if (t.includes('test') || t.includes('grade')) return '📝';
    if (t.includes('help') || t.includes('kind')) return '🤝';
    return '🎉';
}
