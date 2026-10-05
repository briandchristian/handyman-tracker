process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let last = '';
for (let i = 0; i < 30; i += 1) {
  try {
    const res = await fetch('https://127.0.0.1:5173/src/components/Inventory.jsx');
    const text = await res.text();
    const hasDefault = text.length > 1000 && text.includes('Part number');
    console.log('try', i, 'status', res.status, 'len', text.length, 'hasComponent', hasDefault);
    if (hasDefault) {
      process.exit(0);
    }
    last = text.slice(0, 200);
  } catch (err) {
    console.log('try', i, err.message);
  }
  await sleep(1000);
}
console.log('FAILED', last);
process.exit(1);
