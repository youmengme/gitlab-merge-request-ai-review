const presets = [
  [
    '@babel/preset-env',
    {
      targets: {
        node: 'current',
      },
    },
  ],
];

module.exports = { presets, sourceType: 'unambiguous' };
