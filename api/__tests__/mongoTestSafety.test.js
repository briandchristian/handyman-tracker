import { assertInMemoryMongoUri } from '../mongoTestSafety.js';

describe('assertInMemoryMongoUri', () => {
  test('allows localhost uri', () => {
    expect(() => assertInMemoryMongoUri('mongodb://127.0.0.1:27017/testdb')).not.toThrow();
    expect(() => assertInMemoryMongoUri('mongodb://localhost:27017/testdb')).not.toThrow();
  });

  test('rejects atlas uri', () => {
    expect(() =>
      assertInMemoryMongoUri('mongodb+srv://cluster.example.mongodb.net/handyman')
    ).toThrow(/Refusing destructive test cleanup/i);
  });

  test('rejects empty uri', () => {
    expect(() => assertInMemoryMongoUri('')).toThrow(/Refusing destructive test cleanup/i);
  });
});
