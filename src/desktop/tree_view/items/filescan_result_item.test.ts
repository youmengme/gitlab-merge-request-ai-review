import * as vscode from 'vscode';

import { FileScanResultItem } from './filescan_result_item';

// each unit in ms
const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;

describe('FileScanResultItemParam', () => {
  let mockItem: FileScanResultItem;

  it('renders succesfully', () => {
    mockItem = new FileScanResultItem({
      filePath: 'src/app.ts',
      vulnerabilities: [],
      timestamp: Date.now(),
    });

    expect(mockItem.label).toBe('app.ts');
    expect(mockItem.description).toBe('Just now [src/app.ts]');
    expect(mockItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
  });

  it('renders truncated file path if too long', () => {
    mockItem = new FileScanResultItem({
      filePath: 'src/long/path/to/the/file/for/scan/file.ts',
      vulnerabilities: [],
      timestamp: Date.now(),
    });
    expect(mockItem.label).toBe('file.ts');
    expect(mockItem.description).toBe('Just now [...or/scan/file.ts]');
    expect(mockItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
  });

  describe('shows the correct relative timestamp format', () => {
    const currentDate = Date.now();

    const now = currentDate;
    const secondsAgo = currentDate - 30 * second;
    const minutesAgo = currentDate - minute;
    const hoursAgo = currentDate - hour;
    const daysAgo = currentDate - day;
    const weeksAgo = currentDate - week;

    it.each`
      date          | dateText        | expectedText
      ${now}        | ${'now'}        | ${'now'}
      ${secondsAgo} | ${'secondsAgo'} | ${'now'}
      ${minutesAgo} | ${'minutesAgo'} | ${'minute'}
      ${hoursAgo}   | ${'hoursAgo'}   | ${'hour'}
      ${daysAgo}    | ${'daysAgo'}    | ${'day'}
      ${weeksAgo}   | ${'weeksAgo'}   | ${'day'}
    `('for $dateText with $expectedText', ({ date, expectedText }) => {
      mockItem = new FileScanResultItem({
        filePath: 'test.ts',
        vulnerabilities: [],
        timestamp: date,
      });
      expect(mockItem.timestamp).toContain(expectedText);
    });
  });
});
