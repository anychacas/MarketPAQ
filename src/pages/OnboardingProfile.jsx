import React, { useRef, useState, useEffect } from 'react';
import { api, getToken } from '@/api/client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNoIndex } from '@/lib/useNoIndex';

export default function OnboardingProfile() {
  useNoIndex();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [company, setCompany] = useState('');
  const [facebook, setFacebook] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const isAuth = await api.auth.isAuthenticated();
        if (!isAuth) { window.location.href = '/Login'; return; }
        const { data } = await api.functions.invoke('ensureExtendedUser');
        if (data?.success) {
          const u = data.user;
          setUser(u);
          setName(u.full_name || u.name || '');
          setWhatsapp(u.whatsapp || '');
          setCompany(u.company || '');
          setFacebook(u.facebook || '');
        }
      } catch (err) {
        console.error('[OnboardingProfile] load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const copyCode = () => {
    if (!user?.partnerLeaderCode) return;
    navigator.clipboard.writeText(user.partnerLeaderCode);
    setCodeCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getToken();

      // Upload avatar if selected
      let avatarUrl;
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const uploadResp = await fetch(`/api/v1/uploads/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (uploadResp.ok) {
          const uploadData = await uploadResp.json();
          avatarUrl = uploadData.url;
        }
      }

      // Save profile fields
      const body = {
        full_name: name || undefined,
        whatsapp: whatsapp || undefined,
        company: company || undefined,
        facebook: facebook || undefined,
        ...(avatarUrl ? { avatarUrl } : {}),
      };
      const saveResp = await fetch(`/api/v1/entities/User/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!saveResp.ok) {
        const errData = await saveResp.json().catch(() => ({}));
        throw new Error(errData.message || `Error al guardar (${saveResp.status})`);
      }

      toast.success('Perfil guardado');
      // Redirect based on role
      const dest = user?.userType === 'partner'
        ? createPageUrl('AddonsCatalog')
        : createPageUrl('Dashboard');
      setTimeout(() => { window.location.href = dest; }, 500);
    } catch (err) {
      console.error('[OnboardingProfile] save error', err);
      toast.error(err.message || 'Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isPartnerLeader = user?.userType === 'partner_leader';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Completa tu perfil</h1>
          <p className="text-slate-600">Esta información aparecerá en tu cuenta. Puedes actualizarla después.</p>
        </div>

        {/* Partner Líder — show their code */}
        {isPartnerLeader && user?.partnerLeaderCode && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">Tu código de Partner Líder</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono text-lg font-bold text-amber-800 bg-white border border-amber-200 rounded-lg px-4 py-2 tracking-widest">
                {user.partnerLeaderCode}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium transition-colors"
              >
                {codeCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {codeCopied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-2">
              Comparte este código con tus Partners para que se unan a tu red.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8 space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-slate-700">Nombre completo</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="whatsapp" className="text-sm font-medium text-slate-700">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+52 55 1234 5678"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="company" className="text-sm font-medium text-slate-700">Empresa</Label>
            <Input
              id="company"
              type="text"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nombre de tu empresa"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="facebook" className="text-sm font-medium text-slate-700">Sitio web o Facebook</Label>
            <Input
              id="facebook"
              type="text"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://tuweb.com o https://facebook.com/tu-pagina"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="avatar" className="text-sm font-medium text-slate-700">Foto de perfil</Label>
            <input
              ref={fileRef}
              id="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 h-11 mt-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Continuar
          </Button>

          <button
            type="button"
            onClick={() => {
              const dest = user?.userType === 'partner'
                ? createPageUrl('AddonsCatalog')
                : createPageUrl('Dashboard');
              window.location.href = dest;
            }}
            className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-1"
          >
            Omitir por ahora
          </button>
        </form>
      </div>
    </div>
  );
}
