module.exports = {
  root: true,
  extends: ['airbnb-base', 'prettier', 'plugin:vue/strongly-recommended'],
  plugins: ['import', 'vue'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.vue'],
      },
    },
  },
  globals: {
    acquireVsCodeApi: 'readonly',
  },
  env: {
    jest: true,
    es6: true,
  },
  ignorePatterns: ['node_modules', 'dist'],
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        vue: 'always',
      },
    ],
    'no-console': 'off',
    'no-return-await': 'off',
    'import/no-extraneous-dependencies': 'off',
    'vue/no-v-html': 'error',
    'vue/max-attributes-per-line': 'off',
    'vue/html-indent': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-self-closing': 'off',
    'vue/multi-word-component-names': 'warn',
  },
  reportUnusedDisableDirectives: true,
};
