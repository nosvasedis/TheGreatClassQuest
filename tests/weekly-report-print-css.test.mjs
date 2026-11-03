import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// html2canvas 1.4 throws on CSS colour functions it cannot parse (color-mix, oklch, lab…), which
// aborts the Weekly Report PDF. Every rule using one must be overridden for the print copy.
const css = readFileSync(new URL('../styles/weekly_report.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MODERN_COLOUR = /\b(color-mix|oklch|oklab|lab|lch)\(/;

function rules(source) {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(source))) out.push({ selector: m[1].trim(), body: m[2] });
    return out;
}

test('weekly report print copy overrides every modern colour function', () => {
    const all = rules(css);
    const printSelectors = all.filter((r) => r.selector.includes('.wr-body--print')).map((r) => r.selector);
    for (const rule of all) {
        if (!MODERN_COLOUR.test(rule.body) || rule.selector.includes('.wr-body--print')) continue;
        for (const declaration of rule.body.split(';')) {
            if (!MODERN_COLOUR.test(declaration)) continue;
            const property = declaration.split(':')[0].trim();
            const overridden = all.some((r) => r.selector.includes('.wr-body--print')
                && rule.selector.split(',').some((s) => r.selector.includes(s.trim()))
                && new RegExp(`(^|;|\\s)${property}\\s*:`).test(r.body)
                && !MODERN_COLOUR.test(r.body));
            assert.ok(overridden, `${rule.selector} { ${property} } needs a plain .wr-body--print override (print rules: ${printSelectors.join(' | ')})`);
        }
    }
});
