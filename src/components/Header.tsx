import type { Candidate } from '../types'

interface HeaderProps {
  candidate: Candidate | null
  onHome: () => void
}

export function Header({ candidate, onHome }: HeaderProps) {
  return (
    <header className="border-b border-ink-300/30 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-3 rounded-lg text-left transition hover:opacity-90"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-serif text-2xl font-bold text-white shadow-sm">
            Q
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-lg font-bold leading-tight text-brand-900">
              齐齐哈尔大学
              <span className="ml-2 font-sans text-sm font-bold tracking-tight text-ink-900">
                Qiqihar University
              </span>
            </span>
            <span className="block truncate text-xs font-medium tracking-wide text-ink-500">
              Qiqihar University Test Portal · 2026 Intake
            </span>
          </span>
        </button>

        {candidate && (
          <div className="hidden items-center gap-2 rounded-full border border-ink-300/40 bg-paper px-3 py-1.5 sm:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {candidate.name.trim().charAt(0).toUpperCase() || 'C'}
            </span>
            <span className="text-xs font-semibold text-ink-700">{candidate.name}</span>
          </div>
        )}
      </div>
    </header>
  )
}