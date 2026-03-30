export function isTeacherBoonWindow(date = new Date()) {
    const resolvedDate = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(resolvedDate.getTime())) return false;

    const year = resolvedDate.getFullYear();
    const monthIndex = resolvedDate.getMonth();
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();

    return resolvedDate.getDate() >= (lastDayOfMonth - 2);
}

export function getLocalMonthKey(date = new Date()) {
    const resolvedDate = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(resolvedDate.getTime())) return '';

    return `${resolvedDate.getFullYear()}-${String(resolvedDate.getMonth() + 1).padStart(2, '0')}`;
}
