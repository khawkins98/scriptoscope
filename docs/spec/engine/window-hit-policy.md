# Window hit policy follow-ups (#621)

This listing-free web-host contract supplements `hit-regions.md` §9. It changes
no decoded structure-region rule. HP15–HP24, HP36, HP38 and HP49 remain binding.

## Region preparation and reuse

- Every committed recipe window retains the correct structure region and path,
  even when its requested or effective hit mode is `box`. A mode-only switch to
  `region` applies it synchronously without rendering.
- The path's filled set remains exactly the structure region at integer display
  scale. A known solid content rectangle may be emitted directly instead of
  scanning its pixels. Frame pixels on both sides of that rectangle, including
  disconnected runs and holes, must retain their exact membership. Collapsed
  windows follow their existing region rules; no expanded-content assumption
  may introduce pixels into a collapsed region.
- HP20 permits reuse when all region inputs are unchanged: resolved template
  identity and content, placed layout, drawn state, collapsed state, title width,
  chrome dimensions and display scale. Changes to any relevant input invalidate
  reuse. Distinct themes or templates must not alias through a theme slug alone.
- Successful preparation may be reused by the same window. Failed or empty
  builds remain retryable on the next commit under HP44. Stale asynchronous
  preparations must not replace newer committed chrome or its region.
- Work remains preparation-time only. Pointer moves, resize outlines, hover,
  scrolling and mode-only changes never rebuild the region. There is no
  size-based fallback to `box`.

## Wheel routing

HP36 wheel pass-through at excluded frame pixels must continue to work with
trusted wheel input in Chromium, Firefox and WebKit. A non-passive listener on
the hit layer currently provides the WebKit workaround. Engine selection by
user-agent text is not authorized by this contract. Retain the workaround unless
a demonstrated behavioral detection or a measured safe alternative preserves
wheel routing. If retaining it, document its main-thread routing cost and report
same-run wheel measurements; synthetic dispatch alone cannot establish native
scrolling-thread performance.

## Manager disposal

`WindowManager.dispose(): void` releases all of its managed windows through the
same cleanup guarantees as `remove(host)`, and releases its outside-press
listeners and pending touch tap. Repeated calls are safe, including when empty.
Disposed windows are absent from `describe` and `contentPort`; pending renders
cannot commit or call the change listener afterward. Disposal does not remove
caller-owned host elements or release caller-owned themes. It is not a
`ScriptoscopeWindow.unmount()` replacement and does not emit a close event.
A new window may be added after disposal: disposal empties the manager using
its normal removal semantics, rather than introducing a terminal manager state.

## Disposal during gesture setup

If a consumer callback during pointer-gesture setup synchronously removes the
window or disposes its manager, the ended window lifetime blocks all remaining
work for that gesture. No later setup or continuation may acquire pointer
capture, install document listeners, move or resize the retained host, or emit
consumer callbacks. The same guarantee applies when removal or disposal occurs
mid-gesture. Reusing the manager for a new window does not revive gestures from
an ended window lifetime.

## Resize release followed by drag

If a grow-box resize is released and a frame drag starts before its asynchronous
resize preparation commits, the drag owns the suspension: the hit layer's clip
stays `none` across that resize commit until the newer drag ends. The resize
commit still updates chrome and the saved region. Ending the drag restores the
latest committed path, not the path preceding resize. No intermediate style
write may restore a path while the newer drag is captured. Keyboard behavior
and ordinary pointer cancellation remain as specified in HP49.

## Performance acceptance

Retain HPT36's WebKit ceilings: median hit test at most 3 ms and hover/drag frame
p95 at most same-run box baseline plus 3 ms. Chromium and Firefox remain
report-only for this budget. Preserve the five alternating box/region trials,
record individual trials, runner and browser identity, baseline and release
cost. A failed run is evidence to investigate, not a reason to increase the
ceiling, silently retry until green or discard slow samples. Run timing tests
without other intentional CPU-intensive test jobs on this machine and disclose
that limitation. Report region preparation at small and large dimensions and
unchanged-input rebuild counts; wall-clock performance numbers are observations,
not original-engine fidelity claims.
