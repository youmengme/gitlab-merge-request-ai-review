import { JOB_LOG_URI_SCHEME } from '../constants';
import { fromJobLogUri, toJobLogUri } from './job_log_uri';

describe('JobLogParams', () => {
  it('has a uri scheme', () => {
    expect(toJobLogUri('', 123, 123).scheme).toBe(JOB_LOG_URI_SCHEME);
  });

  it('can serialize and deserialize', () => {
    const input = { repositoryRoot: 'path/to/repository', projectId: 1234, job: 5678 };
    const output = fromJobLogUri(toJobLogUri(input.repositoryRoot, input.projectId, input.job));
    expect(output).toStrictEqual(input);
  });
});
