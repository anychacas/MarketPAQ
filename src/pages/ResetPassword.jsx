import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-slate-700 mb-4">El enlace de restablecimiento no es válido o ha expirado.</p>
          <Link to="/Login" className="text-blue-600 hover:underline font-medium text-sm">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (data.error === 'INVALID_OR_EXPIRED_TOKEN') {
          throw new Error('INVALID_OR_EXPIRED_TOKEN');
        }
        throw new Error('SERVER_ERROR');
      }
      setDone(true);
    } catch (err) {
      if (err.message === 'INVALID_OR_EXPIRED_TOKEN') {
        setError('El enlace de restablecimiento no es válido o ha expirado.');
      } else {
        setError('Ocurrió un error, intenta de nuevo.');
      }
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
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Nueva contraseña</h1>
          <p className="text-sm text-slate-500 mb-6">Elige una contraseña segura de al menos 8 caracteres.</p>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-sm text-slate-700 leading-relaxed">
                Tu contraseña se ha actualizado correctamente. Ahora puedes iniciar sesión.
              </p>
              <Link to="/Login">
                <Button className="bg-blue-600 hover:bg-blue-700 mt-2">Ir a iniciar sesión</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
                  Nueva contraseña
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
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
                Restablecer contraseña
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
