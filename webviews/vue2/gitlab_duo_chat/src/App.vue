<script>
import { DuoChat, DuoChatContextItemMenu } from '@gitlab/duo-ui';
import { MESSAGES_WITHOUT_RESPONSES } from './constants';
import renderGFM from './render_gfm';
import './render_markdown';

const vscode = acquireVsCodeApi();
const i18n = {
  predefinedPrompts: [
    'How do I change my password in GitLab?',
    'How do I fork a project?',
    'How do I clone a repository?',
    'How do I create a template?',
  ],
  chatPromptPlaceholder: 'Type "/" for slash commands',
};

export default {
  name: 'GitLabDuoChat',
  i18n,
  components: {
    DuoChat,
    DuoChatContextItemMenu,
  },
  props: {
    slashCommands: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  data() {
    return {
      chatMessages: [],
      promptDraft: null,
      canceledPromptRequestIds: [],
      isLoading: false,
      contextMenuCategories: null,
      contextMenuIsLoading: false,
      contextMenuError: null,
      contextSelections: [],
      contextSearchResults: [],
    };
  },
  created() {
    console.log('Duo Chat Vue app component has been created');
    window.vsCodeApi = vscode;
    window.addEventListener('message', this.handleExtensionMessageEvent);
    console.log('Duo Chat Vue app component is reporting as ready');
    window.vsCodeApi.postMessage({ command: 'appReady' });
    console.log('Duo Chat Vue app component reported as ready');
  },
  onBeforeDestroy() {
    window.removeEventListener('message', this.handleExtensionMessageEvent);
  },
  computed: {
    messages() {
      return this.chatMessages.filter(message => message.state !== 'pending');
    },
    pinnedContextEnabled() {
      return Boolean(this.contextMenuCategories?.length);
    },
  },
  mounted() {
    this.attachToVsCodeState();

    // When using the built in VSCode commands to interact with the Duo Chat panel, such as
    // "View: Toggle GitLab Duo Chat", and "View: Focus into Secondary Sidebar" (or whichever sidebar is configured to contain Duo chat)
    // our custom "focusChat" event is not fired. So we also need to manually listen to the panel window itself gaining focus.
    window.addEventListener('focus', this.focusChat);
    this.$refs.duoChat?.$refs?.prompt?.$el?.addEventListener('focus', this.checkPromptFocus);
    this.$refs.duoChat?.$refs?.prompt?.$el?.addEventListener('blur', this.checkPromptFocus);
  },
  beforeDestroy() {
    window.removeEventListener('focus', this.focusChat);
    this.$refs.duoChat?.$refs?.prompt?.$el?.removeEventListener('focus', this.checkPromptFocus);
    this.$refs.duoChat?.$refs?.prompt?.$el?.removeEventListener('blur', this.checkPromptFocus);
  },
  watch: {
    promptDraft(newVal) {
      window.vsCodeApi.setState({
        promptDraft: newVal,
      });
    },
    chatMessages() {
      this.updateIsLoading();
    },
  },
  provide: {
    renderGFM, // Provide the renderGFM function to the DuoChat component
  },
  methods: {
    handleExtensionMessageEvent(event) {
      const message = event.data;

      switch (message.eventType) {
        case 'clearChat': {
          this.isLoading = false;
          this.chatMessages = [];
          break;
        }
        case 'newRecord': {
          this.newRecord(message.record);
          break;
        }
        case 'updateRecord': {
          this.updateRecord(message.record);
          break;
        }
        case 'cancelPrompt': {
          this.canceledPromptRequestIds = message.canceledPromptRequestIds;
          break;
        }
        case 'focusChat': {
          this.focusChat();
          break;
        }
        case 'contextCategoriesResult': {
          const categoryDisplayData = [
            { label: 'Files', value: 'file', icon: 'document' },
            { label: 'Local Git', value: 'local_git', icon: 'git' },
            { label: 'Issues', value: 'issue', icon: 'issues' },
            { label: 'Merge Requests', value: 'merge_request', icon: 'merge-request' },
            { label: 'Dependencies', value: 'dependency', icon: 'package' },
          ];
          this.contextMenuCategories = categoryDisplayData.filter(category =>
            message.categories.includes(category.value),
          );
          break;
        }
        case 'contextCurrentItemsResult': {
          this.contextSelections = message.items;
          break;
        }
        case 'contextItemSearchResult': {
          this.contextSearchResults = message.results;
          this.contextMenuError = message.errorMessage || null;
          this.contextMenuIsLoading = false;
          break;
        }
        default:
          console.warn('Chat view received unexpected message type.');
          break;
      }
    },
    newRecord(record) {
      this.chatMessages.push(record);
    },
    updateRecord(record) {
      const index = this.chatMessages.findIndex(r => r.id === record.id);
      this.chatMessages.splice(index, 1, record);
    },
    focusChat() {
      this.$refs.duoChat?.$refs?.prompt?.$el?.focus();
    },
    attachToVsCodeState() {
      const currentState = window.vsCodeApi.getState();
      if (currentState && currentState.promptDraft) {
        this.promptDraft = currentState.promptDraft;
      }
    },
    onSendChatPrompt(question) {
      this.isLoading = !this.isResetMessage(question);

      window.vsCodeApi.postMessage({
        eventType: 'newPrompt',
        record: {
          content: question,
        },
      });
    },
    handleKeyPress(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.onSendChatPrompt();
      }
    },
    onChatCancel() {
      const assistantMessage = this.chatMessages[this.chatMessages.length - 1];

      window.vsCodeApi.postMessage({
        eventType: 'cancelPrompt',
        canceledPromptRequestId: assistantMessage.requestId,
      });

      this.isLoading = false;
    },
    updateIsLoading() {
      const lastMessage = this.chatMessages[this.chatMessages.length - 1];
      const isNotCanceled = !this.canceledPromptRequestIds.includes(lastMessage?.requestId);
      this.isLoading =
        lastMessage &&
        (lastMessage.role === 'user' || (lastMessage.state === 'pending' && isNotCanceled)) &&
        !this.isResetMessage(lastMessage.content);
    },
    onTrackFeedback({ feedbackChoices, didWhat, improveWhat } = {}) {
      window.vsCodeApi.postMessage({
        eventType: 'trackFeedback',
        data: {
          feedbackChoices,
          improveWhat,
          didWhat,
        },
      });
    },
    isResetMessage(prompt) {
      return prompt === MESSAGES_WITHOUT_RESPONSES.RESET;
    },
    onInsertCodeSnippet(event) {
      const snippet = event.detail.code;
      window.vsCodeApi.postMessage({
        eventType: 'insertCodeSnippet',
        data: {
          snippet,
        },
      });
    },
    onContextMenuSearch({ category, query }) {
      this.contextMenuIsLoading = true;
      this.contextMenuError = null;

      window.vsCodeApi.postMessage({
        eventType: 'contextItemSearchQuery',
        query: {
          query,
          category,
        },
      });
    },
    onSelectContextItem(item) {
      this.contextSearchResults = this.contextSearchResults.filter(result => result.id !== item.id);
      window.vsCodeApi.postMessage({
        eventType: 'contextItemAdded',
        item,
      });
    },
    onRemoveContextItem(item) {
      window.vsCodeApi.postMessage({
        eventType: 'contextItemRemoved',
        item,
      });
    },
    onGetContextItemContent({ contextItem, messageId }) {
      window.vsCodeApi.postMessage({
        eventType: 'contextItemGetContent',
        item: contextItem,
        messageId,
      });
    },
    checkPromptFocus() {
      const isFocused = this.$refs.duoChat?.$refs?.prompt?.$el === document.activeElement;
      window.vsCodeApi.postMessage({
        eventType: 'isChatFocused',
        isChatFocused: isFocused,
      });
    },
  },
};
</script>
<template>
  <duo-chat
    ref="duoChat"
    :messages="messages"
    error=""
    :is-loading="isLoading"
    :predefined-prompts="$options.i18n.predefinedPrompts"
    :slash-commands="slashCommands"
    :badge-title="null"
    :enable-code-insertion="true"
    :canceled-request-ids="canceledPromptRequestIds"
    :chat-prompt-placeholder="$options.i18n.chatPromptPlaceholder"
    :should-render-resizable="false"
    @chat-cancel="onChatCancel"
    @send-chat-prompt="onSendChatPrompt"
    @track-feedback="onTrackFeedback"
    @insert-code-snippet="onInsertCodeSnippet"
    @get-context-item-content="onGetContextItemContent"
  >
    <template
      v-if="pinnedContextEnabled"
      #context-items-menu="{ isOpen, onClose, setRef, focusPrompt }"
    >
      <duo-chat-context-item-menu
        :ref="setRef"
        :open="isOpen"
        :selections="contextSelections"
        :categories="contextMenuCategories"
        :loading="contextMenuIsLoading"
        :error="contextMenuError"
        :results="contextSearchResults"
        @search="onContextMenuSearch"
        @select="onSelectContextItem"
        @remove="onRemoveContextItem"
        @close="onClose"
        @focus-prompt="focusPrompt"
        @get-context-item-content="onGetContextItemContent"
      />
    </template>
  </duo-chat>
</template>
<style lang="scss">
@import 'styles.scss';
</style>
