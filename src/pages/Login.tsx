import React, { useEffect, useState } from 'react';
import { useAuthStatus } from '../contexts/AuthContext';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Phone, ShieldCheck } from 'lucide-react';
import { AuthChrome } from '../components/auth/AuthChrome';
import { brandClasses } from '../config/brand';
import { Button } from '../components/ui/Button';
import { isDemoQuickLoginEnabled } from '../config/staging';
import type { Role } from '../contexts/AuthContext';
import { LOGIN_LOONG_MOTOR_URL } from '../config/loongLinks';

/** Evita mandar vendedores Loong (CLIENTE) a /admin tras login → antes caían en /unauthorized. */
function postLoginPath(fromPath: unknown, role: Role): string {
  const fallback = '/dashboard';
  if (role === 'ANALISTA_MESA_CONTROL') {
    if (typeof fromPath === 'string' && fromPath.startsWith('/')) {
      const isAdminPath = fromPath === '/admin' || fromPath.startsWith('/admin/');
      if (isAdminPath) return fromPath;
    }
    return '/admin?tab=mesa-origen';
  }
  if (typeof fromPath !== 'string' || !fromPath.startsWith('/')) return fallback;
  const isAdminPath = fromPath === '/admin' || fromPath.startsWith('/admin/');
  if (!isAdminPath) return fromPath;
  if (role === 'ADMIN' || role === 'SUPERVISOR') return fromPath;
  return fallback;
}

export const Login: React.FC<{
  mode?: 'default' | 'loong';
  title?: string;
  subtitle?: string;
  /** If false, hides sign-up toggle and blocks register flow. */
  allowRegister?: boolean;
}> = ({ mode = 'default', title, subtitle, allowRegister = true }) => {
  const { user, role, login, loginWithEmail, registerWithEmail, resetPassword, loading } = useAuthStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromStatePath = location.state?.from?.pathname;
  const showDemoPanel = isDemoQuickLoginEnabled();

  const [isLogin, setIsLogin] = useState(mode === 'loong' ? true : true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'loong') {
      setIsLogin(true);
    }
  }, [mode]);

  // Backwards compatibility: old Loong URL was /login?loong=1
  useEffect(() => {
    const wantsLoong = searchParams.get('loong') === '1';
    if (wantsLoong) {
      navigate(LOGIN_LOONG_MOTOR_URL, { replace: true });
    }
  }, [navigate, searchParams, mode]);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${brandClasses.pageBg}`}>
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500"
          aria-label="Cargando"
        />
      </div>
    );
  }

  if (user) {
    const target = postLoginPath(fromStatePath, role);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (isLogin) {
        if (loginWithEmail) {
          await loginWithEmail(email, password);
        } else {
          setError('El inicio de sesión con correo no está configurado.');
        }
      } else {
        if (mode === 'loong' || !allowRegister) {
          setError('El registro no está disponible en el acceso Loong. Solicita a tu administrador que te dé de alta.');
          return;
        }
        if (registerWithEmail) {
          await registerWithEmail(email, password, phone);
        } else {
          setError('El registro con correo no está configurado.');
        }
      }
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      console.error(err);
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Correo o contraseña incorrectos.');
      } else if (code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else if (code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(err instanceof Error ? err.message : 'Ocurrió un error. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-white/[0.08] bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none ring-amber-500/0 transition focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/25';

  return (
    <AuthChrome showStagingBadge={showDemoPanel}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className={`rounded-2xl p-6 sm:p-8 ${brandClasses.card}`}>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title || 'Acceso al panel'}</h1>
            <p className={`mt-2 text-sm ${brandClasses.muted}`}>
              {subtitle
                ? subtitle
                : mode === 'loong'
                  ? 'Acceso exclusivo para Loong Motor (sin registro abierto)'
                  : isLogin
                    ? 'Inicia sesión para continuar'
                    : 'Crea una cuenta para comenzar'}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-slate-300">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="tu@empresa.com"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="text-xs font-medium text-slate-300">
                  Contraseña
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        setError('Ingresa tu correo para recuperar la contraseña.');
                        return;
                      }
                      try {
                        if (resetPassword) {
                          await resetPassword(email);
                          setSuccess('Revisa tu bandeja: te enviamos un enlace para restablecer la contraseña.');
                          setError('');
                        }
                      } catch (err: unknown) {
                        setError(
                          'Error al enviar el correo: ' +
                            (err instanceof Error ? err.message : 'intenta de nuevo.')
                        );
                      }
                    }}
                    className="text-xs font-medium text-amber-400/90 hover:text-amber-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && mode !== 'loong' && allowRegister && (
              <div>
                <label htmlFor="login-phone" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Teléfono (opcional)
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <input
                    id="login-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="55 1234 5678"
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full justify-center py-3">
              {isSubmitting ? 'Procesando…' : isLogin ? 'Entrar al sistema' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900/90 px-3 text-slate-500 dark:text-slate-400">o continúa con</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setError('');
              setSuccess('');
              setIsSubmitting(true);
              try {
                await login();
              } catch (err: unknown) {
                console.error('Google login error:', err);
                const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
                if (code === 'auth/popup-closed-by-user') {
                  setError('La ventana de inicio de sesión se cerró antes de completar el proceso.');
                } else if (code === 'auth/popup-blocked') {
                  setError('Permite ventanas emergentes para este sitio e inténtalo de nuevo.');
                } else {
                  setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google.');
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white dark:bg-slate-900/[0.04] py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Google
          </button>

          {mode !== 'loong' && allowRegister ? (
            <p className="mt-6 text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="block w-full text-sm font-medium text-[var(--color-juxa-accent)] hover:opacity-90 dark:text-indigo-300"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </AuthChrome>
  );
};
