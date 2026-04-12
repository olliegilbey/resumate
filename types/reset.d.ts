// ts-reset: tightens built-in TypeScript types across the project.
//
// Impact you will notice:
// - JSON.parse() and Response.json() return `unknown` (forces validation).
// - Array.isArray narrows to readonly arrays correctly.
// - .filter(Boolean) removes nullish/falsy from the element type.
// - Set.has / Map.has / .includes don't widen their argument type.
//
// Combined with `noUncheckedIndexedAccess`, this closes the most common
// "implicit any" / "undefined at runtime" traps.
import "@total-typescript/ts-reset";
