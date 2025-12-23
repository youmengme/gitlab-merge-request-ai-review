export type WebviewInfo = {
  id: string;
  title: string;
  uris: string[];
};

export interface WebviewInfoProvider {
  getWebviewInfos(): Promise<WebviewInfo[]>;
}
