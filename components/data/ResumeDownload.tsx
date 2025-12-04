'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Download, Loader2, X, AlertCircle } from 'lucide-react'
import type { ResumeData, RoleProfile } from '@/types/resume'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useTheme } from '@/contexts/ThemeContext'
import { getTotalBullets, getTotalPositions } from '@/lib/resume-metrics'
import { usePostHogResume } from '@/lib/posthog-client'
import { AIProgressIndicator, type AIProgressStage } from '@/components/ui/AIProgressIndicator'
import { AI_MODELS, FALLBACK_ORDER, type AIProvider } from '@/lib/ai/providers/types'

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

// Minimum job description length for AI selection
const MIN_JOB_DESCRIPTION_LENGTH = 50

export function ResumeDownload({ resumeData }: ResumeDownloadProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [jobDescription, setJobDescription] = useState<string>('')
  const [aiProvider, setAiProvider] = useState<AIProvider>(FALLBACK_ORDER[0])
  const [email, setEmail] = useState<string>('')
  const [linkedin, setLinkedin] = useState<string>('')
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [aiStage, setAiStage] = useState<AIProgressStage>('idle')
  const [aiRetryCount, setAiRetryCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showTurnstile, setShowTurnstile] = useState(false)
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [downloadInitiated, setDownloadInitiated] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const flowStartRef = useRef<number>(0) // Track timing from flow initiation
  const { theme } = useTheme()
  const analytics = usePostHogResume()

  const roleProfiles = useMemo(() => resumeData.roleProfiles || [], [resumeData.roleProfiles])
  const totalExperiences = useMemo(() => {
    return getTotalBullets(resumeData.experience) + getTotalPositions(resumeData.experience)
  }, [resumeData.experience])
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Mutual exclusivity: job description disables dropdown and vice versa
  const isJobDescriptionMode = jobDescription.trim().length > 0
  const isDropdownMode = selectedRoleId.length > 0

  const handleDownloadClick = () => {
    if (!selectedRoleId && !jobDescription.trim()) {
      setErrorMessage('Please select a role or enter a job description')
      return
    }

    // Reset AI state
    setAiStage('idle')
    setAiRetryCount(0)
    setErrorMessage(null)
    setShowTurnstile(true)
    setStatus('idle')
    flowStartRef.current = Date.now()

    if (isJobDescriptionMode) {
      // AI mode - validate job description length
      if (jobDescription.trim().length < MIN_JOB_DESCRIPTION_LENGTH) {
        setErrorMessage(`Job description too short (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters)`)
        setShowTurnstile(false)
        return
      }

      // Track: AI download initiated
      analytics.initiated({
        generation_method: 'ai',
        ai_provider: aiProvider,
        job_description_length: jobDescription.trim().length,
      })
    } else {
      // Heuristic mode
      const roleProfile = roleProfiles.find((r) => r.id === selectedRoleId)

      // Track: Download button clicked (GeoIP captured here)
      analytics.initiated({
        generation_method: 'heuristic',
        role_profile_id: selectedRoleId,
        role_profile_name: roleProfile?.name || 'Unknown',
      })
    }
  }

  // When Turnstile succeeds, store token (don't start download yet)
  const handleTurnstileSuccess = useCallback((token: string) => {
    console.log('Turnstile verified, token ready')
    setVerifiedToken(token)
    setStatus('idle')
    setErrorMessage(null)

    // Set AI stage to verifying complete (will transition to analyzing in useEffect)
    if (jobDescription.trim().length >= MIN_JOB_DESCRIPTION_LENGTH) {
      setAiStage('verifying')
    }

    // Track: Turnstile verification complete
    analytics.verified({
      generation_method: isJobDescriptionMode ? 'ai' : 'heuristic',
      role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
      ai_provider: isJobDescriptionMode ? aiProvider : undefined,
      turnstile_duration_ms: Date.now() - flowStartRef.current,
    })
  }, [analytics, selectedRoleId, jobDescription, isJobDescriptionMode, aiProvider])

  const handleTurnstileError = useCallback(() => {
    setErrorMessage('Verification failed. Please try again.')
    setStatus('error')

    // Track: Turnstile verification failed
    analytics.error({
      generation_method: isJobDescriptionMode ? 'ai' : 'heuristic',
      role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
      ai_provider: isJobDescriptionMode ? aiProvider : undefined,
      error_stage: 'turnstile',
      error_message: 'Turnstile verification failed',
      duration_ms: Date.now() - flowStartRef.current,
    })
  }, [analytics, selectedRoleId, isJobDescriptionMode, aiProvider])

  const handleTurnstileExpire = useCallback(() => {
    setErrorMessage('Verification expired. Please refresh and try again.')
    setStatus('error')
    setVerifiedToken(null)

    // Track: Turnstile expired
    analytics.error({
      generation_method: isJobDescriptionMode ? 'ai' : 'heuristic',
      role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
      ai_provider: isJobDescriptionMode ? aiProvider : undefined,
      error_stage: 'turnstile',
      error_message: 'Turnstile verification expired',
      duration_ms: Date.now() - flowStartRef.current,
    })
  }, [analytics, selectedRoleId, isJobDescriptionMode, aiProvider])

  const handleCloseModal = useCallback(() => {
    if (status === 'verifying') return // Don't close while verifying

    // Track: User cancelled (if flow was in progress)
    if (flowStartRef.current > 0 && status !== 'error') {
      const stage = verifiedToken
        ? (status === 'loading_wasm' || status === 'generating' ? 'compiling' : 'verified')
        : 'turnstile'
      analytics.cancelled({
        generation_method: isJobDescriptionMode ? 'ai' : 'heuristic',
        role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
        ai_provider: isJobDescriptionMode ? aiProvider : undefined,
        stage,
        duration_ms: Date.now() - flowStartRef.current,
      })
    }

    setShowTurnstile(false)
    setVerifiedToken(null)
    setEmail('')
    setLinkedin('')
    setErrorMessage(null)
    setDownloadInitiated(false)
    setStatus('idle')
    setAiStage('idle')
    setAiRetryCount(0)
    flowStartRef.current = 0
    turnstileRef.current?.reset()
  }, [status, verifiedToken, analytics, selectedRoleId, isJobDescriptionMode, aiProvider])

  // Auto-download when token is verified (like vCard pattern)
  useEffect(() => {
    if (verifiedToken && !downloadInitiated && status !== 'error') {
      console.log('Auto-triggering PDF download...')

      // Capture current mode at time of verification
      const isAIMode = jobDescription.trim().length >= MIN_JOB_DESCRIPTION_LENGTH
      const currentProvider = aiProvider
      const currentJobDescription = jobDescription.trim()

      const timer = setTimeout(async () => {
        setDownloadInitiated(true)

        // Track timing for analytics
        const startTime = Date.now()
        let wasmLoadStart = 0
        let wasmLoadEnd = 0
        let generationStart = 0
        let generationEnd = 0
        let errorStage: 'bullet_selection' | 'ai_selection' | 'wasm_load' | 'pdf_generation' = isAIMode ? 'ai_selection' : 'bullet_selection'

        try {
          // Step 1: Get curated bullets from server (AI or heuristic)
          const sessionId = sessionStorage.getItem('resumate_session') || crypto.randomUUID()
          sessionStorage.setItem('resumate_session', sessionId)

          let selectData: {
            selected: Array<{ bullet: { id: string; description: string }; companyId: string; positionId: string }>
            reasoning?: string
            jobTitle?: string | null
            salary?: { min?: number; max?: number; currency: string; period: string } | null
            metadata?: { provider: string; tokensUsed?: number; duration?: number }
          }

          if (isAIMode) {
            // AI Mode: Call AI selection endpoint
            setStatus('loading_wasm')
            setAiStage('analyzing')
            console.log(`🤖 AI Selection with ${currentProvider}...`)

            setAiStage('selecting')
            const aiResponse = await fetch('/api/resume/ai-select', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jobDescription: currentJobDescription,
                provider: currentProvider,
                turnstileToken: verifiedToken,
                email: email || undefined,
                linkedin: linkedin || undefined,
                sessionId,
              }),
            })

            setAiStage('validating')

            if (!aiResponse.ok) {
              const error = await aiResponse.json()
              // Check if it was a retry situation
              if (error.retriesAttempted && error.retriesAttempted > 0) {
                setAiRetryCount(error.retriesAttempted)
                setAiStage('retrying')
              }
              throw new Error(error.userMessage || error.message || 'AI selection failed')
            }

            selectData = await aiResponse.json()
            console.log(`✅ AI selected ${selectData.selected.length} bullets`)
          } else {
            // Heuristic Mode: Call existing selection endpoint
            setStatus('loading_wasm')

            const selectResponse = await fetch('/api/resume/select', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roleProfileId: selectedRoleId,
                turnstileToken: verifiedToken,
                email: email || undefined,
                linkedin: linkedin || undefined,
                sessionId,
              }),
            })

            if (!selectResponse.ok) {
              const error = await selectResponse.json()
              throw new Error(error.message || 'Failed to select bullets')
            }

            selectData = await selectResponse.json()
          }

          // Step 2: Load WASM module dynamically from public folder
          errorStage = 'wasm_load'
          wasmLoadStart = Date.now()
          const wasmCached = Boolean(window.__wasmReady)
          setStatus('generating')
          if (isAIMode) setAiStage('compiling')

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

          wasmLoadEnd = Date.now()
          errorStage = 'pdf_generation'
          generationStart = Date.now()

          // Step 3: Prepare generation payload
          // For AI mode, create synthetic role profile; for heuristic, use selected profile
          const roleProfile = isAIMode
            ? {
                id: 'ai-curated',
                name: selectData.jobTitle || 'AI-Curated Resume',
                description: 'AI-selected based on job description',
                tagWeights: {},
                scoringWeights: { tagRelevance: 0.5, priority: 0.5 },
              }
            : roleProfiles.find((r) => r.id === selectedRoleId)

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
          const isDevMode = process.env.NODE_ENV === 'development'

          console.log('🎨 Generating PDF with Typst...')
          const generatePdfTypst = window.__generatePdfTypst as (payload: string, devMode: boolean) => Uint8Array
          const pdfBytes = generatePdfTypst(JSON.stringify(payload), isDevMode)
          generationEnd = Date.now()
          console.log('✅ PDF generated successfully with Typst')

          // Calculate durations
          const wasmLoadDuration = wasmLoadEnd - wasmLoadStart
          const generationDuration = generationEnd - generationStart
          const totalDuration = Date.now() - startTime

          // Update AI stage to complete
          if (isAIMode) setAiStage('complete')

          // Track: WASM compilation complete (client-side for accurate timing)
          analytics.compiled({
            generation_method: isAIMode ? 'ai' : 'heuristic',
            role_profile_id: isAIMode ? undefined : selectedRoleId,
            ai_provider: isAIMode ? currentProvider : undefined,
            bullet_count: selectData.selected.length,
            wasm_load_ms: wasmLoadDuration,
            wasm_cached: wasmCached,
            generation_ms: generationDuration,
            pdf_size_bytes: pdfBytes.length,
            ai_response_ms: isAIMode ? selectData.metadata?.duration : undefined,
          })

          // Log generation success event
          await fetch('/api/resume/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'resume_generated',
              sessionId,
              roleProfileId: isAIMode ? 'ai-curated' : selectedRoleId,
              roleProfileName: roleProfile.name,
              bulletCount: selectData.selected.length,
              pdfSize: pdfBytes.length,
              wasmLoadDuration,
              generationDuration,
              totalDuration,
              wasmCached,
              ...(isAIMode && {
                generation_method: 'ai',
                ai_provider: currentProvider,
                job_title: selectData.jobTitle,
                reasoning: selectData.reasoning,
              }),
            }),
          }).catch(err => console.error('Failed to log generation:', err))

          // Step 5: Download the PDF
          const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url

          // Generate filename: {fullName}-{roleName}-{timestamp}.pdf
          const fullName = ((resumeData.personal.fullName as string | undefined) || 'resume').replace(/\s+/g, '-')
          const roleName = roleProfile.name.toLowerCase().replace(/\s+/g, '-').slice(0, 30) // Truncate for AI titles
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          link.download = `${fullName}-${roleName}-${timestamp}.pdf`

          link.click()
          URL.revokeObjectURL(url)

          // Track: Download triggered
          analytics.downloaded({
            generation_method: isAIMode ? 'ai' : 'heuristic',
            role_profile_id: isAIMode ? undefined : selectedRoleId,
            role_profile_name: isAIMode ? undefined : roleProfile.name,
            ai_provider: isAIMode ? currentProvider : undefined,
            job_title: isAIMode ? selectData.jobTitle : undefined,
            bullet_count: selectData.selected.length,
            total_duration_ms: Date.now() - flowStartRef.current,
          })

          // Log download event to server (triggers n8n notification)
          await fetch('/api/resume/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'resume_download_notified',
              sessionId,
              roleProfileId: isAIMode ? 'ai-curated' : selectedRoleId,
              roleProfileName: roleProfile.name,
              email: email || undefined,
              linkedin: linkedin || undefined,
              bulletCount: selectData.selected.length,
              bullets: selectData.selected,
              pdfSize: pdfBytes.length,
              filename: link.download,
              ...(isAIMode && {
                generation_method: 'ai',
                ai_provider: currentProvider,
                job_description: currentJobDescription,
                job_title: selectData.jobTitle,
                salary: selectData.salary,
                reasoning: selectData.reasoning,
              }),
            }),
          }).catch(err => console.error('Failed to log download:', err))

          // Wait briefly then close modal
          await new Promise(resolve => setTimeout(resolve, 500))

          // Close modal after download starts
          setTimeout(() => {
            setShowTurnstile(false)
            setVerifiedToken(null)
            setEmail('')
            setLinkedin('')
            setErrorMessage(null)
            setDownloadInitiated(false)
            setStatus('idle')
            setAiStage('idle')
            setAiRetryCount(0)
            flowStartRef.current = 0
          }, 1500)
        } catch (error) {
          console.error('Download error:', error)
          const errorMsg = error instanceof Error ? error.message : 'Download failed'
          setErrorMessage(errorMsg)
          setStatus('error')
          if (isAIMode) setAiStage('error')
          setDownloadInitiated(false)

          // Track: Error in download flow
          const analyticsStage = errorStage === 'bullet_selection' ? 'selection'
            : errorStage === 'pdf_generation' ? 'compilation'
            : errorStage
          analytics.error({
            generation_method: isAIMode ? 'ai' : 'heuristic',
            role_profile_id: isAIMode ? undefined : selectedRoleId,
            ai_provider: isAIMode ? currentProvider : undefined,
            error_stage: analyticsStage,
            error_message: errorMsg,
            duration_ms: Date.now() - flowStartRef.current,
          })

          // Log failure event
          const sessionId = sessionStorage.getItem('resumate_session')
          if (sessionId) {
            await fetch('/api/resume/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'resume_failed',
                sessionId,
                roleProfileId: isAIMode ? 'ai-curated' : selectedRoleId,
                roleProfileName: isAIMode ? 'AI-Curated' : (roleProfiles.find(r => r.id === selectedRoleId)?.name || 'Unknown'),
                email: email || undefined,
                linkedin: linkedin || undefined,
                errorMessage: errorMsg,
                errorStage,
                errorStack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
                ...(isAIMode && { generation_method: 'ai', ai_provider: currentProvider }),
              }),
            }).catch(err => console.error('Failed to log error:', err))
          }

          // Reset token on error - server already consumed it, user must re-verify
          setVerifiedToken(null)
          turnstileRef.current?.reset()
        }
      }, 300) // Short delay like vCard

      return () => {
        clearTimeout(timer)
      }
    }
  }, [verifiedToken, downloadInitiated, status, selectedRoleId, roleProfiles, resumeData, email, linkedin, analytics, jobDescription, aiProvider])

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
    <div className="space-y-5">
      {/* Friendly message */}
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
        I&apos;d love to know who&apos;s interested — contact info is optional
      </p>

      {/* Contact Info - Full Width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          disabled={isLoading}
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50"
        />
        <input
          type="url"
          id="linkedin"
          name="linkedin"
          autoComplete="url"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="LinkedIn profile (optional)"
          disabled={isLoading}
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50"
        />
      </div>

      {/* Two-Column Selection Layout - Equal Heights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Job Description (AI Mode) */}
        <div className="relative min-h-[180px]">
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              AI-Powered
            </span>
          </div>
          <div className={`h-full flex flex-col rounded-lg p-4 ${
            isJobDescriptionMode
              ? 'bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800'
              : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-600'
          }`}>
            <label htmlFor="job-description" className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
              AI-Powered Selection
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Paste your job description and AI intelligently selects the most relevant achievements from {totalExperiences}+ experiences
            </p>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value)
                if (e.target.value.trim()) setSelectedRoleId('')
                setErrorMessage(null)
              }}
              placeholder="Paste job description here (minimum 50 characters)..."
              disabled={isLoading || isDropdownMode}
              rows={3}
              autoComplete="off"
              name="job-description"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {/* Provider dropdown - only show when JD has content */}
            {isJobDescriptionMode && (
              <div className="mt-2">
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 appearance-none bg-[length:1.5rem] bg-[position:right_0.75rem_center] bg-no-repeat"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`
                  }}
                >
                  {FALLBACK_ORDER.map((provider) => (
                    <option key={provider} value={provider}>
                      {AI_MODELS[provider].label}
                      {AI_MODELS[provider].cost === 'free' ? ' ⚡' : ' ✨'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right: Role Profiles (Active) */}
        <div className="relative min-h-[180px]">
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              ✓ Available Now
            </span>
          </div>
          <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <label htmlFor="role-select" className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
              Role Profiles
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex-grow">
              Choose a role and Resumate&apos;s heuristic scoring algorithm instantly curates the most relevant achievements from my {totalExperiences}+ experiences
            </p>
            <select
              id="role-select"
              name="role-profile"
              autoComplete="off"
              value={selectedRoleId}
              onChange={(e) => {
                setSelectedRoleId(e.target.value)
                if (e.target.value) setJobDescription('')
                setErrorMessage(null)
              }}
              disabled={isLoading || isJobDescriptionMode}
              title={isJobDescriptionMode ? 'Clear job description to use role profiles' : 'Select a role profile'}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-[length:1.5rem] bg-[position:right_0.75rem_center] bg-no-repeat"
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
          </div>
        </div>
      </div>

      {/* Download Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleDownloadClick}
        disabled={(!selectedRoleId && !jobDescription.trim()) || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {getStatusMessage()}
          </>
        ) : (
          <>
            Download PDF
            <Download className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {/* Error Message */}
      {errorMessage && !showTurnstile && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 text-center">
            {errorMessage}
          </p>
        </div>
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

            {/* Simplified header - just verification */}
            {!verifiedToken && (
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Verify You&apos;re Human
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Complete verification to download your resume
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
                      // Reset for fresh Turnstile verification
                      setVerifiedToken(null)
                      turnstileRef.current?.reset()
                    }}
                    className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {verifiedToken || status === 'loading_wasm' || status === 'generating' ? (
              isJobDescriptionMode && aiStage !== 'idle' ? (
                // AI Mode: Show progress indicator
                <div className="py-4">
                  <AIProgressIndicator
                    stage={aiStage}
                    provider={aiProvider}
                    retryCount={aiRetryCount}
                    maxRetries={3}
                    error={aiStage === 'error' ? errorMessage || undefined : undefined}
                    className="border-slate-200 dark:border-slate-700"
                  />
                </div>
              ) : (
                // Heuristic Mode: Show simple spinner
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
              )
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
