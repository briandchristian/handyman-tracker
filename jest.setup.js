import '@testing-library/jest-dom';

// Add TextEncoder/TextDecoder polyfills for Node.js
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock the API config globally
jest.mock('./src/config/api.js', () => ({
  default: 'http://192.168.50.87:5000'
}), { virtual: true });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator.mediaDevices (for BarcodeScanner/Camera components)
const mockMediaStream = {
  getTracks: jest.fn(() => [
    {
      stop: jest.fn(),
      kind: 'video',
      label: 'Mock Camera',
    },
  ]),
  getVideoTracks: jest.fn(() => [
    {
      stop: jest.fn(),
      kind: 'video',
      label: 'Mock Camera',
    },
  ]),
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
    enumerateDevices: jest.fn().mockResolvedValue([]),
  },
});

// Mock BarcodeDetector API (not widely supported, so mock it)
global.window.BarcodeDetector = jest.fn().mockImplementation(() => ({
  detect: jest.fn().mockResolvedValue([]),
}));

// Mock FileReader (used for CSV imports)
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  onload: null,
  onerror: null,
  result: '',
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock window.print
global.window.print = jest.fn();

// Mock window.open for print dialogs
global.window.open = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
  print: jest.fn(),
  close: jest.fn(),
}));

// Mock document.createElement for file downloads/uploads
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tagName) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'a') {
    // Mock anchor element for downloads
    element.click = jest.fn();
    element.remove = jest.fn();
  }
  if (tagName === 'input') {
    // Mock file input
    element.click = jest.fn();
  }
  return element;
});

// Mock localStorage with actual storage
const localStorageMock = (() => {
  let store = {};
  
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

global.localStorage = localStorageMock;

// Reset localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});

// Mock window.location if not already mocked
if (!global.window.location || global.window.location.href === undefined || global.window.location.href === 'about:blank') {
  delete global.window.location;
  global.window.location = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    reload: jest.fn(),
    replace: jest.fn(),
    assign: jest.fn(),
  };
}

