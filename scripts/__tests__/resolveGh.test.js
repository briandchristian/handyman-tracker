import { existsSync } from 'fs';
import { resolveGhExecutable } from '../resolve-gh.js';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('resolveGhExecutable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.GH_EXE;
    delete process.env.GH_PATH;
  });

  test('prefers GH_EXE when the file exists', () => {
    process.env.GH_EXE = 'D:\\tools\\gh.exe';
    existsSync.mockImplementation((p) => p === 'D:\\tools\\gh.exe');

    expect(resolveGhExecutable()).toBe('D:\\tools\\gh.exe');
  });

  test('uses default Windows install path when gh is not on PATH', () => {
    existsSync.mockImplementation(
      (p) => p === 'C:\\Program Files\\GitHub CLI\\gh.exe'
    );

    expect(resolveGhExecutable()).toBe('C:\\Program Files\\GitHub CLI\\gh.exe');
  });
});
