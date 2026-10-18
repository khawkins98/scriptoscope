import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
/** Metadata failures append diagnostics; they must never replace original errors. */
export function collectObservations(root, errors) {
  const observations = [], directory = resolve(root, 'test-results/rendering-evidence');
  function scan(path) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory() && entry.name !== 'requirements') scan(child);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const data = JSON.parse(readFileSync(child));
          if (!data || typeof data !== 'object' || (data.cases !== undefined && !Array.isArray(data.cases))) throw new Error('invalid observation shape');
          observations.push({ path: relative(root, child), evidence: data.evidence, slug: data.slug, complete: data.complete,
            executionCommit: data.execution?.gitCommit ?? null, caseCount: data.cases?.length ?? null,
            statuses: data.cases?.reduce((counts, c) => { const status = c?.status ?? 'unspecified'; counts[status] = (counts[status] ?? 0) + 1; return counts; }, {}) });
        } catch (error) { errors.push(`Malformed observation ${relative(root, child)}: ${error.message}`); }
      }
    }
  }
  try { scan(directory); } catch (error) { errors.push(`Cannot collect observations: ${error.message}`); }
  return observations;
}
