/**
 * Builders for The Torn Map content. A riddle has one answer and one clue per wrong option;
 * each clue names (out) the option it rules out, so no group can solve it alone.
 * Options are written 'emoji word|emoji word' (the first space splits the emoji from the word).
 * Clues are [out, text, pic]; pic is a picture line for Pre-Junior (non-readers).
 */

function parseOptions(spec) {
    return Object.freeze(String(spec).split('|').map((part) => {
        const s = part.trim();
        const i = s.indexOf(' ');
        return Object.freeze({ emoji: s.slice(0, i), word: s.slice(i + 1).trim() });
    }));
}

export function R(id, beat, ask, options, answer, clues) {
    return Object.freeze({
        id, beat, ask, answer,
        options: parseOptions(options),
        clues: Object.freeze(clues.map(([out, text, pic = '']) => Object.freeze({ out, text, pic })))
    });
}

export function ADV(id, name, intro, finale, riddles) {
    return Object.freeze({ id, name, intro, finale, riddles: Object.freeze(riddles) });
}
