/**
 * Site-wide footer with the UK Companies Act disclosure line.
 *
 * Rendered once in the root layout so every page carries the registered
 * company details (name, jurisdiction, company number). Deliberately quiet:
 * small muted text that reads as standard legal-footer boilerplate.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <Navbar />
 * {children}
 * <Footer />
 * ```
 *
 * @module components/ui/Footer
 */
export function Footer() {
  return (
    <footer className="w-full py-6 px-6">
      <p className="max-w-5xl mx-auto text-center text-xs text-slate-500 dark:text-slate-400">
        OLLIE.GG LTD &middot; Registered in England &amp; Wales &middot; Company No. 17374210
        &middot; Registered office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ
      </p>
    </footer>
  );
}
