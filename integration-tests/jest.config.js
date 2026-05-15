const { loadEnv } = require("@medusajs/framework/utils")
if (!process.env.CI) {
  loadEnv("test", process.cwd())
}

// medusaIntegrationTestRunner reads these at module load time; ensure defaults in CI
process.env.DB_HOST = process.env.DB_HOST || "localhost"
process.env.DB_PORT = process.env.DB_PORT || "5432"
process.env.DB_USERNAME = process.env.DB_USERNAME || "openstore"
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "openstore"

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2021",
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/"],
  setupFiles: ["./setup.js"],
}

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/http/**/*.spec.[jt]s"]
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"]
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"]
}