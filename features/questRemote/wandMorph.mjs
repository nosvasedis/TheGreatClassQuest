// features/questRemote/wandMorph.mjs — a tiny DOM morph for the Wand (no library).
// Live updates from the projector arrive often; rebuilding the whole view would restart every
// animation, drop a ping or a press effect half-way and make the phone repaint everything.
// morphInto() changes only what differs: attributes in place (so CSS transitions animate the
// change, e.g. a cloud lighting up), text in place, and whole nodes only when their kind changed.
// A field that has the keyboard is never touched.

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
/** Classes the phone adds for a moment (press, hold, fly…): a live update never cuts them short. */
const TRANSIENT = ['is-pressed', 'is-holding', 'is-fired', 'is-pulling', 'is-released', 'is-flying', 'is-aiming', 'is-sent'];

function classWith(fromEl, value) {
    const keep = TRANSIENT.filter((c) => fromEl.classList.contains(c));
    if (!keep.length) return value;
    const set = new Set(String(value || '').split(/\s+/).filter(Boolean));
    keep.forEach((c) => set.add(c));
    return [...set].join(' ');
}

function syncAttributes(from, to) {
    for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
    for (const { name, value } of [...to.attributes]) {
        const next = name === 'class' ? classWith(from, value) : value;
        if (from.getAttribute(name) !== next) from.setAttribute(name, next);
    }
}

/** A node the phone added for a moment (a ping on the map, a spark) is left alone. */
const isTransientNode = (n) => n.nodeType === 1 && n.hasAttribute('data-qw-transient');

/** Returns the node that now stands for `to` (the old one updated, or `to` itself). */
function morphNode(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return to; }
    if (from.nodeType !== 1) {
        if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
        return from;
    }
    if (from.isEqualNode(to)) return from;
    if (from.classList && TRANSIENT.some((c) => from.classList.contains(c)) && !to.classList.contains('is-pressed')) {
        // compare without the moment's classes so an otherwise equal node stays untouched
        const probe = from.cloneNode(true);
        TRANSIENT.forEach((c) => probe.classList.remove(c));
        if (!probe.getAttribute('class')) probe.removeAttribute('class');
        if (probe.isEqualNode(to)) return from;
    }
    const focused = from === from.ownerDocument?.activeElement;
    if (FIELDS.has(from.nodeName) && focused) return from;
    syncAttributes(from, to);
    if (FIELDS.has(from.nodeName)) {
        if (from.nodeName === 'TEXTAREA') from.value = to.value;
        else if (from.nodeName === 'SELECT') { morphChildren(from, to); from.value = to.value; return from; }
        else if (from.value !== to.getAttribute('value')) from.value = to.getAttribute('value') ?? '';
        if (from.nodeName === 'TEXTAREA') return from;
    }
    morphChildren(from, to);
    return from;
}

/**
 * The identity of an item in a list (a hero, a projector button…). Keyed items are matched by
 * identity, not position: when the projector re-sorts its buttons, a finger already on one still
 * presses that one, and a hero's picture never jumps to a neighbour.
 */
function keyOf(n) {
    if (n.nodeType !== 1) return null;
    return n.getAttribute('data-qw-key') ?? n.getAttribute('data-qw-pad') ?? n.getAttribute('data-qw-text') ?? n.getAttribute('data-qw-hero');
}

/** Makes `from`'s children look like `to`'s, reusing every node that can stay. */
export function morphChildren(from, to) {
    const a = [...from.childNodes].filter((n) => !isTransientNode(n));
    const b = [...to.childNodes];
    const keyed = new Map();
    const loose = [];
    for (const n of a) {
        const k = keyOf(n);
        if (k != null && !keyed.has(k)) keyed.set(k, n); else loose.push(n);
    }
    let li = 0;
    const used = new Set();
    const finals = b.map((next) => {
        const k = keyOf(next);
        let old = k != null ? keyed.get(k) : null;
        if (old) keyed.delete(k);
        else if (k == null) old = loose[li++] || null;
        if (!old) return next;
        used.add(old);
        // a node that gets swapped out is replaced where it stands, then moved below
        return morphNode(old, next);
    });
    for (const n of a) if (!used.has(n) && n.parentNode === from) n.remove();
    let prev = null;
    for (const node of finals) {
        let spot = prev ? prev.nextSibling : from.firstChild;
        while (spot && spot !== node && isTransientNode(spot)) spot = spot.nextSibling;
        if (spot !== node) from.insertBefore(node, spot);
        prev = node;
    }
}

/** Morphs `container`'s content into the markup `html`. */
export function morphInto(container, html) {
    const tpl = container.ownerDocument.createElement('template');
    tpl.innerHTML = html;
    morphChildren(container, tpl.content);
}
