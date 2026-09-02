---
name: testing-jest-config-pattern
description: Jest config pattern for TypeScript services in monorepo
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5fcd286a-45b4-4e37-8df0-7d777da14d2e
---

**Jest Configuration Pattern**

All services follow this jest.config.js structure:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
```

**Key points:**
- `preset: 'ts-jest'` — enables TypeScript compilation before test execution
- `roots` — limits test discovery to specific directories (avoids node_modules)
- `testMatch` — glob pattern for finding test files (`*.test.ts` or `*.spec.ts`)
- `testTimeout: 30000` — database operations need 30s, increase if needed
- Optional `moduleNameMapper` — for mocking native modules (e.g., better-sqlite3)

**Dev dependencies required:**
```json
{
  "devDependencies": {
    "@types/jest": "^29.5.8",
    "@types/node": "^20.9.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "^5.2.2"
  }
}
```

**Installation note:** Use `npm install --ignore-scripts` on Windows to skip native module builds during setup. Full build happens in Docker.

**Files created this session:**
- `services/torquequery/jest.config.js`
- `services/vault/jest.config.js`
- `services/repomix-ingestion/jest.config.js`
- `services/cic-governance/jest.config.js`
- `services/unified-api/jest.config.js`
