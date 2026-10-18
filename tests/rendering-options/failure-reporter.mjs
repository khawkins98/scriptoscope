import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { gitIdentity } from '../rendering-requirements/execution.mjs';
import { archiveFailure } from './failure-archive.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const archiveRoot = fileURLToPath(new URL('../../test-results/rendering-failure-archive/', import.meta.url));

export default class FailureReporter {
  onTestEnd(test, result) {
    if (!['failed', 'timedOut', 'interrupted'].includes(result.status)) return;
    try {
      const { directory, record } = archiveFailure(archiveRoot, {
        execution: gitIdentity(root), preservedAt: new Date().toISOString(),
        project: test.parent.project().name, testTitle: test.title,
        testPath: relative(root, test.location.file).replaceAll('\\', '/'),
        status: result.status, retry: result.retry,
        errors: result.errors.map(error => ({ message: error.message, stack: error.stack, value: error.value })),
      }, result.attachments);
      console.log(`[rendering] ${record.archiveComplete ? 'Preserved failure artifacts' : 'Incomplete failure archive'}: ${relative(root, directory)}`);
    } catch (error) {
      console.error(`[rendering] Unable to preserve failure artifacts (${error.code ?? error.name}); original test status remains ${result.status}`);
    }
  }
}
