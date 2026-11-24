import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ResetPasswordRequest() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch(`/api/v1/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || 'Error al procesar la solicitud');
      }
      setSent(true);
    } catch (err) {
      setError('No pudimos procesar tu solicitud, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Restablecer contraseña</h1>
          <p className="text-sm text-slate-500 mb-6">
            Te enviaremos un enlace para crear una nueva contraseña.
          </p>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-sm text-slate-700 leading-relaxed">
                Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Correo electrónico
                </Label>
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

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 h-11"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enviar enlace de restablecimiento
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link to="/Login" className="text-blue-600 hover:underline font-medium">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
