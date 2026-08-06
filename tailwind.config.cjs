module.exports = {
  content: [
    './index.html',
    './*.js',
    './config/**/*.js',
    './db/**/*.js',
    './features/**/*.js',
    './templates/**/*.js',
    './ui/**/*.js',
    './utils/**/*.js',
  ],
  safelist: [
    { pattern: /^(bg|text|border|from|via|to)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray)-(50|100|200|300|400|500|600|700|800|900)$/ },
    { pattern: /^col-span-(1|2|3|4|5|6|7|8|9|10|11|12)$/ },
    { pattern: /^grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)$/ },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
