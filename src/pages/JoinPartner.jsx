import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function JoinPartner() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'valid' | 'invalid'
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    async function lookup() {
      try {
        const res = await fetch(
          `/api/v1/functions/lookupPartnerLeader?code=${encodeURIComponent(code)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.leader) {
            const name =
              json.leader.full_name ||
              json.leader.name ||
              json.leader.handle ||
              json.leader.email ||
              'Partner Líder';
            setLeaderName(name);
            setStatus('valid');
            return;
          }
        }
        setStatus('invalid');
      } catch {
        setStatus('invalid');
      }
    }
    lookup();
  }, [code]);

  const handleJoin = () => {
    localStorage.setItem('marketpaq_ref_code', code);
    localStorage.setItem('marketpaq_ref_ts', String(Date.now()));
    navigate('/Signup');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500">Verificando código de invitación…</p>
            </div>
          )}

          {status === 'valid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">¡Fuiste invitado!</h1>
              <p className="text-sm text-slate-600 mb-1">
                <strong>{leaderName}</strong> te invita a unirte a MarketPAQ.
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Código: <span className="font-mono text-indigo-600">{code}</span>
              </p>
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-left mb-6">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>MarketPAQ</strong> es el marketplace de add-ons para CONTPAQi y SoftRestaurant.
                  Al unirte, accederás al catálogo especializado y formarás parte de la red de <strong>{leaderName}</strong>.
                </p>
              </div>
              <Button
                onClick={handleJoin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
              >
                Crear cuenta gratis
              </Button>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">❌</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Código inválido o expirado</h1>
              <p className="text-sm text-slate-500 mb-6">
                El enlace de invitación no es válido. Puedes crear tu cuenta en MarketPAQ de todas formas, sin código de referido.
              </p>
              <Button
                onClick={() => navigate('/Signup')}
                className="w-full bg-blue-600 hover:bg-blue-700 h-11"
              >
                Crear cuenta gratis
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
