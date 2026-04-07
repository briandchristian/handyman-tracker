import {
  applyMongoDatabaseName,
  mongoConnectionStringMissingDbName,
} from '../mongoUri.js';

describe('mongoConnectionStringMissingDbName', () => {
  it('detects empty path before query string', () => {
    expect(
      mongoConnectionStringMissingDbName(
        'mongodb://h1:27017,h2:27017/?tls=true'
      )
    ).toBe(true);
  });

  it('detects srv URI without path', () => {
    expect(
      mongoConnectionStringMissingDbName(
        'mongodb+srv://cluster.example.net?retryWrites=true'
      )
    ).toBe(true);
  });

  it('false when database segment is present', () => {
    expect(
      mongoConnectionStringMissingDbName(
        'mongodb://h1:27017,h2:27017/mydb?tls=true'
      )
    ).toBe(false);
  });
});

describe('applyMongoDatabaseName', () => {
  it('inserts database name before query when path is empty (replica hosts)', () => {
    const uri =
      'mongodb://h1:27017,h2:27017,h3:27017/?tls=true&replicaSet=rs0&authSource=admin';
    expect(applyMongoDatabaseName(uri, 'myapp')).toBe(
      'mongodb://h1:27017,h2:27017,h3:27017/myapp?tls=true&replicaSet=rs0&authSource=admin'
    );
  });

  it('does not change URI when database name is already present', () => {
    const uri =
      'mongodb://h1:27017,h2:27017,h3:27017/existing?tls=true&authSource=admin';
    expect(applyMongoDatabaseName(uri, 'other')).toBe(uri);
  });

  it('adds path for mongodb+srv host with no slash before query', () => {
    const uri = 'mongodb+srv://cluster.example.net?retryWrites=true&w=majority';
    expect(applyMongoDatabaseName(uri, 'prod')).toBe(
      'mongodb+srv://cluster.example.net/prod?retryWrites=true&w=majority'
    );
  });

  it('returns original URI when dbName is empty', () => {
    const uri = 'mongodb://h/?x=1';
    expect(applyMongoDatabaseName(uri, '')).toBe(uri);
    expect(applyMongoDatabaseName(uri, '   ')).toBe(uri);
  });
});
