module.exports = {
  rootDir: "../../",
  testMatch: ["<rootDir>/tests/server/**/*.test.js"],
  testEnvironment: "node",
  // Tests exercise server/ code and need to require/mock its runtime deps
  // (axios, etc.), which live in server/node_modules, not the root's.
  moduleDirectories: ["node_modules", "server/node_modules"],
};
