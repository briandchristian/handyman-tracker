process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const res = await fetch('https://127.0.0.1:5173/src/components/Inventory.jsx');
const text = await res.text();
console.log('status', res.status, 'len', text.length);
const errIdx = text.toLowerCase().indexOf('error');
console.log('---HEAD---');
console.log(text.slice(0, 500));
console.log('---TAIL---');
console.log(text.slice(-800));
if (text.includes('does not provide') || text.includes('SyntaxError') || text.includes('transform')) {
  console.log('---HIT---');
}
