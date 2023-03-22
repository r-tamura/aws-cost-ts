const config = {
  testMatch: ["**/lib/**/__test__/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};

module.exports = config;
