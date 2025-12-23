import { WebviewContainerMiddleware } from '../middleware';
import { WebviewThemePublisher } from './types';

export const createInitialStateMiddleware =
  (
    themePublisher: WebviewThemePublisher,
    initialState?: Record<string, unknown>,
  ): WebviewContainerMiddleware =>
  async () => {
    if (initialState) {
      await themePublisher.setDuoWorkflowInitialState(initialState);
    }
  };
