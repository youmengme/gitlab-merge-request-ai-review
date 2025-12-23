import { vi, expect, it, describe } from 'vitest';
import { mount } from '@vue/test-utils';
import Note from './Note.vue';

const {
  noteOnDiffWithSuggestion,
} = require('../../../../../test/integration/fixtures/graphql/discussions');

describe('Note', () => {
  let wrapper;
  const tooltipDirective = vi.fn();

  beforeEach(() => {
    tooltipDirective.mockReset();
    window.vsCodeApi = { postMessage: vi.fn() };
  });
  describe('initializes suggestions', () => {
    beforeEach(() => {
      wrapper = mount(Note, {
        propsData: {
          noteable: noteOnDiffWithSuggestion,
        },
        global: {
          stubs: {
            date: true,
          },
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });
    });

    it('contains two initialized suggestions', () => {
      expect(wrapper.findAll('.suggestion').length).toBe(2);
    });

    it('suggestion header', () => {
      const suggestionHeader = wrapper.find('.suggestion .header');
      expect(suggestionHeader.text()).toMatch(/Suggested change:\s+open on the web/);
    });

    it('opens suggestion on the web', () => {
      const openOnTheWebLink = wrapper.find('.suggestion .header a');
      expect(openOnTheWebLink.attributes('href')).toBe(noteOnDiffWithSuggestion.url);
    });

    it('wraps original suggestion', () => {
      const firstSuggestedLine = wrapper.find('.suggestion .line');
      expect(firstSuggestedLine.text()).toBe('function anotherFunction1(): void{');
    });
  });
});
