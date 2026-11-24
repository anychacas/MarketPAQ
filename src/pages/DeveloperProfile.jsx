import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { api, getToken } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, ImagePlus, X } from "lucide-react";
import { sanitizeWhatsApp } from '@/components/helpers';

export default function DeveloperProfile() {
  return (
    <AuthGuard requiredRoles={['developer', 'admin']}>
      <ProfileForm />
    </AuthGuard>
  );
}

function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [user, setUser] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [showCompleteMsg, setShowCompleteMsg] = useState(false);
  const logoFileRef = useRef(null);
  const [form, setForm] = useState({
    displayName: '',
    supportEmail: '',
    whatsapp: '',
    website: '',
    contpaqi: false,
    softrestaurant: false,
    bio: '',
    logoUrl: '',
    location: '',
    services: '',
    responseTime: ''
  });

  useEffect(() => {
    async function load() {
      const urlParams = new URLSearchParams(window.location.search);
      const msg = urlParams.get('msg');
      if (msg === 'complete') {
        setShowCompleteMsg(true);
      }
      
      const u = await api.auth.me();
      setUser(u);
      const profiles = await api.entities.DeveloperProfiles.filter({ userId: u.id });
      if (profiles.length > 0) {
        const p = profiles[0];
        setProfileId(p.id);
        setForm({
          displayName: p.displayName || '',
          supportEmail: p.supportEmail || '',
          whatsapp: p.whatsapp || '',
          website: p.website || '',
          contpaqi: p.contpaqi || false,
          softrestaurant: p.softrestaurant || false,
          bio: p.bio || '',
          logoUrl: p.logoUrl || '',
          location: p.location || '',
          services: p.services || '',
          responseTime: p.responseTime || ''
        });
      } else {
        setForm(prev => ({
          ...prev,
          displayName: u.full_name || '',
          supportEmail: u.email || ''
        }));
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      setLogoError('Solo se permiten imágenes jpeg, png o webp');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('El logo no debe superar 2MB');
      return;
    }
    setLogoUploading(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch(`/api/v1/uploads/developer-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Error al subir el logo');
      setForm(prev => ({ ...prev, logoUrl: data.url }));
    } catch (err) {
      setLogoError(err.message || 'Error al subir el logo');
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const user = await api.auth.me();
    const data = {
      ...form,
      whatsapp: sanitizeWhatsApp(form.whatsapp),
      userId: user.id
    };
    
    if (profileId) {
      await api.entities.DeveloperProfiles.update(profileId, data);
    } else {
      const created = await api.entities.DeveloperProfiles.create(data);
      setProfileId(created.id);
    }

    // Generate developer handle if not exists
    if (!user.developerHandle && form.displayName) {
      const { slugify } = await import('@/components/helpers');
      let handle = slugify(form.displayName);
      
      // Ensure uniqueness
      const allUsers = await api.entities.User.list();
      const existingHandles = allUsers
        .filter(u => u.developerHandle)
        .map(u => u.developerHandle);
      
      let counter = 1;
      let uniqueHandle = handle;
      while (existingHandles.includes(uniqueHandle)) {
        counter++;
        uniqueHandle = `${handle}-${counter}`;
      }
      
      await api.auth.updateMe({ developerHandle: uniqueHandle });
    }

    setSaving(false);
    setSaved(true);
    
    // Refresh user and redirect to Dashboard
    const updatedUser = await api.auth.me();
    setTimeout(() => {
      window.location.href = createPageUrl("Dashboard") + "?msg=profile_saved&skipRedirect=1";
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to={createPageUrl("Dashboard")} className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al dashboard
      </Link>

      {showCompleteMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Completa tu perfil para publicar add-ons</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">Llena los campos requeridos (*) para activar tu perfil público.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Perfil Developer</h1>
        <p className="text-slate-500 mb-6">Este será tu perfil público visible en el marketplace</p>

        <div className="space-y-5">
          <div>
            <Label>Nombre de display *</Label>
            <Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} className="mt-1.5" placeholder="Tu nombre o marca" />
          </div>

          <div>
            <Label>Email de soporte *</Label>
            <Input value={form.supportEmail} onChange={e => setForm({...form, supportEmail: e.target.value})} className="mt-1.5" placeholder="soporte@empresa.com" />
          </div>

          <div>
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} className="mt-1.5" placeholder="5512345678" />
            <p className="text-xs text-slate-400 mt-1">10 dígitos (se agrega prefijo 52 automáticamente)</p>
          </div>

          <div>
            <Label>Sitio web</Label>
            <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="mt-1.5" placeholder="www.tuempresa.com" />
          </div>

          <div>
            <Label className="mb-3 block">Sistemas que dominas *</Label>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.contpaqi} onCheckedChange={v => setForm({...form, contpaqi: v})} />
                <span className="text-sm text-slate-700">CONTPAQi</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.softrestaurant} onCheckedChange={v => setForm({...form, softrestaurant: v})} />
                <span className="text-sm text-slate-700">SoftRestaurant</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Bio * (mín. 20 caracteres)</Label>
            <Textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} className="mt-1.5" rows={4} placeholder="Cuéntanos sobre ti y tu experiencia..." />
            <p className="text-xs text-slate-400 mt-1">{form.bio.length} / 20 caracteres mínimo</p>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-medium text-slate-900 mb-3">Información adicional (opcional)</h3>
            <div className="space-y-4">
              <div>
                <Label>Logo (opcional)</Label>
                <p className="text-xs text-slate-400 mt-0.5 mb-2">Se mostrará en tu perfil público y en tus add-ons</p>
                <div className="flex items-center gap-3">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-contain border border-slate-200 bg-slate-50" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoUploading}
                      onClick={() => logoFileRef.current?.click()}
                    >
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Subir logo
                    </Button>
                    {form.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-600 h-auto px-2 py-1"
                        onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Quitar logo
                      </Button>
                    )}
                  </div>
                </div>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                {logoError && <p className="text-xs text-red-500 mt-1.5">{logoError}</p>}
              </div>
              <div>
                <Label>Ubicación</Label>
                <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="mt-1.5" placeholder="Ciudad de México, México" />
              </div>
              <div>
                <Label>Servicios que ofreces</Label>
                <Textarea value={form.services} onChange={e => setForm({...form, services: e.target.value})} className="mt-1.5" rows={3} placeholder="Desarrollo a medida, soporte técnico, capacitación..." />
              </div>
              <div>
                <Label>Tiempo de respuesta</Label>
                <Input value={form.responseTime} onChange={e => setForm({...form, responseTime: e.target.value})} className="mt-1.5" placeholder="24 horas" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar perfil
            </Button>
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Guardado correctamente
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}