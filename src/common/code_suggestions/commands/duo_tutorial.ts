import * as vscode from 'vscode';

/** If you need to do more complex changes, edit the content in a separate JS file and then paste it back here */
const tutorial = `/*
  GitLab Duo Tutorial
  ===================
  This tutorial will walk you through several GitLab Duo features.

  It assumes the default keybindings.
  */

/*
  1) Code Completion
  ------------------
  1. In the following snippet, put your cursor after 'const multiply'.
     Press <Space>.
  2. Code Completion is shown.
  3. To accept a single word from the suggestion, press:
     - Windows, Linux: <Control> + right arrow key.
     - MacOS: <Command> + right arrow key.
  4. To accept the full suggestion, press <Tab>.
  */

const multiply =

/*
  2) Code Generation
  ------------------
  1. In the following snippet, put your cursor at the end of the line with the
     "// Write a simple express router" instruction.
  2. Press <Enter>. Pressing <Enter> after a comment instructs GitLab Duo
     to generate a longer code block.
  3. Wait for the code generation to finish. While Duo processes a response, a
     loading icon is shown in the gutter.
  4. Accept partial or full suggestions, as you did with Code Completion:
     1. To accept a single word from the suggestion, press <Command> (Windows, Linux)
        or <Control> (MacOS), plus the right arrow key.
     2. To accept the full suggestion, press <Tab>.
  5. Code generation also triggers in empty blocks. Try it by placing your
     cursor in the empty "computeRectangleArea" function block, then pressing
     <Space>.
  */

// Write a simple express router with three routes: 'home', 'about', and 'contact'

const computeRectangleArea = () => {};

/*
  3) Duo Chat
  -----------
  1. Select the following function to include it as context for your question.
  2. To open Duo Chat, press:
     - Windows, Linux: <Alt> + D
     - MacOS: <Option> + D
  3. Ask Duo "How can I improve this function?"
  4. Like the suggestion from Duo Chat? On the top right corner of the chat
     code snippet, apply the suggestion by pressing <Insert>.
  */

function calculateFactorial(n) {
  let result = 1;
  for (let i = 1; i <= n; i++) {
    result = result * i;
  }
  return result;
}

/*
  4) Duo Quick Chat
  -----------------
  1. Select the following code block to include it as context for your
     query.
  2. To open Quick Chat, press:
     - Windows, Linux: <Alt> + C
     - MacOS: <Option> + C
  3. In the text area, enter the question "is this the best way to write
     a Fibonacci function?"
  */

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

/*
  5) Explain Code
  -----------------------
  1. Select the following complex code to include it as context for your query.
  2. Right-click to open the context menu.
  3. Select GitLab Duo Chat > Explain Selected Snippet.
  */

function memoizedDebounce(func, wait) {
  const cache = new Map();
  let timeoutId;

  return function (...args) {
    const key = JSON.stringify(args);
    clearTimeout(timeoutId);

    if (cache.has(key)) {
      return cache.get(key);
    }

    timeoutId = setTimeout(() => {
      const result = func.apply(this, args);
      cache.set(key, result);
    }, wait);
  };
}

/*
  6) Generate Tests
  -----------------
  1. Select the following function to include it as context for your query.
  2. To generate tests for this function, press:
     - Windows, Linux: <Alt> + T
     - MacOS: <Option> + T
  3. Review the generated tests.
  */

function validateEmail(email) {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}

/*
  7) Refactor Code
  ----------------
  1. Select the following function to include it as context for your query.
  2. To get refactoring suggestions, press:
     - Windows, Linux: <Alt> + R
     - MacOS: <Option> + R
  3. Like the suggestion from Duo Chat? On the top right corner of the chat
     code snippet, apply the suggestion by pressing <Insert>.
  */

function processUserData(data) {
  if (data.name) {
    if (data.age) {
      if (data.email) {
        return {
          name: data.name.trim(),
          age: parseInt(data.age),
          email: data.email.toLowerCase(),
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
}
`;

export const duoTutorial = async () => {
  // Create a new untitled document
  const doc = await vscode.workspace.openTextDocument({
    content: tutorial,
    language: 'javascript',
  });
  await vscode.window.showTextDocument(doc);
};
