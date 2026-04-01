import React from 'react';
import { X } from 'lucide-react';
import { useAuthStatus } from '../../contexts/AuthContext';

export const AccountSyncBanner: React.FC = () => {
  const { accountSyncNotice, dismissAccountSyncNotice } = useAuthStatus();
  if (!accountSyncNotice) return null;
  return (
    <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3">
        <span>{accountSyncNotice}</span>
        <button
          type="button"
          onClick={dismissAccountSyncNotice}
          className="rounded-lg p-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
