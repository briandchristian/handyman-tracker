/**
 * Ensures the Mongo connection string targets a specific database.
 * URIs like mongodb://host1,h2,h3/?opts (nothing before ?) default to DB "test".
 */
/**
 * True when the URI has no database path segment (driver defaults to "test").
 * Examples: mongodb://h1,h2,h3/?opts, mongodb+srv://cluster.net?opts
 */
export function mongoConnectionStringMissingDbName(uri) {
  if (!uri) return true;
  const qIdx = uri.indexOf('?');
  const base = qIdx === -1 ? uri : uri.slice(0, qIdx);
  if (base.endsWith('/')) {
    const seg = base.slice(base.lastIndexOf('/') + 1);
    return seg === '';
  }
  if (/^mongodb(\+srv)?:\/\/[^/?]+$/.test(base)) return true;
  return false;
}

export function applyMongoDatabaseName(uri, dbName) {
  const name = typeof dbName === 'string' ? dbName.trim() : '';
  if (!name || !uri) return uri;

  const qIdx = uri.indexOf('?');
  const base = qIdx === -1 ? uri : uri.slice(0, qIdx);
  const qs = qIdx === -1 ? '' : uri.slice(qIdx);

  const withPath = /^mongodb(\+srv)?:\/\/[^/]+\/(.+)$/.exec(base);
  if (withPath && withPath[2] != null && withPath[2].length > 0) {
    return uri;
  }

  if (base.endsWith('/')) {
    return `${base}${name}${qs}`;
  }

  if (/^mongodb(\+srv)?:\/\/[^/?]+$/.test(base)) {
    return `${base}/${name}${qs}`;
  }

  return uri;
}
