import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs}',
        '**/public/**',
        'lib/types/generated-*.ts', // Generated code
        'types/resume.ts', // Type re-exports only
        'app/**/page.tsx', // Next.js pages (integration tested, not unit tested)
        'app/**/layout.tsx', // Next.js layouts
        'app/icon.tsx', // Next.js metadata
        'app/robots.ts', // Next.js metadata
        'app/api/resume/select/**', // Not yet tested (Phase 3.3 pending)
        'proxy.ts', // Middleware proxy
        'components/ui/ContactLinks.tsx', // Display component (E2E tests planned - Phase 5.9)
        'components/ui/Navbar.tsx', // UI component (E2E tests planned - Phase 5.9)
        'components/ui/ThemeToggle.tsx', // UI component (E2E tests planned - Phase 5.9)
        'components/ui/ThemeContext.tsx', // UI component (E2E tests planned - Phase 5.9)
        'components/data/ResumeDownload.tsx', // WASM component (E2E tests planned - Phase 5.9)
        'lib/__tests__/helpers/mock-data.ts', // Test helper
        'scripts/**', // Build/deployment scripts (not unit testable)
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
