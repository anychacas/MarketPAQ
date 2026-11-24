import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { setToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useNoIndex } from '@/lib/useNoIndex';

function getStoredRef() {
  const code = localStorage.getItem('marketpaq_ref_code');
  const ts = parseInt(localStorage.getItem('marketpaq_ref_ts') || '0', 10);
  if (!code) return null;
  if (Date.now() - ts > 14 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem('marketpaq_ref_code');
    localStorage.removeItem('marketpaq_ref_ts');
    return null;
  }
  return code;
}

const ROLE_LABELS = {
  partner: 'Partner',
  developer: 'Developer',
  partner_leader: 'Partner Líder',
};

export default function Signup() {
  useNoIndex();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partnerCode, setPartnerCode] = useState(() => {
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    return urlRef || getStoredRef() || '';
  });
  const detectedRole = (() => {
    const r = new URLSearchParams(window.location.search).get('role');
    return ROLE_LABELS[r] || null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          partnerLeaderCode: partnerCode || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Error al crear la cuenta');

      setToken(data.access_token);
      localStorage.removeItem('marketpaq_ref_code');
      localStorage.removeItem('marketpaq_ref_ts');
      window.location.href = createPageUrl('VerifyEmail');
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
        </div>

        {/* Microcopy de valor */}
        <div className="mb-5 text-center">
          <p className="text-sm text-slate-600 leading-relaxed">
            Descubre add-ons, contacta developers y forma parte del ecosistema CONTPAQi y SoftRestaurant.
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Completamente gratis · Sin tarjeta requerida</p>
        </div>

        {/* Badge de rol detectado */}
        {detectedRole && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full">
              Estás creando una cuenta como <strong>{detectedRole}</strong>
            </span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Crear cuenta</h1>
          <p className="text-sm text-slate-500 mb-6">Gratis · Unos pasos rápidos: correo, contraseña y tu perfil.</p>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="confirm" className="text-sm font-medium text-slate-700">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">Código de invitación <span className="font-normal text-slate-400">(opcional)</span></Label>
              {partnerCode ? (
                <div className="mt-1 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-indigo-700 flex-1">Se detectó un código de invitación y se aplicará a tu registro: <strong>{partnerCode}</strong></span>
                  <button type="button" className="text-xs text-slate-400 hover:text-red-500"
                    onClick={() => setPartnerCode('')}>✕</button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Pega aquí el código (ej. ABC123)"
                    value={partnerCode}
                    onChange={e => setPartnerCode(e.target.value.trim())}
                    className="text-sm mt-1"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Si un Partner Líder te invitó, pega su código aquí. Si no tienes uno, puedes continuar normalmente.</p>
                </>
              )}
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
              Crear cuenta
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link to={createPageUrl('Login')} className="text-blue-600 hover:underline font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
