// utils/domMorph.mjs — a small DOM morph for screens that live data refreshes often (Home).
// Rebuilding a whole screen with innerHTML restarts every entrance animation, re-decodes every
// picture and drops whatever the scripts painted in since (a ticking clock, an open page), so the
// screen "flashes" each time a colleague awards a star. morphInto() changes only what differs:
// attributes and text in place, whole nodes only when their kind changed. Same idea as the
// Quest Remote's features/questRemote/wandMorph.mjs, with hooks so each screen can say which
// parts look after themselves.
//
// Options (all optional):
//   keep(from, to)    → true leaves `from` exactly as it is (a part that updates itself).
//   isForeign(node)   → true for a node other code added (a badge mounted later): left in place.
//   keepClasses       → classes scripts add for a while (open, pressed…): a morph never strips them.
//   keyOf(node)       → identity of an item in a list, so items are matched by who they are.

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function defaultKeyOf(n) {
    if (n.nodeType !== 1) return null;
    return n.getAttribute('data-morph-key') ?? n.getAttribute('data-student-id') ?? (n.id || null);
}

function syncAttributes(from, to, keepClasses) {
    for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
    for (const { name, value } of [...to.attributes]) {
        let next = value;
        if (name === 'class' && keepClasses.length) {
            const kept = keepClasses.filter((c) => from.classList.contains(c));
            if (kept.length) {
                const set = new Set(String(value || '').split(/\s+/).filter(Boolean));
                kept.forEach((c) => set.add(c));
                next = [...set].join(' ');
            }
        }
        if (from.getAttribute(name) !== next) from.setAttribute(name, next);
    }
    // A kept class with no class attribute on the new node still stays.
    if (!to.hasAttribute('class') && keepClasses.length) {
        const kept = keepClasses.filter((c) => from.classList.contains(c));
        if (kept.length) from.setAttribute('class', kept.join(' '));
    }
}

function morphNode(from, to, opts) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return to; }
    if (from.nodeType !== 1) {
        if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
        return from;
    }
    if (opts.keep(from, to)) return from;
    if (from.isEqualNode(to)) return from;
    const focused = from === from.ownerDocument?.activeElement;
    if (FIELDS.has(from.nodeName) && focused) return from;
    syncAttributes(from, to, opts.keepClasses);
    if (FIELDS.has(from.nodeName)) {
        if (from.nodeName === 'TEXTAREA') { from.value = to.value; return from; }
        if (from.nodeName === 'SELECT') { morphChildren(from, to, opts); from.value = to.value; return from; }
        if (from.value !== (to.getAttribute('value') ?? '')) from.value = to.getAttribute('value') ?? '';
    }
    morphChildren(from, to, opts);
    return from;
}

function withDefaults(opts = {}) {
    return {
        keep: opts.keep || (() => false),
        isForeign: opts.isForeign || (() => false),
        keepClasses: opts.keepClasses || [],
        keyOf: opts.keyOf || defaultKeyOf,
    };
}

function morphChildren(from, to, opts) {
    const a = [...from.childNodes].filter((n) => !(n.nodeType === 1 && opts.isForeign(n)));
    const b = [...to.childNodes];
    const keyed = new Map();
    const loose = [];
    for (const n of a) {
        const k = opts.keyOf(n);
        if (k != null && !keyed.has(k)) keyed.set(k, n); else loose.push(n);
    }
    let li = 0;
    const used = new Set();
    const finals = b.map((next) => {
        const k = opts.keyOf(next);
        let old = k != null ? keyed.get(k) : null;
        if (old) keyed.delete(k);
        else if (k == null) {
            // the next unkeyed old node of the same kind, so one inserted item doesn't shift the rest
            while (li < loose.length && opts.keyOf(loose[li]) != null) li++;
            old = loose[li++] || null;
        }
        if (!old) return next;
        used.add(old);
        return morphNode(old, next, opts);
    });
    for (const n of a) if (!used.has(n) && n.parentNode === from) n.remove();
    let prev = null;
    for (const node of finals) {
        let spot = prev ? prev.nextSibling : from.firstChild;
        while (spot && spot !== node && spot.nodeType === 1 && opts.isForeign(spot)) spot = spot.nextSibling;
        if (spot !== node) from.insertBefore(node, spot);
        prev = node;
    }
}

/** Makes `from`'s children look like `to`'s (a node or fragment), reusing every node that can stay. */
export function morphChildNodes(from, to, opts) {
    morphChildren(from, to, withDefaults(opts));
}

/** Morphs `container`'s content into the markup `html`. */
export function morphInto(container, html, opts) {
    const tpl = container.ownerDocument.createElement('template');
    tpl.innerHTML = html;
    morphChildren(container, tpl.content, withDefaults(opts));
}
