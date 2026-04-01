import { useEffect } from 'react';

/**
 * Alinea tokens CSS con el tenant: Loong Motor usa data-tenant="loong" en <html> (acento esmeralda).
 */
export function useShellTenant(clientProfile: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (clientProfile === 'LOONG_MOTOR') {
      root.dataset.tenant = 'loong';
    } else {
      delete root.dataset.tenant;
    }
    return () => {
      delete root.dataset.tenant;
    };
  }, [clientProfile]);
}
