# Generated names in optimization reviews

Adopted by maintainer decision on 2026-10-29: exact incidental top-level function and constructor `Function.name` strings produced by minification may vary between builds. This includes the same generated name observed through a returned value's constructor. Exported API identifiers and import paths remain protected; this decision concerns the runtime string value, not renaming an API.

The exception does not authorize changes to public call/type shapes, prototype/member keys, cross-entry alias and constructor identity relationships, property descriptor flags, or explicit error-instance name/code/message behavior. Consumer-provided names and deliberate named API contracts are outside the exception. Other retained contracts continue to apply.

A verifier must identify each affected public binding and establish that the differing value is a generated implementation name. Preserve and report the differences, classifying this admitted category separately from retained-contract failures. Do not blanket-ignore properties named `name` or use a short-string pattern alone as proof of minifier provenance. Independent verification must confirm the classification before it is used to admit a candidate.

This resolves an ambiguity in the optimization comparisons; it does not establish that every previously observed reflection detail was an adopted API promise. It does not rescue rejected experiments: the scalar rewrite remains rejected for its performance/cost result, and the ordered-data rewrite for maintainability and compressed size. No allocation, metadata-timing, diagnostic, host-ownership or other compatibility retirement is granted by this decision.
