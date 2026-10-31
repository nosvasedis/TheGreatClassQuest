import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

function cssFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...cssFiles(rel));
        else if (entry.name.endsWith('.css')) out.push(rel);
    }
    return out;
}

const TOKENS = {
    "'Fredoka One','Fredoka',sans-serif": '--gcq-font-title',
    "'Fredoka',sans-serif": '--gcq-font-display',
    "'Open Sans',sans-serif": '--gcq-font-body',
    "'Lora',Georgia,serif": '--gcq-font-serif',
    "'Cinzel',serif": '--gcq-font-rune',
    "'Caveat',cursive": '--gcq-font-hand',
};
const norm = (value) => value.replace(/"/g, "'").replace(/\s*,\s*/g, ',').replace(/\s*!important\s*$/, '').trim();

test('style.css loads the shared tokens before every other sheet', () => {
    const style = read('style.css');
    const imports = [...style.matchAll(/@import url\('([^']+)'\)/g)].map((m) => m[1]);
    const local = imports.filter((p) => p.startsWith('./styles/') && !p.endsWith('tailwind.css'));
    assert.equal(local[0], './styles/tokens.css');
});

test('tokens.css defines every shared font token', () => {
    const tokens = read('styles/tokens.css');
    for (const [stack, name] of Object.entries(TOKENS)) {
        const m = tokens.match(new RegExp(`${name}:\\s*([^;]+);`));
        assert.ok(m, `${name} is defined`);
        assert.equal(norm(m[1]), stack, `${name} keeps its stack`);
    }
});

test('sheets use the font tokens instead of repeating the stacks', () => {
    const offenders = [];
    const files = [...cssFiles('styles'), ...cssFiles('mobile/styles'), ...cssFiles('features')]
        .filter((f) => !/styles\/(tokens|tailwind)\.css$/.test(f));
    for (const file of files) {
        const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/g)) {
            const token = TOKENS[norm(m[1])];
            if (token) offenders.push(`${file}: use var(${token})`);
        }
    }
    assert.deepEqual(offenders, []);
});
