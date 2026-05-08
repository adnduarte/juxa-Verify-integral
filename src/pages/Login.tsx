import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStatus } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, AlertCircle, Phone, FlaskConical, LogIn } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { DEV_LOCAL_PERSONAS, DEV_LOCAL_PASSWORD } from '../lib/devLocalBootstrap';

export const Login: React.FC = () => {
  const { user, login, loginWithEmail, registerWithEmail, resetPassword, loading } = useAuthStatus();
  const { branding } = useTenant();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayName = branding.appName?.trim() || 'Juxa Verify';
  const primary = branding.primaryColor?.trim() || '#2563eb';

  useEffect(() => {
    document.title = `${displayName} · Acceso`;
  }, [displayName]);

  const quickLogin = useCallback(
    async (targetEmail: string) => {
      setError('');
      setSuccess('');
      setEmail(targetEmail);
      setPassword(DEV_LOCAL_PASSWORD);
      setIsSubmitting(true);
      try {
        if (loginWithEmail) {
          await loginWithEmail(targetEmail, DEV_LOCAL_PASSWORD);
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
          setError('Credencial dev inválida. Verifica el correo o reinicia la app para volver a sembrar el modo local.');
        } else {
          setError(e.message || 'Error al entrar.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginWithEmail]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
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
        if (registerWithEmail) {
          await registerWithEmail(email, password, phone);
          // Optional: Show a success message or redirect
        } else {
          setError('El registro con correo no está configurado.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Error de conexión con Firebase. Por favor, verifica tu conexión a internet o si hay algún bloqueador de red/VPN activo. También asegúrate de que la configuración de Firebase sea correcta.');
      } else {
        setError(err.message || 'Ocurrió un error. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 gap-8">
      {import.meta.env.DEV && (
        <div className="max-w-3xl w-full rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-amber-900">
              <FlaskConical className="w-5 h-5 shrink-0" />
              <span className="font-bold text-sm">Modo desarrollo local</span>
            </div>
          </div>
          <p className="text-xs text-amber-900/90 mb-3">
            Datos y sesión <strong>en memoria local</strong> (sin Firebase). Las personas y organizaciones demo se
            siembran automáticamente al cargar la app. Contraseña común:{' '}
            <strong>{DEV_LOCAL_PASSWORD}</strong>. Para conectar a Firebase real, define{' '}
            <code className="bg-white/80 px-1 rounded">VITE_USE_FIREBASE=true</code> en <code>.env.local</code>.
          </p>
          <p className="text-[10px] text-amber-800/80 mb-2">Entrar como:</p>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {DEV_LOCAL_PERSONAS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => quickLogin(p.email)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                title={p.email}
              >
                <LogIn className="w-3 h-3 shrink-0" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div
            className="mx-auto w-12 h-12 text-white flex items-center justify-center rounded-xl font-bold shadow-sm mb-4"
            style={{ backgroundColor: primary }}
          >
            JX
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">{displayName}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {isLogin ? 'Inicia sesión para acceder a tu panel de control' : 'Crea una cuenta para comenzar'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-start">
            <ShieldCheck className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        setError('Por favor, ingresa tu correo electrónico primero.');
                        return;
                      }
                      try {
                        if (resetPassword) {
                          await resetPassword(email);
                          setSuccess('Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
                          setError('');
                        }
                      } catch (err: any) {
                        setError('Error al enviar el correo de recuperación: ' + err.message);
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-500"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (Opcional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="55 1234 5678"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: primary }}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white hover:opacity-92 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">O continúa con</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={async () => {
                setError('');
                setSuccess('');
                setIsSubmitting(true);
                try {
                  await login();
                } catch (err: any) {
                  console.error("Google login error:", err);
                  if (err.code === 'auth/popup-closed-by-user') {
                    setError('La ventana de inicio de sesión se cerró antes de completar el proceso. Por favor, asegúrate de no cerrarla y de permitir ventanas emergentes en tu navegador.');
                  } else if (err.code === 'auth/popup-blocked') {
                    setError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
                  } else {
                    setError(err.message || 'Error al iniciar sesión con Google. Por favor, inténtalo de nuevo.');
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              type="button"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 rounded-xl shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
              {isSubmitting ? 'Iniciando...' : 'Google'}
            </button>
          </div>
        </div>

        <div className="mt-4 text-center space-y-2">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors block w-full"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
          
          <button
            onClick={async () => {
              setError('Verificando conexión...');
              try {
                const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebaseConfig.apiKey, {
                  method: 'POST',
                  body: JSON.stringify({ email: 'test@example.com', password: 'test', returnSecureToken: true })
                });
                if (response.ok || response.status === 400) { // 400 is fine, it means we reached the server but credentials were wrong
                  setSuccess('✅ Conexión con Firebase Auth establecida correctamente.');
                  setError('');
                } else {
                  setError(`❌ Error de red: El servidor respondió con estatus ${response.status}.`);
                }
              } catch (e: any) {
                setError(`❌ Error de conexión: No se pudo contactar con los servidores de Firebase. Verifica si tienes un bloqueador de anuncios o firewall que bloquee 'googleapis.com'. Detalle: ${e.message}`);
              }
            }}
            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            ¿Problemas de conexión? Verificar estado de Firebase
          </button>
        </div>
      </div>
    </div>
  );
};
