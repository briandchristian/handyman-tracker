import fs from 'fs';
import path from 'path';

const metaPath = path.resolve(process.cwd(), '.github/repo-metadata.json');

describe('GitHub repo metadata', () => {
  test('defines description, homepage, and topics for sync on push', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    expect(meta.description).toMatch(/Christian Security Services/i);
    expect(meta.description).not.toMatch(/Fixit Phillips/i);
    expect(meta.homepage).toMatch(/^https:\/\//);
    expect(meta.topics).toEqual(
      expect.arrayContaining(['security', 'react'])
    );
  });
});
