const DAILY_WALLPAPER_AI_TYPES = new Set([
    'fact_science',
    'fact_history',
    'fact_nature',
    'fact_geography',
    'fact_math',
    'did_you_know',
    'joke',
    'riddle',
    'brain_teaser',
    'word',
    'idiom',
    'tongue_twister'
]);

function stripMarkdownFences(text) {
    return String(text || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
}

function extractCompleteJsonObjects(text) {
    const found = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            if (depth === 0) start = i;
            depth += 1;
        } else if (ch === '}') {
            if (depth === 0) continue;
            depth -= 1;
            if (depth === 0 && start !== -1) {
                try {
                    const obj = JSON.parse(text.slice(start, i + 1));
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) found.push(obj);
                } catch (_) { /* incomplete or invalid object — skip */ }
                start = -1;
            }
        }
    }
    return found;
}

function coerceItemArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    if (parsed && typeof parsed === 'object' && parsed.type && parsed.content) return [parsed];
    return [];
}

function normalizeWallpaperAiItem(item) {
    if (!item || typeof item !== 'object') return null;
    let type = String(item.type || '').trim();
    if (type.startsWith('ai_')) type = type.slice(3);
    const content = String(item.content || '').trim();
    if (!DAILY_WALLPAPER_AI_TYPES.has(type) || !content) return null;
    const answer = String(item.answer || '').trim();
    return answer ? { type, content, answer } : { type, content };
}

/**
 * Parse daily wallpaper AI items from a model response.
 * Never throws on empty or truncated JSON; returns only valid complete items.
 */
export function parseDailyWallpaperAiItems(text) {
    const cleaned = stripMarkdownFences(text);
    if (!cleaned) return [];

    let items = [];
    try {
        items = coerceItemArray(JSON.parse(cleaned));
    } catch (_) { /* fall through */ }

    if (items.length === 0) {
        const arrStart = cleaned.indexOf('[');
        const arrEnd = cleaned.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd > arrStart) {
            try {
                items = coerceItemArray(JSON.parse(cleaned.slice(arrStart, arrEnd + 1)));
            } catch (_) { /* fall through */ }
        }
    }

    if (items.length === 0) {
        items = extractCompleteJsonObjects(cleaned);
    }

    return items.map(normalizeWallpaperAiItem).filter(Boolean);
}

export { DAILY_WALLPAPER_AI_TYPES };
