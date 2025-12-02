/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',            // обязательно ts-jest
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test_eng/**/*.test.ts'], // путь к твоим тестам
  transform: {                   // чтобы ts-jest обрабатывал ts/tsx файлы
    '^.+\\.tsx?$': 'ts-jest',
  },
};
