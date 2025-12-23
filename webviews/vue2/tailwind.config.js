const tailwindDefaults = require('@gitlab/ui/tailwind.defaults');

module.exports = {
  content: [
    './*/src/**/*.{vue,js}',
    './*/index.html',
    './node_modules/@gitlab/ui/dist/**/*.{vue,js}',
    './node_modules/@gitlab/duo-ui/dist/**/*.{vue,js}',
  ],
  presets: [tailwindDefaults],
};
