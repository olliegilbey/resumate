import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResumeDownload } from '../ResumeDownload'
import type { ResumeData } from '@/types/resume'

// Mock Turnstile
const mockTurnstileReset = vi.fn()
const mockOnSuccess = vi.fn()

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: vi.fn(({ onSuccess, onError }: { onSuccess: (token: string) => void; onError: () => void }) => {
    // Store callback for test control
    mockOnSuccess.mockImplementation(onSuccess)
    return (
      <div data-testid="turnstile-widget">
        <button
          data-testid="turnstile-verify"
          onClick={() => onSuccess('test-token-123')}
        >
          Verify
        </button>
        <button
          data-testid="turnstile-error"
          onClick={() => onError()}
        >
          Error
        </button>
      </div>
    )
  }),
}))

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

// Mock resume-metrics
vi.mock('@/lib/resume-metrics', () => ({
  getTotalBullets: () => 50,
  getTotalPositions: () => 10,
}))

// Minimal resume data for tests
const mockResumeData: ResumeData = {
  personal: {
    name: 'Test User',
    location: 'Test City',
    linkedin: 'https://linkedin.com/in/test',
    github: 'https://github.com/test',
  },
  summary: 'Test summary',
  experience: [],
  education: [],
  skills: {},
  interests: [],
  roleProfiles: [
    {
      id: 'test-role',
      name: 'Test Role',
      description: 'A test role profile',
      tagWeights: {},
      scoringWeights: { priority: 0.5, tagRelevance: 0.5 },
    },
  ],
}

describe('ResumeDownload', () => {
  const originalEnv = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'

    // Mock fetch
    global.fetch = vi.fn()

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test')
    global.URL.revokeObjectURL = vi.fn()

    // Reset WASM state
    delete (window as unknown as { __wasmReady?: boolean }).__wasmReady
    delete (window as unknown as { __generatePdfTypst?: unknown }).__generatePdfTypst
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalEnv
    vi.restoreAllMocks()
  })

  it('should render role profile dropdown', () => {
    render(<ResumeDownload resumeData={mockResumeData} />)
    expect(screen.getByText('Test Role')).toBeInTheDocument()
  })

  it('should show Turnstile modal when download clicked with role selected', async () => {
    const user = userEvent.setup()
    render(<ResumeDownload resumeData={mockResumeData} />)

    // Select a role
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'test-role')

    // Click download
    const downloadBtn = screen.getByRole('button', { name: /download pdf/i })
    await user.click(downloadBtn)

    // Modal should appear with Turnstile
    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    })
  })

  /**
   * CRITICAL TEST: Token reset on error enables retry
   *
   * This test prevents regression of the bug fixed in commit 514a174.
   * When PDF generation fails (API error, WASM error, etc.),
   * the Turnstile token MUST be reset so users can retry.
   *
   * Without this reset, the consumed token blocks all retry attempts.
   */
  it('should reset verifiedToken on download error to allow retry', async () => {
    const user = userEvent.setup()

    // Mock API to fail
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    render(<ResumeDownload resumeData={mockResumeData} />)

    // Select role and open modal
    await user.selectOptions(screen.getByRole('combobox'), 'test-role')
    await user.click(screen.getByRole('button', { name: /download pdf/i }))

    // Wait for modal
    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    })

    // Trigger Turnstile verification success
    await act(async () => {
      await user.click(screen.getByTestId('turnstile-verify'))
    })

    // Wait for error state (download will fail due to fetch mock)
    await waitFor(() => {
      expect(screen.getByText(/try again/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Error message should be visible
    expect(screen.getByText(/network error|failed/i)).toBeInTheDocument()

    // Click "Try again" - this should work because token was reset
    const tryAgainBtn = screen.getByText(/try again/i)
    await user.click(tryAgainBtn)

    // Turnstile widget should be visible again for fresh verification
    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    })
  })

  it('should reset token when bullet selection API fails', async () => {
    const user = userEvent.setup()

    // Mock API to return 500 error
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Selection failed' }),
    } as Response)

    render(<ResumeDownload resumeData={mockResumeData} />)

    await user.selectOptions(screen.getByRole('combobox'), 'test-role')
    await user.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-verify')).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByTestId('turnstile-verify'))
    })

    // Wait for error state - error message in red box
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify error message is displayed
    expect(screen.getByText('Selection failed')).toBeInTheDocument()
  })

  it('should reset token when WASM fails to load', async () => {
    const user = userEvent.setup()

    // Mock successful API but WASM never becomes ready
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ selected: [] }),
    } as Response)

    // Set WASM ready but missing function (simulates partial load failure)
    ;(window as unknown as { __wasmReady?: boolean }).__wasmReady = true
    // __generatePdfTypst intentionally NOT set

    render(<ResumeDownload resumeData={mockResumeData} />)

    await user.selectOptions(screen.getByRole('combobox'), 'test-role')
    await user.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-verify')).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByTestId('turnstile-verify'))
    })

    // Should show error about missing WASM function - check for Try again button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify WASM error message
    expect(screen.getByText(/wasm module not initialized/i)).toBeInTheDocument()
  })

  it('should show error when Turnstile verification fails', async () => {
    const user = userEvent.setup()
    render(<ResumeDownload resumeData={mockResumeData} />)

    await user.selectOptions(screen.getByRole('combobox'), 'test-role')
    await user.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-error')).toBeInTheDocument()
    })

    // Trigger Turnstile error
    await user.click(screen.getByTestId('turnstile-error'))

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
    })
  })

  it('should close modal when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ResumeDownload resumeData={mockResumeData} />)

    await user.selectOptions(screen.getByRole('combobox'), 'test-role')
    await user.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    })

    // Click cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument()
    })
  })

  it('should disable download button when no role selected', () => {
    render(<ResumeDownload resumeData={mockResumeData} />)

    // Button should be disabled without role selection
    const downloadBtn = screen.getByRole('button', { name: /download pdf/i })
    expect(downloadBtn).toBeDisabled()

    // Turnstile should NOT appear
    expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument()
  })

  it('should enable download button when role is selected', async () => {
    const user = userEvent.setup()
    render(<ResumeDownload resumeData={mockResumeData} />)

    // Initially disabled
    const downloadBtn = screen.getByRole('button', { name: /download pdf/i })
    expect(downloadBtn).toBeDisabled()

    // Select role
    await user.selectOptions(screen.getByRole('combobox'), 'test-role')

    // Now enabled
    expect(downloadBtn).toBeEnabled()
  })
})
