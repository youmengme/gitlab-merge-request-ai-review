import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { AnsiDecorationProvider } from './ansi_decoration_provider';
import { jobLogCache } from './job_log_cache';
import { JobLogFoldingProvider } from './job_log_folding_provider';

describe('JobLogFoldingProvider', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('returns folding ranges', async () => {
    jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
      createFakePartial<vscode.TextDocument>({
        uri: { query: JSON.stringify({ job: 123 }) },
      }),
    );

    const rawTrace = await fs.readFile(
      path.join(__dirname, '..', 'test_utils', 'raw_trace.log'),
      'utf-8',
    );

    jobLogCache.set(123, rawTrace);
    const ansiProvider = new AnsiDecorationProvider();
    const { sections, decorations, filtered } =
      await ansiProvider.provideDecorationsForPrettifiedAnsi(rawTrace, false);

    jobLogCache.addDecorations(123, sections, decorations, filtered);

    const foldingProvider = new JobLogFoldingProvider();
    const document = await vscode.workspace.openTextDocument();
    const ranges = await foldingProvider.provideFoldingRanges(document);

    expect(ranges).toContainEqual({ start: 2, end: 5, kind: vscode.FoldingRangeKind.Region });
  });
});
