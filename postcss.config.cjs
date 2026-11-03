// Tailwind 4 makes leading-* win over every text-* size, breakpoint variants included; on Tailwind 3
// a later text-* (md:text-4xl) set its own line height again. Keep the Tailwind 3 behaviour.
const textSizesKeepTheirLineHeight = {
  postcssPlugin: 'gcq-text-sizes-keep-their-line-height',
  Declaration: {
    'line-height'(decl) {
      decl.value = decl.value.replace(/^var\(--tw-leading,\s*(var\(--text-[\w-]+--line-height\))\)$/, '$1');
    },
  },
};

module.exports = {
  plugins: [
    // optimize: false leaves minifying to Vite, so the hand-written sheets are not rewritten.
    require('@tailwindcss/postcss')({ optimize: false }),
    textSizesKeepTheirLineHeight,
    require('autoprefixer'),
  ],
};
