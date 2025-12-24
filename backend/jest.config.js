
module.exports = {
  preset: 'ts-jest',            
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test_eng*.test.ts'], 
  transform: {                   
    '^.+\\.tsx?$': 'ts-jest',
  },
};
