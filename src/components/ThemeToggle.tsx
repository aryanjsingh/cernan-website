import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

  function selectTheme(value: 'light' | 'dark') {
    document.documentElement.dataset.theme = value
    setTheme(value)
    try { localStorage.setItem('cernan-theme', value) } catch { /* Theme still works when storage is unavailable. */ }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button type="button" aria-label="Light mode" title="Light mode" aria-pressed={theme === 'light'} onClick={() => selectTheme('light')}><Sun size={13} strokeWidth={1.5} /></button>
      <button type="button" aria-label="Dark mode" title="Dark mode" aria-pressed={theme === 'dark'} onClick={() => selectTheme('dark')}><Moon size={13} strokeWidth={1.5} /></button>
    </div>
  )
}
