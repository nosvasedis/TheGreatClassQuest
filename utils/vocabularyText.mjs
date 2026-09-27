/** Shared vocabulary shaping. Preserve the original learnedToday semantics. */
function clean(value, max = 140) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function splitKeywords(text) {
    return clean(text, 400).split(/[,;\n]+/).map(part => clean(part, 60)).filter(Boolean);
}
export function looksLikeVocabulary(text) {
    const value = clean(text, 60);
    return value.length > 1 && value.split(' ').length <= 3 && !/[.!?]$/.test(value);
}
