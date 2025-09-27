const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 100,
  arrowParens: 'always',
  bracketSpacing: true,
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: ['^react$', '^next', '<THIRD_PARTY_MODULES>', '', '^@/(.*)$', '', '^[./]'],
  importOrderParserPlugins: ['typescript', 'jsx'],
  importOrderTypeScriptVersion: '5.4.0',
};

export default config;
