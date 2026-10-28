# Full-clip header allocator substitution — proposal

Status: review only. This compatibility change is not approved for release. Independent public parity and complete-render timing are pending.

## Behavior and scope

The header facade currently allocates its output through the public overridable static PixelBuffer.alloc, paints into a detached copy, and transfers that copy into the output. The proposal constructs and paints a fresh output within the compositor when the already prepared effective clip covers the entire requested rectangle. It removes one output-sized allocation, its clone copy, and the final full-area transfer on that route.

Full coverage includes an unbounded clip or a containing rectangle, and applies to window and list header surfaces. Early returns before output construction are unchanged. Clipped and empty header outputs retain the public allocator and detached painting. Header columns, other controls, and the existing generic/prepared caller-supplied-buffer functions retain their existing behavior.

The new compositor takes paint inputs, constructs its own output, and returns only after painting. Callers cannot supply an output buffer or assert private ownership. Its declaration is available through the internal engine barrel; package exports are unchanged.

## Proposed compatibility change

For full-clip header calls reaching output construction, PixelBuffer.alloc overrides are no longer invoked. This removes their invocation count, instrumentation and side effects, thrown errors and their precedence, custom dimensions, initial bytes, returned object/data identity, and aliasing to resources or other externally retained buffers. Output instead has the requested dimensions and fresh ordinary zero-initialized storage. Removing allocations also changes resource-pressure behavior.

Applications using allocator overrides only to measure calls would need to instrument the surrounding application operation. There is no transparent migration for custom returned buffers or allocator-dependent errors; those users would need to retain the current implementation or review a separately designed explicit-buffer API. This proposal does not introduce that API.

No additional option/resource snapshot is proposed. The existing prepared plan determines coverage; dynamic resource pixels, admission, diagnostics, callback order and lifetime checks remain governed by the retained contracts. This is an ordinary module ownership boundary, not a guarantee against replaced globals or hostile prototype mutation.

## Evidence and costs

The frozen source revision changes two production files: +624 source bytes, +6 noncomment lines and +249 bytes across all seven emitted JavaScript files. One compositor and a compound result record are added; existing generic paths remain. This is execution optimization, not a source-complexity reduction.

The source-owned census observes a full 1200×800 header removing 3,840,000 allocated bytes, 7,680,000 logical copied bytes and 960,000 scalar transfer iterations. That is a stress geometry, not a typical header. Counters are logical work accounting, not browser heap measurements or speed evidence. Source review reproduced all seven frozen JavaScript files from both source versions and found no blocking source issue; independent public validation is still required.

Frozen identity metadata SHA256: 828b6884a240fc2e7bb61e26a689c74f1818dc22642cca78c481a39a3f508624. No approval or performance conclusion follows from that identity.
