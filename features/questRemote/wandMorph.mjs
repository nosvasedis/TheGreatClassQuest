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

function morphNode(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return; }
    if (from.nodeType !== 1) {
        if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
        return;
    }
    if (from.isEqualNode(to)) return;
    if (from.classList && TRANSIENT.some((c) => from.classList.contains(c)) && !to.classList.contains('is-pressed')) {
        // compare without the moment's classes so an otherwise equal node stays untouched
        const probe = from.cloneNode(true);
        TRANSIENT.forEach((c) => probe.classList.remove(c));
        if (!probe.getAttribute('class')) probe.removeAttribute('class');
        if (probe.isEqualNode(to)) return;
    }
    const focused = from === from.ownerDocument?.activeElement;
    if (FIELDS.has(from.nodeName) && focused) return;
    syncAttributes(from, to);
    if (FIELDS.has(from.nodeName)) {
        if (from.nodeName === 'TEXTAREA') from.value = to.value;
        else if (from.nodeName === 'SELECT') { morphChildren(from, to); from.value = to.value; return; }
        else if (from.value !== to.getAttribute('value')) from.value = to.getAttribute('value') ?? '';
        if (from.nodeName === 'TEXTAREA') return;
    }
    morphChildren(from, to);
}

/** Makes `from`'s children look like `to`'s, reusing every node that can stay. */
export function morphChildren(from, to) {
    const a = [...from.childNodes].filter((n) => !isTransientNode(n));
    const b = [...to.childNodes];
    for (let i = 0; i < b.length; i += 1) {
        if (a[i]) morphNode(a[i], b[i]);
        else from.appendChild(b[i]);
    }
    for (let i = b.length; i < a.length; i += 1) a[i].remove();
}

/** Morphs `container`'s content into the markup `html`. */
export function morphInto(container, html) {
    const tpl = container.ownerDocument.createElement('template');
    tpl.innerHTML = html;
    morphChildren(container, tpl.content);
}
