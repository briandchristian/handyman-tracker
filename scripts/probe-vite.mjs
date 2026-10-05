process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function grab(url) {
  const res = await fetch(url);
  const text = await res.text();
  console.log('\n==', url, res.status, 'len', text.length);
  console.log(text.slice(0, 800));
}

await grab('https://127.0.0.1:5173/');
await grab('https://127.0.0.1:5173/src/main.jsx');
await grab('https://127.0.0.1:5173/src/App.jsx');
