/**
 * Hard guard against destructive test cleanup against non-local MongoDB hosts.
 */
export function assertInMemoryMongoUri(uri) {
  const value = String(uri || '').trim();
  const isLocalMongo =
    value.startsWith('mongodb://127.0.0.1') ||
    value.startsWith('mongodb://localhost');

  if (!isLocalMongo) {
    throw new Error(
      `Refusing destructive test cleanup on non-local Mongo URI: "${value || '(empty)'}"`
    );
  }
}
