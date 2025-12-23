// Global setup for Jest tests
global.acquireVsCodeApi = jest.fn().mockReturnValue({
  postMessage: jest.fn(),
  setState: jest.fn(),
  getState: jest.fn(),
});
