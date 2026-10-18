import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safe = value => String(value).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 100) || 'attachment';
const extensions = { 'image/png': '.png', 'application/zip': '.zip', 'application/json': '.json', 'text/plain': '.txt' };

/** Preserve failure bytes outside Playwright's replaceable output directory.
 * Errors are recorded per attachment; this must not replace the test failure. */
export function archiveFailure(archiveRoot, metadata, attachments) {
  mkdirSync(archiveRoot, { recursive: true });
  const directory = mkdtempSync(join(archiveRoot, 'failure-'));
  const files = attachments.map((attachment, index) => {
    const name = safe(attachment.path ? basename(attachment.path) : attachment.name);
    const extension = extensions[attachment.contentType] ?? '.bin';
    const suffix = attachment.path || name.endsWith(extension) ? '' : extension;
    const path = `${String(index + 1).padStart(3, '0')}-${name}${suffix}`;
    try {
      const bytes = attachment.path ? readFileSync(attachment.path)
        : attachment.body === undefined ? null : Buffer.from(attachment.body);
      if (bytes === null) return { name: attachment.name, contentType: attachment.contentType, status: 'unavailable', reason: 'no-path-or-body' };
      writeFileSync(join(directory, path), bytes, { flag: 'wx' });
      return { name: attachment.name, contentType: attachment.contentType, status: 'preserved', path, bytes: bytes.length, sha256: hash(bytes) };
    } catch (error) {
      return { name: attachment.name, contentType: attachment.contentType, status: 'unavailable', reason: error.code ?? error.name };
    }
  });
  const record = { schemaVersion: 1, evidence: 'preserved-failed-test-artifacts', ...metadata,
    files, archiveComplete: files.length > 0 && files.every(file => file.status === 'preserved') };
  writeFileSync(join(directory, 'record.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return { directory, record };
}
