// ESLint (flat config). Warnings only for now: `npm run lint` never fails a build or a push.
// The aim is to see real mistakes (an undefined name, an unreachable branch, a duplicate key)
// and let the warning count fall over time. Tighten a rule to 'error' once its count is zero.
import js from '@eslint/js';
import globals from 'globals';

const recommendedAsWarnings = Object.fromEntries(
    Object.keys(js.configs.recommended.rules).map((rule) => [rule, 'warn'])
);

export default [
    {
        ignores: [
            'dist/**', 'node_modules/**', 'functions/node_modules/**', 'promo/**', 'docs/**',
            'scratch/**', '.guidebook-dist/**', 'playwright-report/**', 'test-results/**',
            '**/*.data.mjs', 'styles/**',
        ],
    },
    {
        files: ['**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                __GCQ_BUILD_ID__: 'readonly',
            },
        },
        rules: {
            ...recommendedAsWarnings,
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
        },
    },
    {
        // Node: Cloud Functions, build scripts, tools and tests.
        files: ['functions/**/*.{js,cjs,mjs}', 'scripts/**', 'tools/**', 'tests/**', 'e2e/**', '*.config.{js,mjs,cjs}'],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        files: ['**/*.cjs', 'functions/**/*.js'],
        languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
        rules: { ...recommendedAsWarnings, 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] },
    },
    {
        // Playwright specs: code inside page.evaluate() runs in the browser.
        files: ['e2e/**'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
    {
        // __GCQ_PRECACHE_MANIFEST__ is filled in by scripts/finalize-vite-build.cjs.
        files: ['service-worker.js'],
        languageOptions: { globals: { ...globals.serviceworker, __GCQ_PRECACHE_MANIFEST__: 'readonly' } },
    },
];
