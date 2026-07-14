import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Manifest Schema Tests', () => {
  const schemaPath = path.join(__dirname, '../../../docs/toolforge/schemas/skill.marketplace.schema.json');
  const skillJsonPath = path.join(__dirname, '../SKILL.json');

  it('schema file exists', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('schema is valid JSON', () => {
    const content = fs.readFileSync(schemaPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('schema is JSONSchema Draft 7', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('schema defines required fields', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const required = schema.required;
    expect(required).toContain('id');
    expect(required).toContain('name');
    expect(required).toContain('version');
    expect(required).toContain('description');
    expect(required).toContain('status');
    expect(required).toContain('category');
    expect(required).toContain('runtime');
    expect(required).toContain('entrypoint');
    expect(required).toContain('owner');
  });

  it('schema defines id pattern', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.properties.id.pattern).toBe('^[a-z0-9-]+$');
  });

  it('schema defines version pattern (semver)', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.properties.version.pattern).toContain('\\d+');
  });

  it('schema defines _marketplace object', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.properties._marketplace).toBeDefined();
    expect(schema.properties._marketplace.properties.registry_entry).toBeDefined();
  });

  it('schema requires _marketplace.registry_entry', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.properties._marketplace.required).toContain('registry_entry');
  });

  it('schema defines submission_status enum', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const statusEnum = schema.properties._marketplace.properties.submission_status.enum;
    expect(statusEnum).toContain('pending');
    expect(statusEnum).toContain('approved');
    expect(statusEnum).toContain('published');
    expect(statusEnum).toContain('rejected');
    expect(statusEnum).toContain('deprecated');
  });

  it('schema defines conformance_check structure', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const conformance = schema.properties._marketplace.properties.conformance_check;
    expect(conformance.properties.checks).toBeDefined();
    expect(conformance.properties.blockers).toBeDefined();
  });

  it('SKILL.json contains valid _marketplace fields', () => {
    const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
    expect(skillJson._marketplace).toBeDefined();
    expect(skillJson._marketplace.registry_entry).toBe('toolforge-marketplace:1.0');
    expect(skillJson._marketplace.submission_status).toBe('pending');
    expect(skillJson._marketplace.conformance_check).toBeDefined();
  });

  it('no breaking changes to existing SKILL.json fields', () => {
    const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
    // Verify existing fields still present
    expect(skillJson.id).toBe('tool-lifecycle-manager');
    expect(skillJson.name).toBe('Tool Lifecycle Manager');
    expect(skillJson.version).toBe('0.1.0');
    expect(skillJson.status).toBe('active');
    expect(skillJson.category).toBe('pipeline');
  });
});
