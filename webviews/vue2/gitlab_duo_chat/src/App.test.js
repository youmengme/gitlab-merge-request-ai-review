import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { DuoChat, DuoChatContextItemMenu } from '@gitlab/duo-ui';
import App from './App.vue';

describe('Duo Chat Vue app', () => {
  let wrapper;
  let vsCodeApi;
  let mockFocusChatInput;

  const findDuoChat = () => wrapper.findComponent(DuoChat);
  const findContextMenu = () => wrapper.findComponent(DuoChatContextItemMenu);

  const createComponent = () => {
    wrapper = shallowMount(App);

    wrapper.vm.$refs.duoChat.$refs.prompt = {
      $el: {
        focus: mockFocusChatInput,
      },
    };
  };

  beforeEach(() => {
    vsCodeApi = acquireVsCodeApi();
    mockFocusChatInput = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('application bootstrapping', () => {
    it('posts the `appReady` message when created', () => {
      expect(vsCodeApi.postMessage).not.toHaveBeenCalled();
      createComponent();
      expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
        command: 'appReady',
      });
    });
  });

  describe('GlDuoChat integration', () => {
    it('renders the Duo Chat component', () => {
      createComponent();
      expect(findDuoChat().exists()).toBe(true);
    });

    it('correctly sets the props on Duo Chat', async () => {
      const chatMessages = [
        {
          content: 'Foo',
          role: 'user',
        },
        {
          content: 'Bar',
          role: 'assistant',
        },
      ];

      createComponent();
      expect(findDuoChat().props('messages')).toEqual([]);

      chatMessages.forEach(record => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              eventType: 'newRecord',
              record,
            },
          }),
        );
      });
      await nextTick();

      expect(findDuoChat().props('messages')).toEqual(chatMessages);
    });

    it('sends regular prompt with the `newPrompt` event type', async () => {
      const question = 'What is GitLab?';
      createComponent();

      findDuoChat().vm.$emit('send-chat-prompt', question);
      await nextTick();

      expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
        eventType: 'newPrompt',
        record: {
          content: question,
        },
      });
    });

    it('correctly sends insert code snippet event', () => {
      createComponent();
      const duoChat = findDuoChat();

      const codeSnippet = 'const foo = 42';
      duoChat.vm.$emit(
        'insert-code-snippet',
        new CustomEvent('insert-code-snippet', {
          detail: {
            code: codeSnippet,
          },
        }),
      );

      expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
        eventType: 'insertCodeSnippet',
        data: {
          snippet: codeSnippet,
        },
      });
    });

    it('focuses on the prompt with the `focusChat` event type', async () => {
      createComponent();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            eventType: 'focusChat',
          },
        }),
      );
      await nextTick();

      expect(mockFocusChatInput).toHaveBeenCalledTimes(1);
    });

    it('focuses on the prompt when the window itself gains focus', async () => {
      createComponent();

      window.dispatchEvent(new Event('focus'));

      await nextTick();

      expect(mockFocusChatInput).toHaveBeenCalledTimes(1);
    });

    describe('context items menu', () => {
      describe('when there are no categories', () => {
        it('does not render context menu when no categories have been set', () => {
          createComponent();
          expect(findContextMenu().exists()).toBe(false);
        });
      });

      describe('when there are categories', () => {
        beforeEach(() => {
          createComponent();

          window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                eventType: 'contextCategoriesResult',
                categories: ['file', 'issue', 'merge_request'],
              },
            }),
          );
        });

        it('renders context menu', () => {
          expect(findContextMenu().exists()).toBe(true);
        });

        it('maps display properties for categories', () => {
          expect(findContextMenu().props('categories')).toEqual([
            { label: 'Files', value: 'file', icon: 'document' },
            { label: 'Issues', value: 'issue', icon: 'issues' },
            { label: 'Merge Requests', value: 'merge_request', icon: 'merge-request' },
          ]);
        });

        describe('when there are context item selections', () => {
          const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
          beforeEach(() => {
            window.dispatchEvent(
              new MessageEvent('message', {
                data: {
                  eventType: 'contextCurrentItemsResult',
                  items,
                },
              }),
            );
          });

          it('shows selections', () => {
            expect(findContextMenu().props('selections')).toBe(items);
          });
        });

        describe('when searching', () => {
          const query = { category: 'file', query: 'wowsa!' };

          beforeEach(() => {
            const menu = findContextMenu();
            menu.vm.$emit('search', query);
          });

          it('sets menu loading state', () => {
            expect(findContextMenu().props('loading')).toBe(true);
          });

          it('correctly sends "onContextMenuSearch" event', () => {
            expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
              eventType: 'contextItemSearchQuery',
              query,
            });
          });

          describe('when there are results', () => {
            const results = [{ id: '1' }, { id: '2' }, { id: '3' }];
            beforeEach(() => {
              window.dispatchEvent(
                new MessageEvent('message', {
                  data: {
                    eventType: 'contextItemSearchResult',
                    results,
                  },
                }),
              );
            });

            it('sets menu loading state', () => {
              expect(findContextMenu().props('loading')).toBe(false);
            });

            it('shows results in menu', () => {
              expect(findContextMenu().props('results')).toBe(results);
            });
          });

          describe('when there is an error', () => {
            const errorMessage = 'oh no :(';
            beforeEach(() => {
              window.dispatchEvent(
                new MessageEvent('message', {
                  data: {
                    eventType: 'contextItemSearchResult',
                    results: [],
                    errorMessage,
                  },
                }),
              );
            });

            it('sets menu loading state', () => {
              expect(findContextMenu().props('loading')).toBe(false);
            });

            it('shows error in menu', () => {
              expect(findContextMenu().props('error')).toBe(errorMessage);
            });
          });
        });

        describe('when selecting a context item', () => {
          const item = { id: '1' };

          beforeEach(() => {
            const menu = findContextMenu();
            menu.vm.$emit('select', item);
          });

          it('correctly sends "contextItemAdded" event', () => {
            expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
              eventType: 'contextItemAdded',
              item,
            });
          });
        });

        describe('when removing a context item', () => {
          const item = { id: '1' };

          beforeEach(() => {
            const menu = findContextMenu();
            menu.vm.$emit('remove', item);
          });

          it('correctly sends "contextItemRemoved" event', () => {
            expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
              eventType: 'contextItemRemoved',
              item,
            });
          });
        });
      });
    });
  });
});
