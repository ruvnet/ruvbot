// postcss.config.js
module.exports = {
  plugins: {
    'tailwindcss/nesting': {}, // or use 'postcss-nesting' if needed
    'tailwindcss': {},
    'autoprefixer': {},
    // Any other plugins you want to add should also be strings
  },
};
