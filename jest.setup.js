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

// Mock window.alert
global.window.alert = jest.fn();

// Mock window.open for print dialogs
global.window.open = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
  print: jest.fn(),
  close: jest.fn(),
}));

// Mock FileList for file input elements
class MockFileList {
  constructor(files = []) {
    this._files = Array.isArray(files) ? files : [];
    // Make it array-like
    this.length = this._files.length;
    for (let i = 0; i < this._files.length; i++) {
      this[i] = this._files[i];
    }
  }
  
  item(index) {
    return this._files[index] || null;
  }
  
  [Symbol.iterator]() {
    return this._files[Symbol.iterator]();
  }
}

// Mock document.createElement for file downloads/uploads
// Store the REAL original before any mocks
const REAL_CREATE_ELEMENT = HTMLDocument.prototype.createElement || Document.prototype.createElement;
let createElementCallDepth = 0;
const MAX_DEPTH = 10;

// Create a wrapper that prevents infinite recursion
const createElementWrapper = function(tagName) {
  createElementCallDepth++;
  if (createElementCallDepth > MAX_DEPTH) {
    createElementCallDepth--;
    throw new Error('Maximum createElement call depth exceeded - possible infinite recursion');
  }
  
  let element;
  try {
    // Always use the REAL original, not any mocked version
    if (typeof REAL_CREATE_ELEMENT === 'function') {
      element = REAL_CREATE_ELEMENT.call(this, tagName);
    } else {
      // Fallback: create a basic element structure
      element = {
        tagName: tagName.toUpperCase(),
        click: jest.fn(),
        remove: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        style: {},
        className: '',
        innerHTML: '',
        textContent: '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
    }
    
    // Add mock methods for specific elements used in tests
    if (tagName === 'a') {
      const originalClick = element.click;
      const originalRemove = element.remove;
      element.click = jest.fn(originalClick || (() => {}));
      element.remove = jest.fn(originalRemove || (() => {}));
      if (!element.href) element.href = '';
      if (!element.download) element.download = '';
    }
    if (tagName === 'input') {
      const originalClick = element.click;
      element.click = jest.fn(originalClick || (() => {}));
      if (!element.type) element.type = 'file';
      // Use Object.defineProperty to set files as a non-writable property
      // This prevents jsdom from trying to convert it
      if (!element.files) {
        try {
          Object.defineProperty(element, 'files', {
            value: new MockFileList(),
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch (e) {
          // If defineProperty fails, try direct assignment but wrap in try-catch
          // to handle jsdom's FileList validation
          try {
            element.files = new MockFileList();
          } catch (err) {
            // Silently fail if jsdom rejects it - tests should handle this
          }
        }
      }
    }
  } finally {
    createElementCallDepth--;
  }
  
  return element;
};

// Replace document.createElement with our wrapper
document.createElement = createElementWrapper;

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

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Suppress console.error and console.warn during tests (but allow in test files if needed)
beforeEach(() => {
  localStorageMock.clear();
  
  // Suppress console.error and console.warn to reduce noise in test output
  // These are often expected when testing error scenarios
  console.error = jest.fn();
  console.warn = jest.fn();
  // Keep console.log for debugging if needed, but can be suppressed too
  // console.log = jest.fn();
});

// Cleanup after each test to prevent leaks
afterEach(() => {
  // Restore original console methods
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
  
  // Clean up DOM
  document.body.innerHTML = '';
  
  // Reset createElement call depth
  createElementCallDepth = 0;
  
  // Clear all timers to prevent hanging tests and resource leaks
  // This helps reduce the need for forceExit in jest.config.cjs
  jest.clearAllTimers();
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

