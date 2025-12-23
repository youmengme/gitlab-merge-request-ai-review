export const COMMAND_OPEN_QUICK_CHAT = 'gl.openQuickChat';
export const COMMAND_OPEN_QUICK_CHAT_WITH_SHORTCUT = 'gl.openQuickChatWithShortcut';
// we cannot update the command action label dynamically,
// instead we can register two identical commands that will execute
// based on the platform variable.
// That's why we have 2 commands to send quick chat
export const COMMAND_SEND_QUICK_CHAT = 'gl.sendQuickChat';
export const COMMAND_SEND_QUICK_CHAT_DUPLICATE = 'gl.sendQuickChatDup';
export const COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT = 'gl.copyCodeSnippetFromQuickChat';
export const COMMAND_QUICK_CHAT_OPEN_TELEMETRY = 'gl.quickChatOpenTelemetry';
export const COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY = 'gl.quickChatMessageSentTelemetry';
export const COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT = 'gl.insertCodeSnippetFromQuickChat';
export const COMMAND_CLOSE_QUICK_CHAT = 'gl.closeQuickChat';
export const COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT =
  'gl.showAndSendDuoQuickChatWithContext';

// TODO: when LS is enabled in IDE, we can replace this with LS import
export enum QUICK_CHAT_OPEN_TRIGGER {
  SHORTCUT = 'shortcut',
  CLICK = 'btn_click',
  CODE_ACTION_FIX_WITH_DUO = 'code_action_fix_with_duo',
}
