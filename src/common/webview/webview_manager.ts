import { WebviewThemePublisher } from './theme/types';
import { WebviewInfoProvider } from './webview_info_provider';

export interface WebviewManager extends WebviewInfoProvider, WebviewThemePublisher {}
