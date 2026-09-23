import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, validateBudgets, parseToml, calculateSchemaTokens, EXIT_CODES } from '../registry.mjs';

test('EXIT_CODES enumeration contains standard error codes', () => {
  assert.equal(EXIT_CODES.SUCCESS, 0);
  assert.equal(EXIT_CODES.ERR_BUDGET_VIOLATION, 10);
  assert.equal(EXIT_CODES.ERR_AST_PARSE_FAILURE, 20);
  assert.equal(EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE, 30);
  assert.equal(EXIT_CODES.ERR_CLIENT_CONFIG_INVALID, 40);
  assert.equal(EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID, 50);
});

test('parseToml parses sections, subkeys, arrays, and scalars', () => {
  const tomlSample = `
# Registry test
registry_version = "2026-09-08"
schema_version = 1

[profiles.minimal]
description = "Test minimal"
max_tools = 4
max_schema_tokens = 2500
servers = ["s1", "s2"]

[servers.s1]
transport = "stdio"
schema_weight = 500
enabled = true
`;
  const parsed = parseToml(tomlSample);
  assert.equal(parsed.registry_version, '2026-09-08');
  assert.equal(parsed.schema_version, 1);
  assert.ok(parsed.profiles.minimal);
  assert.equal(parsed.profiles.minimal.max_tools, 4);
  assert.deepEqual(parsed.profiles.minimal.servers, ['s1', 's2']);
  assert.equal(parsed.servers.s1.schema_weight, 500);
  assert.equal(parsed.servers.s1.enabled, true);
});

test('parseToml handles trailing comments and throws on invalid syntax', () => {
  const tomlWithComments = `
key1 = "val#with#hash" # this is a comment
num = 42 # trailing number comment
`;
  const parsed = parseToml(tomlWithComments);
  assert.equal(parsed.key1, 'val#with#hash');
  assert.equal(parsed.num, 42);

  assert.throws(() => {
    parseToml('this is not valid toml');
  }, (err) => {
    return err.exitCode === EXIT_CODES.ERR_AST_PARSE_FAILURE;
  });
});

test('loadRegistry loads the canonical mcp-registry.toml cleanly', () => {
  const reg = loadRegistry('C:/dev/.sigil/mcp-registry.toml');
  assert.equal(reg.registry_version, '2026-09-08');
  assert.ok(reg.profiles.minimal);
  assert.ok(reg.profiles['dev-minimal']);
  assert.ok(reg.profiles.dev);
  assert.ok(reg.profiles.research);
  assert.ok(reg.profiles.full);
  assert.ok(reg.servers['kb-context-cache']);
  assert.ok(reg.servers['ijfw-memory']);
});

test('loadRegistry throws on non-existent file', () => {
  assert.throws(() => {
    loadRegistry('C:/dev/.sigil/non-existent-registry.toml');
  }, (err) => {
    return err.exitCode === EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
  });
});

test('validateBudgets succeeds on canonical mcp-registry.toml', () => {
  const reg = loadRegistry('C:/dev/.sigil/mcp-registry.toml');
  const result = validateBudgets(reg);
  assert.equal(result.valid, true);
  assert.equal(result.exitCode, EXIT_CODES.SUCCESS);
  assert.equal(result.errors.length, 0);

  // Validate headroom calculations
  assert.ok(result.profileStats.minimal.headroomTokens >= 0);
  assert.ok(result.profileStats.dev.headroomTokens >= 0);
  assert.ok(result.profileStats.full.headroomTokens >= 0);
  assert.equal(result.profileStats.dev.status, 'OK');
});

test('validateBudgets catches tool count and token overruns', () => {
  const invalidReg = {
    profiles: {
      overflow_tools: {
        max_tools: 1,
        max_schema_tokens: 5000,
        servers: ['s1', 's2']
      },
      overflow_tokens: {
        max_tools: 5,
        max_schema_tokens: 100,
        servers: ['s1']
      }
    },
    servers: {
      s1: { schema_weight: 400 },
      s2: { schema_weight: 300 }
    }
  };
  const result = validateBudgets(invalidReg);
  assert.equal(result.valid, false);
  assert.equal(result.exitCode, EXIT_CODES.ERR_BUDGET_VIOLATION);
  assert.ok(result.errors.some(e => e.includes('max_tools')));
  assert.ok(result.errors.some(e => e.includes('max_schema_tokens')));
  assert.equal(result.profileStats.overflow_tools.status, 'OVER_BUDGET');
  assert.equal(result.profileStats.overflow_tokens.status, 'OVER_BUDGET');
});

test('validateBudgets catches undefined server references', () => {
  const invalidReg = {
    profiles: {
      broken: {
        max_tools: 5,
        max_schema_tokens: 5000,
        servers: ['non_existent_server']
      }
    },
    servers: {}
  };
  const result = validateBudgets(invalidReg);
  assert.equal(result.valid, false);
  assert.equal(result.exitCode, EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID);
  assert.ok(result.errors.some(e => e.includes("references undefined server 'non_existent_server'")));
});

test('validateBudgets honors customTokenCounts override', () => {
  const reg = {
    profiles: {
      p1: {
        max_tools: 5,
        max_schema_tokens: 1000,
        servers: ['s1']
      }
    },
    servers: {
      s1: { schema_weight: 200 }
    }
  };
  // Default passes (200 <= 1000)
  const defaultResult = validateBudgets(reg);
  assert.equal(defaultResult.valid, true);
  assert.equal(defaultResult.profileStats.p1.totalTokens, 200);
  assert.equal(defaultResult.profileStats.p1.headroomTokens, 800);

  // Override pushes s1 to 1200, violating budget
  const overriddenResult = validateBudgets(reg, { s1: 1200 });
  assert.equal(overriddenResult.valid, false);
  assert.equal(overriddenResult.exitCode, EXIT_CODES.ERR_BUDGET_VIOLATION);
  assert.equal(overriddenResult.profileStats.p1.totalTokens, 1200);
  assert.equal(overriddenResult.profileStats.p1.headroomTokens, -200);
});

test('calculateSchemaTokens returns exact token count with js-tiktoken cl100k_base', () => {
  const schema = {
    name: 'test_tool',
    description: 'A tool for testing calculation',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } }
  };
  const count = calculateSchemaTokens(schema);
  // js-tiktoken cl100k_base encodes JSON.stringify(schema) to exactly 30 tokens
  assert.equal(count, 30);

  // Verify string input handling
  const strCount = calculateSchemaTokens('{"name":"test_tool"}');
  assert.ok(strCount > 0);
});
