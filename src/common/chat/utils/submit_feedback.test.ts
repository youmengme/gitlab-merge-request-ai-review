import { EXTENSION_EVENT_SOURCE } from '../../snowplow/snowplow_options';
import { GitLabEnvironment } from '../../snowplow/get_environment';
import { SubmitFeedbackParams, submitFeedback } from './submit_feedback';

jest.mock('../../snowplow/snowplow', () => ({
  Snowplow: {
    getInstance: jest.fn().mockReturnValue({
      trackStructEvent: jest.fn(),
      ideExtensionContext: {
        schema: 'test',
        data: {
          ide_name: 'Visual Studio Code',
          ide_vendor: 'Microsoft Corporation',
          ide_version: '1.0.0',
          extension_name: 'GitLab Workflow',
          extension_version: '1.0.0',
        },
      },
    }),
  },
}));

const { trackStructEvent } = jest.requireMock('../../snowplow/snowplow').Snowplow.getInstance();

describe('submitFeedback', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('with feedback', () => {
    it('sends snowplow event', async () => {
      const expected: SubmitFeedbackParams = {
        didWhat: 'didWhat',
        improveWhat: 'improveWhat',
        feedbackChoices: ['helpful', 'fast'],
        gitlabEnvironment: GitLabEnvironment.GITLAB_COM,
      };

      await submitFeedback(expected);

      const standardContext = {
        schema: 'iglu:com.gitlab/gitlab_standard/jsonschema/1-0-9',
        data: {
          source: EXTENSION_EVENT_SOURCE,
          extra: {
            didWhat: expected.didWhat,
            improveWhat: expected.improveWhat,
          },
          environment: expected.gitlabEnvironment,
        },
      };

      expect(trackStructEvent).toHaveBeenCalledWith(
        {
          category: 'ask_gitlab_chat',
          action: 'click_button',
          label: 'response_feedback',
          property: 'helpful,fast',
        },
        [standardContext, 'ide-extension-context'],
      );
    });

    it('sends snowplow event when choices are null', async () => {
      const expected: SubmitFeedbackParams = {
        didWhat: 'didWhat',
        improveWhat: 'improveWhat',
        feedbackChoices: null,
        gitlabEnvironment: GitLabEnvironment.GITLAB_COM,
      };

      await submitFeedback(expected);

      const standardContext = {
        schema: 'iglu:com.gitlab/gitlab_standard/jsonschema/1-0-9',
        data: {
          source: EXTENSION_EVENT_SOURCE,
          extra: {
            didWhat: expected.didWhat,
            improveWhat: expected.improveWhat,
          },
          environment: expected.gitlabEnvironment,
        },
      };

      expect(trackStructEvent).toHaveBeenCalledWith(
        {
          category: 'ask_gitlab_chat',
          action: 'click_button',
          label: 'response_feedback',
        },
        [standardContext, 'ide-extension-context'],
      );
    });

    it('sends snowplow event when free text feedback is null', async () => {
      const expected: SubmitFeedbackParams = {
        didWhat: null,
        improveWhat: null,
        feedbackChoices: ['helpful', 'fast'],
        gitlabEnvironment: GitLabEnvironment.GITLAB_COM,
      };

      await submitFeedback(expected);

      const standardContext = {
        schema: 'iglu:com.gitlab/gitlab_standard/jsonschema/1-0-9',
        data: {
          source: EXTENSION_EVENT_SOURCE,
          extra: {
            didWhat: expected.didWhat,
            improveWhat: expected.improveWhat,
          },
          environment: expected.gitlabEnvironment,
        },
      };

      expect(trackStructEvent).toHaveBeenCalledWith(
        {
          category: 'ask_gitlab_chat',
          action: 'click_button',
          label: 'response_feedback',
          property: 'helpful,fast',
        },
        [standardContext, 'ide-extension-context'],
      );
    });
  });

  describe('with empty feedback', () => {
    const emptySubmitFeedbackParams: SubmitFeedbackParams = {
      didWhat: '',
      improveWhat: '',
      feedbackChoices: [],
      gitlabEnvironment: GitLabEnvironment.GITLAB_COM,
    };

    it('does not send a snowplow event', async () => {
      await submitFeedback(emptySubmitFeedbackParams);

      expect(trackStructEvent).not.toHaveBeenCalled();
    });

    it('does not send a snowplow event when free text feedback and choices are null', async () => {
      await submitFeedback(emptySubmitFeedbackParams);

      expect(trackStructEvent).not.toHaveBeenCalled();
    });
  });
});
