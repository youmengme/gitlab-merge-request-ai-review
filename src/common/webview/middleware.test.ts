import * as vscode from 'vscode';
import { WebviewContainer, WebviewContainerMiddleware, applyMiddleware } from './middleware';

describe('middleware', () => {
  describe('applyMiddleware', () => {
    let mockWebviewContainer: WebviewContainer;
    let mockMiddleware1: jest.Mock<WebviewContainerMiddleware>;
    let mockMiddleware2: jest.Mock<WebviewContainerMiddleware>;

    beforeEach(() => {
      mockWebviewContainer = {
        webview: {} as vscode.Webview,
        onDidDispose: {} as vscode.Event<void>,
      };

      mockMiddleware1 = jest.fn();
      mockMiddleware2 = jest.fn();
    });

    it('should apply a single middleware', () => {
      applyMiddleware(mockWebviewContainer, [mockMiddleware1]);

      expect(mockMiddleware1).toHaveBeenCalledTimes(1);
      expect(mockMiddleware1).toHaveBeenCalledWith(mockWebviewContainer);
    });

    it('should apply multiple middlewares', () => {
      applyMiddleware(mockWebviewContainer, [mockMiddleware1, mockMiddleware2]);

      expect(mockMiddleware1).toHaveBeenCalledTimes(1);
      expect(mockMiddleware1).toHaveBeenCalledWith(mockWebviewContainer);
      expect(mockMiddleware2).toHaveBeenCalledTimes(1);
      expect(mockMiddleware2).toHaveBeenCalledWith(mockWebviewContainer);
    });

    it('should not throw an error when no middlewares are provided', () => {
      expect(() => {
        applyMiddleware(mockWebviewContainer, []);
      }).not.toThrow();
    });
  });
});
