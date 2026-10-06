// Pure helpers for the operator console (unit-tested; the server validates every code again).
import { normalizeSchoolId } from '../utils/tenant.mjs';

const GREEK_TO_LATIN = {
    α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i', θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i',
    κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y',
    φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o'
};

// "Φροντιστήριο Άλφα Πάτρας" -> "frontistirio-alfa-patras". A suggestion the operator can edit.
export function suggestSchoolCode(name) {
    const latin = Array.from(String(name ?? '').toLowerCase()).map((ch) => GREEK_TO_LATIN[ch] ?? ch).join('');
    const slug = latin.normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
    return normalizeSchoolId(slug) || '';
}
