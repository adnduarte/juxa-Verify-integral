import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type ThemeToggleProps = {
  className?: string;
  /** Tamaño del botón táctil */
  size?: 'sm' | 'md';
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const pad = size === 'sm' ? 'p-1.5' : 'p-2';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-100 dark:hover:bg-slate-700 ${pad} ${className}`}
      title={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      aria-label={isDark ? 'Activar modo día' : 'Activar modo noche'}
    >
      {isDark ? <Sun className={icon} aria-hidden /> : <Moon className={icon} aria-hidden />}
    </button>
  );
};
