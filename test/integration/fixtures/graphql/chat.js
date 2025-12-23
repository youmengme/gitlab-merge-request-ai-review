const newPromptResponse = {
  aiAction: {
    requestId: '7ab3912a-a77e-448d-80cf-5b3f0ea6295d',
    errors: [],
  },
};

const duoChatAvailableResponse = {
  currentUser: {
    duoChatAvailable: true,
  },
};

const noMessageResponse = {
  aiMessages: {
    nodes: [],
  },
};

const newMessageResponse = (variables, extras = {}) => {
  const overrides = {
    role: variables.roles[0],
    requestId: variables.requestId,
    ...extras,
  };

  return {
    aiMessages: {
      nodes: [
        {
          id: 'gid://gitlab/Gitlab::Llm::ChatMessage/e48b1082-5a89-40bf-af33-d62b5941574f',
          content: `${overrides.role} message`,
          errors: [],
          ...overrides,
        },
      ],
    },
  };
};

module.exports = {
  newPromptResponse,
  newMessageResponse,
  noMessageResponse,
  duoChatAvailableResponse,
};
