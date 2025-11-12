'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Download, Loader2, X, AlertCircle } from 'lucide-react'
import type { ResumeData, RoleProfile } from '@/types/resume'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useTheme } from '@/contexts/ThemeContext'

// Extend Window interface for WASM functions
declare global {
  interface Window {
    __wasmReady?: boolean
    __generatePdf?: (payload: string, devMode: boolean) => Uint8Array
    __generatePdfTypst?: (payload: string, devMode: boolean) => Uint8Array
  }
}

interface ResumeDownloadProps {
  resumeData: ResumeData
}

type DownloadStatus = 'idle' | 'verifying' | 'loading_wasm' | 'generating' | 'error'

export function ResumeDownload({ resumeData }: ResumeDownloadProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showTurnstile, setShowTurnstile] = useState(false)
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [downloadInitiated, setDownloadInitiated] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const { theme } = useTheme()

  const roleProfiles = useMemo(() => resumeData.roleProfiles || [], [resumeData.roleProfiles])
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const handleDownloadClick = () => {
    if (!selectedRoleId) {
      setErrorMessage('Please select a role profile first')
      return
    }

    setErrorMessage(null)
    setShowTurnstile(true)
    setStatus('idle') // Keep idle so Turnstile widget shows
  }

  // When Turnstile succeeds, store token (don't start download yet)
  const handleTurnstileSuccess = useCallback((token: string) => {
    console.log('Turnstile verified, token ready')
    setVerifiedToken(token)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  const handleTurnstileError = useCallback(() => {
    setErrorMessage('Verification failed. Please try again.')
    setStatus('error')
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    setErrorMessage('Verification expired. Please refresh and try again.')
    setStatus('error')
    setVerifiedToken(null)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (status === 'verifying') return // Don't close while verifying

    setShowTurnstile(false)
    setVerifiedToken(null)
    setErrorMessage(null)
    setDownloadInitiated(false)
    setStatus('idle')
    turnstileRef.current?.reset()
  }, [status])

  // Auto-download when token is verified (like vCard pattern)
  useEffect(() => {
    if (verifiedToken && !downloadInitiated && status !== 'error') {
      console.log('Auto-triggering PDF download...')

      const timer = setTimeout(async () => {
        setDownloadInitiated(true)

        try {
          setStatus('loading_wasm')

          // Step 1: Get curated bullets from server
          const selectResponse = await fetch('/api/resume/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roleProfileId: selectedRoleId,
              turnstileToken: verifiedToken,
            }),
          })

          if (!selectResponse.ok) {
            const error = await selectResponse.json()
            throw new Error(error.message || 'Failed to select bullets')
          }

          const selectData = await selectResponse.json()

          // Step 2: Load WASM module dynamically from public folder
          setStatus('generating')

          // Check if WASM is already loaded
          if (!window.__wasmReady) {
            console.log('🔧 Loading WASM module...')

            // Create script element to load WASM bindings
            const script = document.createElement('script')
            script.type = 'module'
            script.setAttribute('data-wasm-loader', 'true')
            script.textContent = `
              import init, { generate_pdf_typst } from '/wasm/resume_wasm.js';
              await init('/wasm/resume_wasm_bg.wasm');

              console.log('✅ WASM loaded and cached');

              window.__wasmReady = true;
              window.__generatePdfTypst = generate_pdf_typst;
            `
            document.head.appendChild(script)
          } else {
            console.log('✅ WASM already loaded from cache')
          }

          // Wait for WASM to initialize
          await new Promise((resolve) => {
            const checkReady = setInterval(() => {
              if (window.__wasmReady) {
                clearInterval(checkReady)
                resolve(null)
              }
            }, 100)
          })

          // Step 3: Prepare generation payload
          const roleProfile = roleProfiles.find((r) => r.id === selectedRoleId)
          if (!roleProfile) {
            throw new Error('Role profile not found')
          }

          const payload = {
            personal: resumeData.personal,
            selectedBullets: selectData.selected,
            roleProfile: roleProfile,
            education: resumeData.education,
            skills: resumeData.skills,
            summary: resumeData.summary,
            metadata: null,
          }

          // Step 4: Generate PDF with WASM (using Typst)
          if (!window.__generatePdfTypst) {
            throw new Error('Typst WASM module not initialized')
          }

          // Dev mode based on build environment, not hostname
          // This ensures production builds don't show metadata even on localhost
          const isDevMode = process.env.NODE_ENV === 'development'

          console.log('🎨 Generating PDF with Typst...')
          // Type assertion: we checked above that it's defined
          const generatePdfTypst = window.__generatePdfTypst as (payload: string, devMode: boolean) => Uint8Array
          const pdfBytes = generatePdfTypst(JSON.stringify(payload), isDevMode)
          console.log('✅ PDF generated successfully with Typst')

          // Step 5: Download the PDF
          // Slice creates a copy with proper ArrayBuffer type
          const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url

          // Generate filename: {fullName}-{roleName}-{timestamp}.pdf
          const fullName = ((resumeData.personal.fullName as string | undefined) || 'resume').replace(/\s+/g, '-')
          const roleName = roleProfile.name.toLowerCase().replace(/\s+/g, '-')
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          link.download = `${fullName}-${roleName}-${timestamp}.pdf`

          link.click()
          URL.revokeObjectURL(url)

          // Wait briefly then close modal
          await new Promise(resolve => setTimeout(resolve, 500))

          // Close modal after download starts (NO Turnstile reset - that causes loops!)
          setTimeout(() => {
            setShowTurnstile(false)
            setVerifiedToken(null)
            setErrorMessage(null)
            setDownloadInitiated(false)
            setStatus('idle')
            // Do NOT reset Turnstile here - it triggers re-verification loop
          }, 1500)
        } catch (error) {
          console.error('Download error:', error)
          setErrorMessage(error instanceof Error ? error.message : 'Download failed')
          setStatus('error')
          setDownloadInitiated(false)
          // Keep verifiedToken - user can retry without re-verifying Turnstile
        }
      }, 300) // Short delay like vCard

      return () => {
        clearTimeout(timer)
      }
    }
  }, [verifiedToken, downloadInitiated, status, selectedRoleId, roleProfiles, resumeData])

  const getStatusMessage = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying...'
      case 'loading_wasm':
        return 'Loading Typst compiler...'
      case 'generating':
        return 'Compiling with Typst...'
      case 'error':
        return errorMessage || 'Error occurred'
      default:
        return 'Download PDF'
    }
  }

  const isLoading = ['verifying', 'loading_wasm', 'generating'].includes(status)

  return (
    <div className="space-y-4">
      {/* Role Selection Dropdown */}
      <select
        id="role-select"
        value={selectedRoleId}
        onChange={(e) => {
          setSelectedRoleId(e.target.value)
          setErrorMessage(null)
        }}
        disabled={isLoading}
        className="w-full pl-4 pr-12 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-[length:1.5rem] bg-[position:right_0.75rem_center] bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`
        }}
      >
        <option value="">Choose a role...</option>
        {roleProfiles.map((profile: RoleProfile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>

      {/* Download Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleDownloadClick}
        disabled={!selectedRoleId || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {getStatusMessage()}
          </>
        ) : (
          <>
            {getStatusMessage()}
            <Download className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {/* Error Message */}
      {errorMessage && !showTurnstile && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">
          {errorMessage}
        </p>
      )}

      {/* Turnstile Modal - Matching vCard pattern */}
      {showTurnstile && siteKey && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <GlassPanel
            padding="lg"
            radius="2xl"
            className="max-w-md w-full mx-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              disabled={status === 'verifying'}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Only show header during Turnstile verification */}
            {!verifiedToken && (
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Verify You&apos;re Human
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Complete verification to download your tailored resume.
                </p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && status === 'error' && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{errorMessage}</p>
                  <button
                    onClick={() => {
                      setErrorMessage(null)
                      setStatus('idle')
                      // Don't reset Turnstile - it prevents the loop
                      // User is still verified and can retry
                    }}
                    className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {verifiedToken || status === 'loading_wasm' || status === 'generating' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    {status === 'loading_wasm' || status === 'generating' ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    ) : (
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    {status === 'loading_wasm' || status === 'generating' ? getStatusMessage() : 'Verification Complete!'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    {status === 'loading_wasm' || status === 'generating' ? 'Please wait...' : 'Starting your download...'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center p-3 relative">
                {/* Solid background matching Turnstile theme */}
                <div className="absolute inset-0 rounded-lg bg-slate-100 dark:bg-[#262626]" />

                {/* Turnstile widget on top */}
                <div className="relative z-10">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={siteKey}
                    onSuccess={handleTurnstileSuccess}
                    onError={handleTurnstileError}
                    onExpire={handleTurnstileExpire}
                    options={{
                      theme: theme,
                      size: 'normal',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleCloseModal}
              disabled={status === 'verifying'}
              className="mt-4 w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          </GlassPanel>
        </div>
      )}
    </div>
  )
}
