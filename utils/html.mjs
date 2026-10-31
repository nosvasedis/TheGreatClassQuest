// Shared HTML escaping for markup built as strings. Pure, so views and node tests use it too.
// escapeHtml(null | undefined) is '', anything else is turned into a string first.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
