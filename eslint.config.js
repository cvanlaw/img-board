const js = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  js.configs.recommended,
  // Browser scripts with HTML onclick handlers need relaxed unused-vars rule
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern:
            '^(saveSlideshow|savePreprocessing|manualReprocess|uploadFiles|goToPage|toggleExclusion|deleteImage|restoreImage|permanentDeleteImage|toggleSelection|bulkAction|rotateImage)$',
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['node_modules/', 'coverage/'],
  },
];
