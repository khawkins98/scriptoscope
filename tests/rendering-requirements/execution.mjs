import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
export function gitIdentity(root) {
  const exactRoot = realpathSync(root);
  const git = args => execFileSync('git', ['-c', `safe.directory=${exactRoot}`, ...args], { cwd: exactRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let workingTreeDirty = null, cleanlinessError;
  try { workingTreeDirty = git(['status', '--porcelain', '--untracked-files=normal']).length > 0; }
  catch (error) { cleanlinessError = `Unable to establish worktree cleanliness: ${error.message}`; }
  let executionCommit = process.env.SCRIPTOSCOPE_GIT_COMMIT ?? process.env.GITHUB_SHA;
  if (!executionCommit) try { executionCommit = git(['rev-parse', 'HEAD']); } catch { executionCommit = null; }
  return { executionCommit, workingTreeDirty, ...(cleanlinessError ? { cleanlinessError } : {}) };
}
