import React, { useState, useEffect, useCallback } from 'react';
import { createPageUrl } from '@/utils';
import { getToken, clearToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Loader2, MailCheck, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useNoIndex } from '@/lib/useNoIndex';

function logout() {
  clearToken();
  window.location.href = '/Login';
}

export default function VerifyEmail() {
  useNoIndex();
  const [userEmail, setUserEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  // 'generic' | 'smtp_fail' | null — tracks error category for richer messaging
  const [errorKind, setErrorKind] = useState(null);
  const [success, setSuccess] = useState(false);

  // Countdown for resend button (60 s)
  const [countdown, setCountdown] = useState(0);

  // Load current user to get email
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/v1/entities/User/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.email) setUserEmail(data.email);
        if (data?.emailVerified) {
          // Already verified — send to normal flow
          window.location.href = createPageUrl('AddonsCatalog');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleVerify = useCallback(async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setErrorKind(null);
    setSubmitting(true);

    const token = getToken();
    try {
      const res = await fetch('/api/v1/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Error al verificar el código');
        setErrorKind('generic');
        return;
      }
      setSuccess(true);
      // Redirect after brief pause so user sees success message
      setTimeout(() => { window.location.href = createPageUrl('OnboardingRole'); }, 1200);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setErrorKind('generic');
    } finally {
      setSubmitting(false);
    }
  }, [code, submitting]);

  const handleResend = useCallback(async () => {
    if (resending || countdown > 0) return;
    setError(null);
    setErrorKind(null);
    setResending(true);

    const token = getToken();
    try {
      const res = await fetch('/api/v1/auth/verify-email/resend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EMAIL_SEND_FAILED') {
          // SMTP failure: email was not sent; the server updated lastSentAt so the
          // rate limit is in effect — show countdown so the user knows when to retry.
          setCountdown(data.retryAfter ?? 60);
          setError(
            'No pudimos enviar el correo. Revisa que tu dirección sea correcta o intenta de nuevo en un minuto.',
          );
          setErrorKind('smtp_fail');
        } else {
          // RATE_LIMITED or other error
          const retryAfter = data.retryAfter ?? 0;
          if (retryAfter > 0) setCountdown(retryAfter);
          setError(data.message ?? 'Error al reenviar el código');
          setErrorKind('generic');
        }
        return;
      }
      setCountdown(60);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setErrorKind('generic');
    } finally {
      setResending(false);
    }
  }, [resending, countdown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isLoggedIn = Boolean(getToken());

  // Not logged in — show prompt to login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center mb-8">
            <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
            <MailCheck className="w-10 h-10 text-blue-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Verificación de correo</h1>
            <p className="text-sm text-slate-500 mb-6">
              Debes iniciar sesión para verificar tu correo electrónico.
            </p>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => { window.location.href = '/Login'; }}
            >
              Iniciar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-blue-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">
            Verifica tu correo
          </h1>
          {userEmail && (
            <p className="text-sm text-slate-500 text-center mb-1">
              Te enviamos un código de 6 dígitos a{' '}
              <span className="font-medium text-slate-700">{userEmail}</span>
            </p>
          )}
          <p className="text-xs text-slate-400 text-center mb-6">
            Si no llega en 2–3 minutos, revisa tu carpeta de spam o usa el botón "Reenviar código".
          </p>

          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <MailCheck className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-green-700">¡Correo verificado!</p>
              <p className="text-sm text-slate-500 mt-1">Redirigiendo…</p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código de verificación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                  errorKind === 'smtp_fail'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-600'
                }`}>
                  {errorKind === 'smtp_fail' && (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 h-11"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verificar
              </Button>
            </form>
          )}

          {!success && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || countdown > 0}
                className="text-sm text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline inline-flex items-center gap-1.5"
              >
                {resending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {countdown > 0
                  ? `Reenviar en ${countdown}s`
                  : 'Reenviar código'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿Te equivocaste de correo?{' '}
          <button
            type="button"
            onClick={logout}
            className="text-slate-500 hover:text-red-500 inline-flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión y crear cuenta nueva
          </button>
        </p>

        <div className="text-center mt-2">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-slate-400 hover:text-red-500 inline-flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
