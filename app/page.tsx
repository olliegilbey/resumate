"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/Button"
import { ContactLinks } from "@/components/ui/ContactLinks"
import Link from "next/link"
import { ArrowRight, Briefcase, Download, AlertCircle, X } from "lucide-react"
import resumeData from "@/data/resume-data.json"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { useTheme } from "@/contexts/ThemeContext"

export default function HomePage() {
  const { theme } = useTheme()
  const [showTurnstileModal, setShowTurnstileModal] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [downloadInitiated, setDownloadInitiated] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const autoDownloadTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Validate Turnstile site key
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!siteKey) {
    console.error('NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured')
  }

  // When Turnstile succeeds, store token
  const handleTurnstileSuccess = (token: string) => {
    console.log('Turnstile verified, token ready')
    setVerifiedToken(token)
    setIsVerifying(false)
    setErrorMessage(null)
  }

  const handleOpenModal = () => {
    setShowTurnstileModal(true)
    setVerifiedToken(null)
    setErrorMessage(null)
    setDownloadInitiated(false)
  }

  // Manual download button click handler
  const handleManualDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

    // Cancel auto-download timer if it's pending
    if (autoDownloadTimerRef.current) {
      clearTimeout(autoDownloadTimerRef.current)
      autoDownloadTimerRef.current = null
    }

    // If download already initiated, don't trigger again
    if (downloadInitiated) {
      return
    }

    // Mark as initiated and allow the download
    setDownloadInitiated(true)

    // Trigger download immediately
    if (verifiedToken) {
      const link = document.createElement('a')
      link.href = `/api/contact-card?token=${encodeURIComponent(verifiedToken)}`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    // Close modal after download starts
    setTimeout(() => {
      setShowTurnstileModal(false)
      setVerifiedToken(null)
      setErrorMessage(null)
      setDownloadInitiated(false)
    }, 1000)
  }

  const handleCloseModal = useCallback(() => {
    if (isVerifying) return // Don't close while verifying

    // Clear auto-download timer if pending
    if (autoDownloadTimerRef.current) {
      clearTimeout(autoDownloadTimerRef.current)
      autoDownloadTimerRef.current = null
    }

    setShowTurnstileModal(false)
    setVerifiedToken(null)
    setErrorMessage(null)
    setDownloadInitiated(false)
    turnstileRef.current?.reset()
  }, [isVerifying])

  const handleTurnstileError = useCallback(() => {
    setErrorMessage('Verification failed. Please try again.')
    setIsVerifying(false)
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    setErrorMessage('Verification expired. Please refresh and try again.')
    setIsVerifying(false)
    setVerifiedToken(null)
  }, [])

  // Auto-download when token is verified (with slight delay for UX)
  useEffect(() => {
    if (verifiedToken && !downloadInitiated) {
      console.log('Auto-triggering download...')

      const timer = setTimeout(async () => {
        // Mark as initiated WHEN download actually triggers (not before)
        setDownloadInitiated(true)

        // Create a temporary anchor element and trigger download
        const link = document.createElement('a')
        link.href = `/api/contact-card?token=${encodeURIComponent(verifiedToken)}`
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Wait briefly to show "Download Starting..." state
        await new Promise(resolve => setTimeout(resolve, 500))

        // Close modal after download starts
        setTimeout(() => {
          setShowTurnstileModal(false)
          setVerifiedToken(null)
          setErrorMessage(null)
          setDownloadInitiated(false)
        }, 1500)
      }, 300) // Short delay to show success state - feels snappier

      autoDownloadTimerRef.current = timer
      return () => {
        clearTimeout(timer)
        autoDownloadTimerRef.current = null
      }
    }
  }, [verifiedToken, downloadInitiated])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTurnstileModal && !isVerifying) {
        handleCloseModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showTurnstileModal, isVerifying, handleCloseModal])
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-16 pb-8 md:pt-24 md:pb-12">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 pb-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 bg-clip-text text-transparent">
              {resumeData?.personal?.name || 'Name Not Available'}
            </h1>

            {/* Contact Links - Compact Horizontal Style */}
            {resumeData?.personal && (
              <ContactLinks
                linkedin={resumeData.personal.linkedin || ''}
                github={resumeData.personal.github || ''}
                location={resumeData.personal.location || ''}
                variant="compact"
              />
            )}

            {/* Save Contact Card Button */}
            <div className="mt-8">
              <Button
                onClick={handleOpenModal}
                disabled={isVerifying}
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Get Contact Card
              </Button>
            </div>

            {/* Turnstile Modal */}
            {showTurnstileModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={handleCloseModal}
              >
                <div
                  className="glass rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close button */}
                  <button
                    onClick={handleCloseModal}
                    disabled={isVerifying}
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
                        Complete the verification below to download my contact card.
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800">{errorMessage}</p>
                        <button
                          onClick={() => {
                            setErrorMessage(null)
                            turnstileRef.current?.reset()
                          }}
                          className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}

                  {isVerifying ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-300">Verifying...</p>
                    </div>
                  ) : verifiedToken ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                          Verification Complete!
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                          Your download will start automatically in a moment.
                        </p>
                      </div>
                      {/* Always show fallback button in case auto-download fails */}
                      <a
                        href={`/api/contact-card?token=${encodeURIComponent(verifiedToken)}`}
                        onClick={handleManualDownloadClick}
                        className="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-slate-700 dark:text-slate-200 bg-slate-100/60 dark:bg-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-600/80 rounded-lg transition-all duration-200 backdrop-blur-sm"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download didn&apos;t start? Click here
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-3 relative">
                      {/* Solid background matching Turnstile theme */}
                      <div className="absolute inset-0 rounded-lg bg-slate-100 dark:bg-[#262626]" />

                      {/* Turnstile widget on top */}
                      <div className="relative z-10">
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={siteKey || ''}
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
                    disabled={isVerifying}
                    className="mt-4 w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        <div className="glass rounded-2xl p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">About Me</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
              {resumeData?.summary || `Professional with expertise in various domains. Based in ${resumeData?.personal?.location || 'various locations'}.`}
            </p>
            {resumeData?.interests && resumeData.interests.length > 0 && (
              <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
                When not working, you&apos;ll find me exploring: {resumeData.interests.join(', ')}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recruiter CTA */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 pb-16">
        <div className="glass rounded-2xl p-8 md:p-10 text-center">
          <Briefcase className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">Looking to Hire?</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto">
            View my full professional experience, download my resume, or explore my work history interactively.
          </p>
          <Link href="/resume">
            <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700">
              View Professional Profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
