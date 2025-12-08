'use client'

import { cn } from '@/lib/utils'
import type { AIProvider } from '@/lib/ai/providers/types'
import { AI_MODELS } from '@/lib/ai/providers/types'
import { Loader2, Check, AlertCircle, ChevronRight, Zap, RefreshCw } from 'lucide-react'

/**
 * AI Progress Indicator
 *
 * Compiler-style visual progress for AI resume generation.
 * Shows step-by-step progress through the AI selection pipeline.
 */

export type AIProgressStage =
  | 'idle'
  | 'verifying'     // Turnstile CAPTCHA
  | 'analyzing'     // AI reading job description
  | 'selecting'     // AI choosing bullets
  | 'validating'    // Parsing AI response
  | 'retrying'      // If validation failed
  | 'compiling'     // WASM PDF generation
  | 'complete'
  | 'error'

interface AIProgressIndicatorProps {
  stage: AIProgressStage
  provider: AIProvider
  retryCount?: number
  maxRetries?: number
  error?: string
  className?: string
}

interface StepConfig {
  id: string
  label: string
  activeLabel?: string
}

const STEPS: StepConfig[] = [
  { id: 'verifying', label: 'Verify identity', activeLabel: 'Verifying identity...' },
  { id: 'analyzing', label: 'Analyze job description', activeLabel: 'Analyzing job description...' },
  { id: 'selecting', label: 'Select relevant experience', activeLabel: 'Selecting relevant experience...' },
  { id: 'validating', label: 'Validate selection', activeLabel: 'Validating selection...' },
  { id: 'compiling', label: 'Compile PDF', activeLabel: 'Compiling PDF...' },
]

// Map stage to step index for progress calculation
function getStepIndex(stage: AIProgressStage): number {
  const mapping: Record<AIProgressStage, number> = {
    idle: -1,
    verifying: 0,
    analyzing: 1,
    selecting: 2,
    validating: 3,
    retrying: 3, // Same as validating
    compiling: 4,
    complete: 5,
    error: -1,
  }
  return mapping[stage]
}

function StepIcon({
  status,
  isRetrying,
}: {
  status: 'pending' | 'active' | 'complete'
  isRetrying?: boolean
}) {
  if (isRetrying) {
    return (
      <RefreshCw className="h-4 w-4 text-amber-500 dark:text-amber-400 animate-spin" />
    )
  }

  switch (status) {
    case 'complete':
      return (
        <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
      )
    case 'active':
      return (
        <Loader2 className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-spin" />
      )
    default:
      return (
        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      )
  }
}

export function AIProgressIndicator({
  stage,
  provider,
  retryCount = 0,
  maxRetries = 3,
  error,
  className,
}: AIProgressIndicatorProps) {
  const currentStepIndex = getStepIndex(stage)
  const modelConfig = AI_MODELS[provider]
  const isRetrying = stage === 'retrying'
  const isError = stage === 'error'
  const isComplete = stage === 'complete'

  return (
    <div className={cn('rounded-lg border overflow-hidden', className)}>
      {/* Header - Provider info */}
      <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
              {modelConfig.label}
            </span>
          </div>
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded',
              modelConfig.cost === 'free'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            )}
          >
            {modelConfig.cost === 'free' ? 'Free' : 'Premium'}
          </span>
        </div>
      </div>

      {/* Progress steps */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3">
        <div className="space-y-2">
          {STEPS.map((step, index) => {
            const status =
              index < currentStepIndex
                ? 'complete'
                : index === currentStepIndex
                  ? 'active'
                  : 'pending'

            const isCurrentRetrying = isRetrying && step.id === 'validating'
            const label =
              status === 'active' || isCurrentRetrying
                ? step.activeLabel || step.label
                : step.label

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 font-mono text-sm transition-colors',
                  status === 'complete' && 'text-green-600 dark:text-green-400',
                  status === 'active' && !isCurrentRetrying && 'text-blue-600 dark:text-blue-400',
                  isCurrentRetrying && 'text-amber-600 dark:text-amber-400',
                  status === 'pending' && 'text-slate-400 dark:text-slate-500'
                )}
              >
                <StepIcon status={status} isRetrying={isCurrentRetrying} />
                <span>{label}</span>
                {isCurrentRetrying && retryCount > 0 && (
                  <span className="text-xs text-amber-500 dark:text-amber-400">
                    (retry {retryCount}/{maxRetries})
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Complete state */}
        {isComplete && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-mono text-sm">
              <Check className="h-4 w-4" />
              <span>Download ready!</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && error && (
          <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="font-mono text-sm">
                <p className="font-medium">Selection failed</p>
                <p className="text-xs mt-1 text-red-500 dark:text-red-400/80">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
