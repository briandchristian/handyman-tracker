const fs = require('fs');
const path = require('path');

describe('Vite dev HTTPS', () => {
  it('uses @vitejs/plugin-basic-ssl so LAN clients get a secure context for camera APIs', () => {
    const configPath = path.join(__dirname, '..', '..', 'vite.config.js');
    const contents = fs.readFileSync(configPath, 'utf8');
    expect(contents).toMatch(/@vitejs\/plugin-basic-ssl/);
    expect(contents).toMatch(/basicSsl\s*\(/);
    expect(contents).toMatch(/v22\.21\.0/); // Node HTTPS+HMR workaround (issues/60336)
  });
});
