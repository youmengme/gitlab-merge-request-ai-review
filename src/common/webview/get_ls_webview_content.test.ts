import * as vscode from 'vscode';
import { getEnvInfo } from '../env';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getWebviewContent } from './get_ls_webview_content';
import osxKeyboardEventScript from './templates/osx_keyboard_event_fix.template.html';

jest.mock('../env');

describe('getWebviewContent', () => {
  beforeEach(() => {
    jest.mocked(vscode.env.asExternalUri).mockReset();
    jest.mocked(getEnvInfo).mockReset().mockReturnValueOnce({ isMacOS: false, isRemote: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate webview content with escaped HTML', async () => {
    const inputUrl = new URL('https://example.com/path?param=value');
    const title = 'Test Title';

    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
      createFakePartial<vscode.Uri>({
        toString: () => 'https://example.com/path?param=value',
      }),
    );

    const result = await getWebviewContent(inputUrl, title);

    expect(jest.mocked(vscode.env.asExternalUri)).toHaveBeenCalledWith(expect.any(Object));
    expect(result).toContain('https://example.com/path?param=value');
    expect(result).toContain('Test Title');
    expect(result).toContain('https://example.com');
  });

  it('should escape special characters in title', async () => {
    const inputUrl = new URL('https://example.com');
    const title = '<script>alert("xss")</script>';

    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
      createFakePartial<vscode.Uri>({
        toString: () => 'https://example.com',
      }),
    );

    const result = await getWebviewContent(inputUrl, title);

    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('alert(&quot;xss&quot;)');
  });

  it('should escape special characters in origin', async () => {
    const inputUrl = new URL('https://example.com/<path>');
    const title = 'Safe Title';

    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
      createFakePartial<vscode.Uri>({
        toString: () => 'https://example.com/<path>',
      }),
    );

    const result = await getWebviewContent(inputUrl, title);

    // The origin should be escaped in the CSP header
    expect(result).toContain('https:&#x2F;&#x2F;example.com');
    expect(result).not.toContain("frame-src 'self' https://example.com");
  });

  describe.each`
    isMacOS  | isRemote
    ${true}  | ${false}
    ${false} | ${true}
  `('when isMacOS = $isMacOS and isRemote = $isRemote', ({ isMacOS, isRemote }) => {
    beforeEach(() => {
      jest.mocked(getEnvInfo).mockReset().mockReturnValueOnce({ isMacOS, isRemote });
    });

    it('should include OSX keyboard event fix', async () => {
      const inputUrl = new URL('https://example.com');
      const title = 'Test';

      jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
        createFakePartial<vscode.Uri>({
          toString: () => 'https://example.com',
        }),
      );

      const result = await getWebviewContent(inputUrl, title);

      expect(result).toContain(osxKeyboardEventScript);
    });
  });

  it('should not include OSX keyboard event fix by default', async () => {
    const inputUrl = new URL('https://example.com');
    const title = 'Test';

    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
      createFakePartial<vscode.Uri>({
        toString: () => 'https://example.com',
      }),
    );

    const result = await getWebviewContent(inputUrl, title);

    expect(result).not.toContain(osxKeyboardEventScript);
  });

  it('should handle URLs with query parameters correctly', async () => {
    const inputUrl = new URL('https://example.com/path?foo=bar&baz=qux');
    const title = 'Test';

    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(
      createFakePartial<vscode.Uri>({
        toString: (skipEncoding: boolean) => {
          if (skipEncoding) {
            return 'https://example.com/path?foo=bar&baz=qux';
          }
          return 'https://example.com/path?foo=bar&baz=qux';
        },
      }),
    );

    const result = await getWebviewContent(inputUrl, title);

    expect(result).toContain('foo=bar');
    expect(result).toContain('baz=qux');
  });
});
