"use client";

/**
 * Resume download form panel: contact inputs + AI/role selection columns.
 *
 * Pure presentational — all state comes from the parent `ResumeDownload`
 * component via props. Extracted to keep the orchestrator small.
 *
 * @module components/data/resume-download/SelectionPanel
 */

import type { RoleProfile } from "@/types/resume";
import {
  AI_MODELS,
  FALLBACK_ORDER,
  type AIProvider,
  type ModelAvailability,
} from "@/lib/ai/providers/types";

interface SelectionPanelProps {
  roleProfiles: readonly RoleProfile[];
  totalExperiences: number;
  email: string;
  setEmail: (value: string) => void;
  linkedin: string;
  setLinkedin: (value: string) => void;
  jobDescription: string;
  setJobDescription: (value: string) => void;
  selectedRoleId: string;
  setSelectedRoleId: (value: string) => void;
  aiProvider: AIProvider;
  setAiProvider: (value: AIProvider) => void;
  modelAvailability: Map<AIProvider, ModelAvailability>;
  isLoading: boolean;
  isJobDescriptionMode: boolean;
  isDropdownMode: boolean;
  onErrorMessageClear: () => void;
}

const SELECT_BG_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
};

/**
 * Renders the two-column selection UI (AI-powered job description on the
 * left, role-profile dropdown on the right) plus the optional contact-info
 * inputs above them.
 */
export function SelectionPanel(props: SelectionPanelProps) {
  const {
    roleProfiles,
    totalExperiences,
    email,
    setEmail,
    linkedin,
    setLinkedin,
    jobDescription,
    setJobDescription,
    selectedRoleId,
    setSelectedRoleId,
    aiProvider,
    setAiProvider,
    modelAvailability,
    isLoading,
    isJobDescriptionMode,
    isDropdownMode,
    onErrorMessageClear,
  } = props;

  return (
    <>
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
          <div
            className={`h-full flex flex-col rounded-lg p-4 ${
              isJobDescriptionMode
                ? "bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800"
                : "bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-600"
            }`}
          >
            <label
              htmlFor="job-description"
              className="block font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              AI-Powered Selection
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Paste your job description and AI intelligently selects the most relevant achievements
              from {totalExperiences}+ experiences
            </p>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value);
                if (e.target.value.trim()) setSelectedRoleId("");
                onErrorMessageClear();
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
                  style={SELECT_BG_STYLE}
                >
                  {[...FALLBACK_ORDER]
                    .sort((a, b) => {
                      const aAvail =
                        modelAvailability.size === 0 ||
                        modelAvailability.get(a)?.available !== false;
                      const bAvail =
                        modelAvailability.size === 0 ||
                        modelAvailability.get(b)?.available !== false;
                      if (aAvail !== bAvail) return aAvail ? -1 : 1;
                      return AI_MODELS[a].label.localeCompare(AI_MODELS[b].label);
                    })
                    .map((provider) => {
                      const availability = modelAvailability.get(provider);
                      const unavailable = availability && !availability.available;
                      return (
                        <option key={provider} value={provider} disabled={!!unavailable}>
                          {AI_MODELS[provider].label}
                          {AI_MODELS[provider].cost === "free" ? " ⚡" : " ✨"}
                          {unavailable && availability.reason ? ` (${availability.reason})` : ""}
                        </option>
                      );
                    })}
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
            <label
              htmlFor="role-select"
              className="block font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Role Profiles
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex-grow">
              Choose a role and Resumate&apos;s heuristic scoring algorithm instantly curates the
              most relevant achievements from my {totalExperiences}+ experiences
            </p>
            <select
              id="role-select"
              name="role-profile"
              autoComplete="off"
              value={selectedRoleId}
              onChange={(e) => {
                setSelectedRoleId(e.target.value);
                if (e.target.value) setJobDescription("");
                onErrorMessageClear();
              }}
              disabled={isLoading || isJobDescriptionMode}
              title={
                isJobDescriptionMode
                  ? "Clear job description to use role profiles"
                  : "Select a role profile"
              }
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-[length:1.5rem] bg-[position:right_0.75rem_center] bg-no-repeat"
              style={SELECT_BG_STYLE}
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
    </>
  );
}
