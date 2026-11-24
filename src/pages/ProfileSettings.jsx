import React, { useEffect, useRef, useState } from 'react';
import { createPageUrl } from '@/utils';
import { api, getToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, UserCircle, Lock } from 'lucide-react';

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  // Change-password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [company, setCompany] = useState('');
  const [facebook, setFacebook] = useState('');
  const [developerHandle, setDeveloperHandle] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        window.location.href = '/Login';
        return;
      }
      const u = await api.auth.me();
      if (!u) {
        window.location.href = '/Login';
        return;
      }
      setUser(u);
      setFullName(u.full_name || '');
      setWhatsapp(u.whatsapp || '');
      setCompany(u.company || '');
      setFacebook(u.facebook || '');
      setDeveloperHandle(u.developerHandle || '');
      setLoading(false);
    }
    load();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (developerHandle && !/^[a-z0-9-]{2,30}$/.test(developerHandle)) {
      setError('El nombre de perfil solo puede tener minúsculas, números y guiones (2–30 caracteres)');
      return;
    }
    if (avatarFile) {
      const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
      if (!ALLOWED.includes(avatarFile.type)) {
        setError('Solo se permiten imágenes jpeg, png o webp');
        return;
      }
      if (avatarFile.size > 1 * 1024 * 1024) {
        setError('La imagen debe ser menor a 1 MB');
        return;
      }
    }

    setSaving(true);
    try {
      const token = getToken();
      let avatarUrl;

      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const uploadResp = await fetch(`/api/v1/uploads/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const uploadData = await uploadResp.json();
        if (!uploadResp.ok) throw new Error(uploadData.message || 'Error al subir imagen');
        avatarUrl = uploadData.url;
      }

      const payload = {
        full_name: fullName || null,
        whatsapp: whatsapp || null,
        company: company || null,
        facebook: facebook || null,
        developerHandle: developerHandle || null,
      };
      if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;

      const resp = await fetch(`/api/v1/entities/User/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 409) throw new Error('Ese nombre de perfil ya está en uso, elige otro');
        throw new Error(data.message || 'Error al guardar');
      }

      setSuccess(true);
      setTimeout(() => {
        const userType = data.userType ?? user?.userType;
        window.location.href = userType === 'developer'
          ? createPageUrl('Dashboard')
          : createPageUrl('AddonsCatalog');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPassword.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.');
      return;
    }

    setPwSaving(true);
    try {
      const token = getToken();
      const resp = await fetch(`/api/v1/functions/changePassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (data?.error === 'INVALID_CURRENT_PASSWORD') {
          throw new Error('La contraseña actual no es correcta.');
        }
        throw new Error('No se pudo actualizar la contraseña, intenta de nuevo.');
      }

      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message || 'No se pudo actualizar la contraseña, intenta de nuevo.');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentAvatar = avatarPreview ?? user?.avatarUrl;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Editar perfil</h1>
          <p className="text-sm text-slate-500 mb-6">{user?.email}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="avatar" className="text-sm font-medium text-slate-700">Foto de perfil</Label>
                <input
                  ref={fileRef}
                  id="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-slate-400 mt-0.5">jpeg, png o webp · max 1 MB</p>
              </div>
            </div>

            <div>
              <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Nombre completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
              <p className="text-xs text-slate-400 mt-1">Comparte tu sitio web. Si no tienes, pega tu página de Facebook.</p>
            </div>

            <div>
              <Label htmlFor="developerHandle" className="text-sm font-medium text-slate-700">Enlace de tu perfil</Label>
              <Input
                id="developerHandle"
                type="text"
                value={developerHandle}
                onChange={(e) => setDeveloperHandle(e.target.value.toLowerCase())}
                placeholder="tu-nombre"
                className="mt-1"
              />
              <p className="text-xs text-slate-400 mt-1">Solo letras, números y guiones (2–30 caracteres).</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4" />
                <span>Perfil guardado</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 h-11"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8 mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-slate-500" />
            <h2 className="text-xl font-bold text-slate-900">Cambiar contraseña</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">Mínimo 8 caracteres.</p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="text-sm font-medium text-slate-700">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">Nueva contraseña</Label>
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
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirmar nueva contraseña</Label>
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

            {pwError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4" />
                <span>Contraseña actualizada correctamente</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={pwSaving}
              variant="outline"
              className="w-full h-11"
            >
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Actualizar contraseña
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
