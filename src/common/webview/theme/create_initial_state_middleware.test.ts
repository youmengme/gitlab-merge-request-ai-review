import { WebviewContainer } from '../middleware';
import { createInitialStateMiddleware } from './create_initial_state_middleware';
import { WebviewThemePublisher } from './types';

describe('createInitialStateMiddleware', () => {
  let mockThemePublisher: WebviewThemePublisher;
  let mockContainer: WebviewContainer;
  let middleware: ReturnType<typeof createInitialStateMiddleware>;

  beforeEach(() => {
    mockThemePublisher = {
      publishWebviewTheme: jest.fn().mockResolvedValue(undefined),
      setDuoWorkflowInitialState: jest.fn().mockResolvedValue(undefined),
    };

    mockContainer = {} as WebviewContainer;
  });

  it('should call setInitialState when initialState is provided', () => {
    const initialState = { foo: 'bar' };
    middleware = createInitialStateMiddleware(mockThemePublisher, initialState);

    middleware(mockContainer);

    expect(mockThemePublisher.setDuoWorkflowInitialState).toHaveBeenCalledWith(initialState);
  });

  it('should not call setInitialState when initialState is not provided', () => {
    middleware = createInitialStateMiddleware(mockThemePublisher);

    middleware(mockContainer);

    expect(mockThemePublisher.setDuoWorkflowInitialState).not.toHaveBeenCalled();
  });

  it('should return a function', () => {
    middleware = createInitialStateMiddleware(mockThemePublisher);

    expect(typeof middleware).toBe('function');
  });

  it('should handle empty object as initialState', () => {
    const initialState = {};
    middleware = createInitialStateMiddleware(mockThemePublisher, initialState);

    middleware(mockContainer);

    expect(mockThemePublisher.setDuoWorkflowInitialState).toHaveBeenCalledWith(initialState);
  });
});
