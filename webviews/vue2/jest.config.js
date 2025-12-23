module.exports = () => {
  const glob = `**/*.test.js`;
  const testMatch = [`<rootDir>/${glob}`];

  const moduleNameMapper = {
    '\\.(svg|gif|png|mp4)(\\?\\w+)?$': '<rootDir>/__mocks__/file_mock.js',
    '\\.css$': '<rootDir>/__mocks__/file_mock.js',
  };

  const transformIgnoreNodeModules = [
    '@gitlab/ui',
    '@gitlab/svgs',
    '@gitlab/duo-ui',
    'bootstrap-vue',
  ];

  return {
    testMatch,
    moduleNameMapper,
    moduleFileExtensions: ['js', 'vue'],
    transform: {
      '.*\\.(vue)$': 'vue-jest',
      '^.+\\.js$': 'babel-jest',
    },
    transformIgnorePatterns: [`node_modules/(?!(${transformIgnoreNodeModules.join('|')}))`],
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  };
};
