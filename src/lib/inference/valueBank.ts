// Realistic value pools for each semantic category.
// Each pool has 8–12 entries. Selection is deterministic via seed arithmetic.

import type { SemanticCategory } from './semanticMap'

type ValuePool = ReadonlyArray<string | number | boolean>

// DJB2 hash — deterministic, no randomness, distributes well across pool indices.
export function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return h
}

// Select an item from a pool at position (seed % pool.length).
// Combine hashStr(fieldName) + instanceIndex as the seed so that:
//   - different fields get different values
//   - different instances of the same field get the next value in the pool
export function pickFromPool<T>(pool: readonly T[], seed: number): T {
  return pool[seed % pool.length]
}

export const VALUE_BANK: Record<SemanticCategory, ValuePool> = {
  ID: [
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    'a97c7b3e-d3f8-4a5c-9b1e-2f3c4d5e6f7a',
    'b12c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
    'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
  ],

  PERSON_NAME: [
    'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown',
    'Eva Martinez', 'Frank Wilson', 'Grace Lee', 'Henry Davis',
    'Iris Thompson', 'Jack Anderson',
  ],

  FIRST_NAME: [
    'Alice', 'Bob', 'Carol', 'David', 'Eva',
    'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
  ],

  LAST_NAME: [
    'Johnson', 'Smith', 'Williams', 'Brown', 'Martinez',
    'Wilson', 'Lee', 'Davis', 'Thompson', 'Anderson',
  ],

  EMAIL: [
    'alice.johnson@example.com',
    'bob.smith@company.com',
    'carol.williams@test.org',
    'david.brown@example.net',
    'eva.martinez@sample.io',
    'frank.wilson@example.com',
    'grace.lee@company.org',
    'henry.davis@test.com',
  ],

  PHONE: [
    '+1 (555) 234-5678',
    '+1 (555) 345-6789',
    '+1 (555) 456-7890',
    '+44 20 7123 4567',
    '+1 (555) 567-8901',
    '+1 (555) 678-9012',
    '+1 (555) 789-0123',
    '+61 2 9876 5432',
  ],

  URL: [
    'https://example.com',
    'https://www.company.com',
    'https://sample.io',
    'https://test.org',
    'https://demo.app',
    'https://www.example.net',
    'https://platform.io',
    'https://service.dev',
  ],

  IMAGE_URL: [
    'https://example.com/images/avatar.jpg',
    'https://example.com/images/photo-1.jpg',
    'https://example.com/images/thumbnail.png',
    'https://example.com/assets/avatar.png',
    'https://example.com/images/profile.jpg',
    'https://example.com/images/cover.jpg',
    'https://example.com/media/image-1.jpg',
    'https://example.com/images/photo-2.jpg',
  ],

  DATE: [
    '2024-03-15T10:30:00.000Z',
    '2024-06-22T14:45:00.000Z',
    '2024-01-10T08:00:00.000Z',
    '2024-09-05T16:20:00.000Z',
    '2023-12-01T12:00:00.000Z',
    '2024-04-18T09:15:00.000Z',
    '2024-07-30T18:00:00.000Z',
    '2023-11-11T11:11:00.000Z',
  ],

  DATE_ONLY: [
    '1990-06-25',
    '1985-03-12',
    '1992-11-08',
    '1978-07-19',
    '2000-01-01',
    '1995-09-30',
    '1988-02-14',
    '2001-05-22',
  ],

  PRICE: [29.99, 14.99, 49.99, 9.99, 99.99, 24.99, 59.99, 4.99, 79.99, 19.99],

  QUANTITY: [1, 3, 5, 10, 2, 7, 4, 8, 6, 12],

  AGE: [28, 34, 22, 45, 31, 27, 39, 52, 18, 41],

  STATUS: [
    'active', 'pending', 'completed', 'published',
    'approved', 'verified', 'enabled', 'open',
  ],


  SLUG: [
    'alice-johnson', 'getting-started', 'my-first-post',
    'bob-smith', 'featured-content', 'sample-article',
    'carol-williams', 'example-entry',
  ],

  COMPANY: [
    'Acme Corp', 'TechFlow Inc', 'DataSync Ltd', 'CloudBase Systems',
    'NexGen Solutions', 'BrightSpark Technologies', 'SwiftBuild LLC', 'Apex Industries',
  ],

  JOB_TITLE: [
    'Software Engineer', 'Product Manager', 'UX Designer', 'Data Analyst',
    'DevOps Engineer', 'Frontend Developer', 'Backend Engineer', 'Engineering Manager',
  ],

  ADDRESS: [
    '123 Main St', '456 Oak Avenue', '789 Pine Road', '321 Elm Street',
    '654 Maple Drive', '987 Cedar Lane', '147 Birch Boulevard', '258 Willow Way',
  ],

  CITY: [
    'New York', 'San Francisco', 'Chicago', 'London',
    'Austin', 'Seattle', 'Toronto', 'Boston',
  ],

  COUNTRY: [
    'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'Japan', 'Netherlands',
  ],

  ZIP: ['10001', '94105', '60601', 'WC2N 5DU', '78701', '98101', 'M5V 3A8', '02101'],

  LOCALE: ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'pt-BR', 'it-IT'],

  CURRENCY: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NZD'],

  COLOR: [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  ],

  BOOLEAN_POSITIVE: [true],

  BOOLEAN_NEGATIVE: [false],

  VERSION: ['1.0.0', '2.3.1', '0.9.4', '3.1.0', '1.2.3', '4.0.0-beta.1', '2.0.0-rc.1', '1.1.1'],

  TOKEN: [
    'test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    'test_a8f5f167f44f4964e6c998dee827110c',
    'test_4a7d1ed414474e4033ac29ccb8653d9b',
    'test_abc123def456ghi789jkl012mno345pqr',
    'test_xK4mN8pQ2rS6vW0yB3zA1cE5gH7jL9n',
    'test_abcdefghijklmnopqrstuvwxyz012345',
    'test_d41d8cd98f00b204e9800998ecf8427e',
    'test_9a0364b9e99bb480dd25e1f0284c8555',
  ],

  IP: [
    '192.168.1.1', '10.0.0.1', '172.16.0.1', '192.168.0.100',
    '10.10.10.10', '203.0.113.42', '198.51.100.15', '192.0.2.1',
  ],
}

// ---------------------------------------------------------------------------
// Adversarial value pools (V2.1)
// ---------------------------------------------------------------------------
// When isAdversarial mode is enabled, these pools are sampled at 60 %
// probability for primitive string / number fields to smoke-test XSS,
// SQLi, and numeric boundary resilience.

export const ADVERSARIAL_XSS: readonly string[] = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
]

export const ADVERSARIAL_SQLI: readonly string[] = [
  "' OR 1=1--",
  "'; DROP TABLE users;--",
]

export const ADVERSARIAL_BOUNDARIES: readonly (string | number)[] = [
  'A'.repeat(5000),
  0,
  -1,
  Number.MAX_SAFE_INTEGER,
]
