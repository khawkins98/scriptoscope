import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
export function gitIdentity(root) {
  const exactRoot = realpathSync(root);
  const git = args => execFileSync('git', ['-c', `safe.directory=${exactRoot}`, ...args], { cwd: exactRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let workingTreeDirty = null, cleanlinessError;
  try { workingTreeDirty = git(['status', '--porcelain', '--untracked-files=normal']).length > 0; }
  catch { cleanlinessError = 'Unable to establish worktree cleanliness'; }
  let executionCommit = null, commitError;
  try { executionCommit = git(['rev-parse', 'HEAD']); }
  catch { commitError = 'Unable to establish checkout commit'; }
  // Environment variables describe a trigger/claim, not necessarily the checkout
  // that actually ran. Keep discrepancies visible without replacing observed HEAD.
  const declaredCommits = Object.fromEntries(['SCRIPTOSCOPE_GIT_COMMIT', 'GITHUB_SHA']
    .filter(key => process.env[key]).map(key => [key, process.env[key]]));
  return { executionCommit, workingTreeDirty, identitySource: executionCommit ? 'git-checkout' : 'unknown',
    ...(Object.keys(declaredCommits).length ? { declaredCommits,
      declarationsMatchCheckout: executionCommit ? Object.values(declaredCommits).every(value => value === executionCommit) : null } : {}),
    ...(cleanlinessError ? { cleanlinessError } : {}), ...(commitError ? { commitError } : {}) };
}
