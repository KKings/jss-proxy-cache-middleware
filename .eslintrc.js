module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
    },
    extends: [
        'airbnb-base',
    ],
    parserOptions: {
        ecmaVersion: 12,
    },
    rules: {
        indent: ['error', 4],
        'comma-dangle': 'error',
        'no-unused-expressions': 'error',
        'no-trailing-spaces': 'error',
        'linebreak-style': ['error', 'windows'],
        'function-paren-newline': 'off',
        'max-len': ['error', { code: 125 }],
    },
};
