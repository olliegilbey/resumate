// Type declarations for WASM module

declare module '/wasm/resume_wasm.js' {
  export default function init(): Promise<void>

  export function init_panic_hook(): void
  export function version(): string
  export function generate_pdf(payload_json: string): Uint8Array
  export function generate_pdf_typst(payload_json: string, dev_mode: boolean): Uint8Array
  export function generate_docx(payload_json: string): Uint8Array
  export function validate_payload_json(payload_json: string): void
  export function estimate_pdf_size(bullet_count: number): number
  export function estimate_docx_size(bullet_count: number): number
}
