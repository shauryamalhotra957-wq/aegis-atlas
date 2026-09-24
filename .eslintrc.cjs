module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off",
    "prefer-const": "error"
  }
};
