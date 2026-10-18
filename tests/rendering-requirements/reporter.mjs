import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { gitIdentity } from './execution.mjs';
import { fileURLToPath } from 'node:url';
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const output = new URL('../../test-results/rendering-evidence/requirements/execution.json', import.meta.url);
/** Execution evidence only. This reporter never reads or promotes fidelity statuses. */
export default class RequirementReporter {
  onBegin() {
    this.startedAt = new Date().toISOString(); this.assertions = [];
    rmSync(output, { force: true });
  }
  onTestEnd(test, result) {
    for (const annotation of test.annotations.filter(a => a.type === 'fidelity-assertion')) {
      this.assertions.push({ id: annotation.description, project: test.parent.project().name, browserName: test.parent.project().use.browserName, deviceScaleFactor: test.parent.project().use.deviceScaleFactor,
        mode: test.title.startsWith('source:') ? 'source' : test.title.startsWith('built:') ? 'built' : 'unrecognized',
        status: result.status, retry: result.retry, testTitle: test.title, path: relative(root, realpathSync(test.location.file)).replaceAll('\\', '/'), durationMs: result.duration });
    }
  }
  onEnd(result) {
    const identity = gitIdentity(root);
    mkdirSync(dirname(fileURLToPath(output)), { recursive: true });
    writeFileSync(output, JSON.stringify({ schemaVersion: 1, evidence: 'observed-assertion-execution', ...identity,
      platform: process.platform, arch: process.arch, startedAt: this.startedAt, completedAt: new Date().toISOString(), status: result.status, assertions: this.assertions }, null, 2) + '\n');
  }
}
