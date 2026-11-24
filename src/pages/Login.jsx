import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { setToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useNoIndex } from '@/lib/useNoIndex';

export default function Login() {
  useNoIndex();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch(`/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Credenciales incorrectas');

      // Persist the session token (read by the API client on next load)
      setToken(data.access_token);

      const user = data.user;

      // Email must be verified before entering the app
      if (!user.emailVerified) {
        window.location.href = createPageUrl('VerifyEmail');
        return;
      }

      // Redirect based on onboarding state — full reload picks up new token
      if (!user.userType || user.userType === 'unset') {
        // No role selected yet → choose role
        window.location.href = createPageUrl('OnboardingRole');
      } else {
        // Any onboarded user (developer or distributor) → go to dashboard
        window.location.href = createPageUrl('Dashboard');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Iniciar sesión</h1>
          <p className="text-sm text-slate-500 mb-6">Accede a tu cuenta de MarketPaq</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-3">
          <Link to="/ResetPasswordRequest" className="text-slate-400 hover:text-blue-600 hover:underline text-xs">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <p className="text-center text-sm text-slate-500 mt-3">
          ¿No tienes cuenta?{' '}
          <Link to={createPageUrl('Signup')} className="text-blue-600 hover:underline font-medium">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
