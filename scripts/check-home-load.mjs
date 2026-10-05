import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  await server.ssrLoadModule('/src/App.jsx');
  console.log('SSR_LOAD_OK');
} catch (err) {
  console.error('SSR_LOAD_FAIL');
  console.error(err?.stack || err);
  process.exitCode = 1;
} finally {
  await server.close();
}
