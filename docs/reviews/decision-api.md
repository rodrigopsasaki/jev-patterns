# Decision API review and resolution

This review concerns the data-model, predicate and match revision after the initial prototype. Provenance: native Codex subagent review, with parent integration and verification. The existing Interlock runtime remained unavailable; this is not an Interlock-cleared session.

## Findings

1. The initial mapped callback-output type returned unknown from match(), including for entirely string-returning handlers. Callback arguments narrowed correctly, but outputs lost their ergonomic benefit.
2. Option key extraction could become never for disjoint input unions or erased object types. Broad numeric index types could incorrectly promise only numeric-looking strings even though JavaScript also produces NaN/Infinity keys. Named interfaces lost their known option names.
3. Parsed answer dictionaries included undefined for broad string indices but missed numeric and template-pattern indices. Consumers without noUncheckedIndexedAccess could then dereference absent answers.

## Resolutions

Match now infers the actual handler object and returns the union of its ReturnType values. The implementation contains one documented return-type assertion where TypeScript loses the correlation through runtime dispatch; each branch still passes the narrowed decision to its corresponding handler. Compile-time tests cover heterogeneous objects, numbers, null and promises, while runtime tests verify exact callback selection, promise identity and exception propagation.

OptionKeys distributes over unions and widens erased or broad numeric keys. The probability-map overload uses mapped property constraints so named interfaces retain their keys. These types assume the input's static probability-map contract describes its actual enumerable keys; structural widening with extra runtime properties cannot be recovered by inference.

Answer field optionality is detected per key using the dictionary's mapped type, retaining undefined for string, numeric and template-pattern indices. The same type contract suite runs with and without noUncheckedIndexedAccess.

Additional parent integration preserved object identity when Choice methods dispatch callbacks, retained tie honesty, and moved a meaningful third contender ahead of top-two contention in provisional classification precedence. Default shape predicates intentionally overlap. No empirical threshold tuning or calibration work was performed.

## Validation

34 runtime tests pass. Both TypeScript configurations pass, including the runnable ownership example under the primary configuration. Both demos execute. Prior numeric and raw-provenance regressions remain covered. Report-only probes were kept out of the published source tree.
