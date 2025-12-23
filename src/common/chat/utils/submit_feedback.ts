import { Snowplow } from '../../snowplow/snowplow';
import {
  EXTENSION_EVENT_SOURCE,
  GITLAB_STANDARD_SCHEMA_URL,
} from '../../snowplow/snowplow_options';
import { GitLabEnvironment } from '../../snowplow/get_environment';

function buildStandardContext(
  improveWhat: string | null,
  didWhat: string | null,
  gitlabEnvironment: GitLabEnvironment,
) {
  return {
    schema: GITLAB_STANDARD_SCHEMA_URL,
    data: {
      source: EXTENSION_EVENT_SOURCE,
      extra: {
        improveWhat,
        didWhat,
      },
      environment: gitlabEnvironment,
    },
  };
}

export type SubmitFeedbackParams = {
  improveWhat: string | null;
  didWhat: string | null;
  feedbackChoices: string[] | null;
  gitlabEnvironment: GitLabEnvironment;
};

export const submitFeedback = async ({
  didWhat,
  improveWhat,
  feedbackChoices,
  gitlabEnvironment,
}: SubmitFeedbackParams) => {
  const hasFeedback = Boolean(didWhat) || Boolean(improveWhat) || Boolean(feedbackChoices?.length);

  if (!hasFeedback) {
    return;
  }

  const standardContext = buildStandardContext(improveWhat, didWhat, gitlabEnvironment);

  await Snowplow.getInstance().trackStructEvent(
    {
      category: 'ask_gitlab_chat',
      action: 'click_button',
      label: 'response_feedback',
      property: feedbackChoices?.join(','),
    },
    [standardContext, 'ide-extension-context'],
  );
};
