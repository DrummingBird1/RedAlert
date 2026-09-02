'use strict';
// פלאט-קונפיג (ESLint 9+) — מיגרציה מ-.eslintrc.json. שומר בכוונה רק על כללי "באג אמיתי":
// לא נוספו כללי סגנון (max-len/quotes/semi/indent/no-mixed-operators) — הקוד one-liners דחוסים בכוונה.
const globals = require('globals');

const domGlobals = {
  L: 'readonly',
  indexedDB: 'readonly',
  speechSynthesis: 'readonly',
  SpeechSynthesisUtterance: 'readonly',
  Notification: 'readonly',
  AudioContext: 'readonly',
  webkitAudioContext: 'readonly',
  PushManager: 'readonly',
  EventSource: 'readonly',
  ServiceWorkerRegistration: 'readonly',
};

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        ...globals.serviceworker,
        ...globals.worker,
        ...domGlobals,
        // server.js עושה const crypto = require('crypto') — לא ה-Web Crypto API הגלובלי של Node
        crypto: 'off',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-debugger': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unused-private-class-members': 'warn',
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
      'valid-typeof': 'error',
      'use-isnan': 'error',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-var': 'warn',
      'prefer-const': ['warn', { destructuring: 'all' }],
    },
  },
  {
    files: ['test/unit.js', 'test/integration.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    // page.evaluate(() => tglShl()) מריץ בקונטקסט הדפדפן — tglShl מוגדר ב-index.html, לא בקובץ הזה
    files: ['test/e2e.js'],
    languageOptions: {
      globals: {
        tglShl: 'readonly',
      },
    },
  },
];
