import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a concise console signal for production black-screen cases.
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message || 'Error desconocido';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-lg font-bold">La app falló al cargar</h1>
          <p className="mt-2 text-sm text-slate-300">
            Ocurrió un error de JavaScript y por eso ves pantalla negra. Abre DevTools → Console para ver el detalle.
          </p>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-xs text-slate-200">
            {message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

