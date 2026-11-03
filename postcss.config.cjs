module.exports = {
  plugins: {
    // optimize: false leaves minifying to Vite, so the hand-written sheets are not rewritten.
    '@tailwindcss/postcss': { optimize: false },
    autoprefixer: {},
  },
};
