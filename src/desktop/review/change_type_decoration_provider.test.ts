import * as vscode from 'vscode';
import { ADDED, DELETED, RENAMED, MODIFIED, CHANGE_TYPE_QUERY_KEY } from '../constants';
import { reviewUriParams } from '../test_utils/entities';
import { changeTypeDecorationProvider, decorations } from './change_type_decoration_provider';
import { ChangeType, toReviewUri } from './review_uri';

describe('FileDecoratorProvider', () => {
  it.each`
    changeType  | decoration
    ${ADDED}    | ${decorations[ADDED]}
    ${DELETED}  | ${decorations[DELETED]}
    ${RENAMED}  | ${decorations[RENAMED]}
    ${MODIFIED} | ${decorations[MODIFIED]}
  `('Correctly maps changeType to decorator', ({ changeType, decoration }) => {
    const uri: vscode.Uri = vscode.Uri.file(`./test?${CHANGE_TYPE_QUERY_KEY}=${changeType}`);
    const { token } = new vscode.CancellationTokenSource();
    const returnValue = changeTypeDecorationProvider.provideFileDecoration(uri, token);

    expect(returnValue).toEqual(decoration);
  });

  describe('Merge requests', () => {
    it.each([ADDED, DELETED, MODIFIED, RENAMED] as ChangeType[])(
      'Correctly maps path to changeType %p',
      changeType => {
        const uri: vscode.Uri = toReviewUri({ ...reviewUriParams, changeType });
        const { token } = new vscode.CancellationTokenSource();
        const returnValue = changeTypeDecorationProvider.provideFileDecoration(uri, token);

        expect(returnValue).toEqual(decorations[changeType]);
      },
    );
  });
});
