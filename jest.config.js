// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  coverageProvider: 'v8',
  coverageReporters: ['cobertura'],
  coverageDirectory: './reports',
  roots: ['src'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports',
        outputName: 'unit.xml',
        titleTemplate: '{title}',
        classNameTemplate: '{classname}',
      },
    ],
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/webviews/', '/dist-/'],
  transformIgnorePatterns: ['/node_modules/(?!(@anycable/core|p-queue|p-timeout|nanoevents)/)'],
  transform: {
    // why: For some reason, ts-jest was not working for these node_modules
    //      using babel-jest with a target of `node`, we're good to go.
    '/node_modules/(@anycable/core|p-queue|p-timeout|nanoevents).+\\.js$': 'babel-jest',
    '^.+\\.html?$': '<rootDir>/jest_html_transformer.js',
  },
  testEnvironment: 'node',
};
