/* tslint:disable */
/* eslint-disable */
/**
 * Get build timestamp (when WASM was compiled)
 */
export function build_info(): string;
/**
 * Validate JSON payload structure without generating
 *
 * Useful for pre-flight validation before expensive generation
 */
export function validate_payload_json(payload_json: string): void;
export function init_panic_hook(): void;
/**
 * Generate PDF from GenerationPayload JSON using Typst
 *
 * This is the new Typst-based PDF generation, replacing the manual pdf-writer implementation.
 * Typst provides professional typography, automatic layout, and template-based design.
 *
 * # Arguments
 * * `payload_json` - JSON string containing GenerationPayload
 * * `dev_mode` - If true, includes build metadata in PDF
 *
 * # Returns
 * * `Result<Vec<u8>, JsValue>` - PDF bytes or error
 *
 * # Example (JavaScript)
 * ```js
 * const payloadJson = JSON.stringify({
 *   personal: { name: "John Doe", ... },
 *   selected_bullets: [...],
 *   role_profile: {...},
 * });
 * const isDev = window.location.hostname === 'localhost';
 * const pdfBytes = await generate_pdf_typst(payloadJson, isDev);
 * ```
 */
export function generate_pdf_typst(payload_json: string, dev_mode: boolean): Uint8Array;
/**
 * Test export to validate WASM build pipeline
 */
export function version(): string;
/**
 * Get estimated PDF size in bytes (for progress UI)
 */
export function estimate_pdf_size(bullet_count: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly build_info: (a: number) => void;
  readonly estimate_pdf_size: (a: number) => number;
  readonly generate_pdf_typst: (a: number, b: number, c: number, d: number) => void;
  readonly init_panic_hook: () => void;
  readonly validate_payload_json: (a: number, b: number, c: number) => void;
  readonly version: (a: number) => void;
  readonly lut_inverse_interp16: (a: number, b: number, c: number) => number;
  readonly qcms_profile_precache_output_transform: (a: number) => void;
  readonly qcms_white_point_sRGB: (a: number) => void;
  readonly qcms_transform_data_rgb_out_lut: (a: number, b: number, c: number, d: number) => void;
  readonly qcms_transform_data_rgba_out_lut: (a: number, b: number, c: number, d: number) => void;
  readonly qcms_transform_data_bgra_out_lut: (a: number, b: number, c: number, d: number) => void;
  readonly qcms_transform_data_rgb_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
  readonly qcms_transform_data_rgba_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
  readonly qcms_transform_data_bgra_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
  readonly lut_interp_linear16: (a: number, b: number, c: number) => number;
  readonly qcms_enable_iccv4: () => void;
  readonly qcms_profile_is_bogus: (a: number) => number;
  readonly qcms_transform_release: (a: number) => void;
  readonly __wbindgen_export_0: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_1: (a: number, b: number) => number;
  readonly __wbindgen_export_2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
