import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { InsertCodeSnippetElement } from '@gitlab/duo-ui/dist/components/chat/components/duo_chat_message/insert_code_snippet_element';

hljs.configure({
  // we highlight only elements with `js-syntax-highlight` class and
  // this class marks code blocks that are already highlighted by the GitLab instance
  // If we ever remove the GitLab post-processing of the LLM response, we can remove this ignore
  ignoreUnescapedHTML: true,
});

function syntaxHighlight(els) {
  if (!els || els.length === 0) return;

  els.forEach(el => {
    if (el.classList && el.classList.contains('js-syntax-highlight') && !el.dataset.highlighted) {
      hljs.highlightElement(el);

      // This is how the dom elements are designed to be manipulated
      // eslint-disable-next-line no-param-reassign
      el.dataset.highlighted = 'true';
    }
  });
}

/*
   This function adds insert-code-snippet custom elements in case they are missing for code blocks.
   That allows to have the insert-code-sippet functionality even if the extension is used for the outdated GitLab instance.
 */
function addMissingCodeInsertCodeSnippetButtons(element) {
  const codeBlocks = Array.from(element.querySelectorAll('.markdown-code-block'));
  codeBlocks.forEach(block => {
    const existingElement = block?.querySelector('insert-code-snippet');
    if (!existingElement) {
      block?.appendChild(new InsertCodeSnippetElement(block));
    }
  });
}

// this is a partial implementation of `renderGFM` concerned only with syntax highlighting.
// for all possible renderers, check
// https://gitlab.com/gitlab-org/gitlab/-/blob/774ecc1f2b15a581e8eab6441de33585c9691c82/app/assets/javascripts/behaviors/markdown/render_gfm.js#L18-40

function renderGFM(element) {
  if (!element) {
    return;
  }

  addMissingCodeInsertCodeSnippetButtons(element);

  const highlightEls = Array.from(element.querySelectorAll('.js-syntax-highlight'));
  syntaxHighlight(highlightEls);
}

export default renderGFM;
