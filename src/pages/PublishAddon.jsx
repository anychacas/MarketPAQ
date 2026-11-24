import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { api, getToken } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, AlertCircle, X, Plus, Image as ImageIcon, Video, DollarSign, Tag, Upload, ExternalLink, Package } from "lucide-react";
import { generateUniqueSlug, isProfileComplete, sanitizeWhatsApp, normalizeWebsite } from '@/components/helpers';
import { canPublish } from '@/components/access';

export default function PublishAddon() {
  return (
    <AuthGuard>
      <PublishForm />
    </AuthGuard>
  );
}

function PublishForm() {
  const [searchParams] = useSearchParams();
  const addonIdFromUrl = searchParams.get('id');
  const [user, setUser] = useState(null);
  const [devProfile, setDevProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editAddonId, setEditAddonId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    summary: '',
    description: '',
    manufacturer: '',
    system: '',
    priceFrom: '',
    licenseType: [],
    licenseDescription: '',
    classifications: [],
    classificationInput: '',
    youtubeLinks: [],
    youtubeLinkInput: '',
    images: [],
    imageInput: '',
    coverImage: '',
    website: '',
    contactEmail: '',
    contactWhatsApp: ''
  });
  const [errors, setErrors] = useState({});
  const [imageMode, setImageMode] = useState('upload');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [allExistingTags, setAllExistingTags] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const u = await api.auth.me();
      setUser(u);
      const profiles = await api.entities.DeveloperProfiles.filter({ userId: u.id });
      if (profiles.length > 0) setDevProfile(profiles[0]);

      if (addonIdFromUrl) {
        setEditAddonId(addonIdFromUrl);
        try {
          const addons = await api.entities.Addons.filter({ id: addonIdFromUrl });
          const addon = addons[0];
          if (addon) {
            setForm({
              name: addon.name || '',
              summary: addon.summary || '',
              description: addon.description || '',
              manufacturer: addon.manufacturer || '',
              system: addon.system || '',
              priceFrom: addon.priceFrom != null ? String(addon.priceFrom) : '',
              licenseType: Array.isArray(addon.licenseType) ? addon.licenseType : [],
              licenseDescription: addon.licenseDescription || '',
              classifications: Array.isArray(addon.tags) ? addon.tags : [],
              classificationInput: '',
              youtubeLinks: Array.isArray(addon.youtubeLinks) ? addon.youtubeLinks : [],
              youtubeLinkInput: '',
              images: Array.isArray(addon.images) ? addon.images : [],
              imageInput: '',
              coverImage: addon.coverImage || '',
              website: addon.website || '',
              contactEmail: addon.contactEmail || '',
              contactWhatsApp: addon.contactWhatsApp || '',
            });
          }
        } catch (err) {
          console.error('[PublishAddon] Failed to load addon for editing', err);
        }
      } else {
        setEditAddonId(null);
        setForm({
          name: '', summary: '', description: '', manufacturer: '', system: '',
          priceFrom: '', licenseType: [], licenseDescription: '',
          classifications: [], classificationInput: '',
          youtubeLinks: [], youtubeLinkInput: '',
          images: [], imageInput: '', coverImage: '',
          website: '', contactEmail: '', contactWhatsApp: '',
        });
      }

      setLoading(false);
    }
    load();
  }, [addonIdFromUrl]);

  // Load all tags from published addons for autocomplete
  useEffect(() => {
    api.entities.Addons.filter({ status: 'published' })
      .then(addons => {
        const tagCount = {};
        addons.forEach(a => (a.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
        const sorted = Object.entries(tagCount)
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag);
        setAllExistingTags(sorted);
      })
      .catch(() => {});
  }, []);

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;
  const stepLabels = ['Información', 'Precio', 'Multimedia', 'Contacto'];

  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
      if (!form.description.trim()) errs.description = 'La descripción es obligatoria';
      if (form.description.trim().length < 30) errs.description = 'La descripción debe tener al menos 30 caracteres';
      if (!form.manufacturer) errs.manufacturer = 'Selecciona un ecosistema';
      if (!form.system) errs.system = 'Selecciona un sistema';
    }
    if (s === 2) {
      if (form.priceFrom && (isNaN(form.priceFrom) || parseFloat(form.priceFrom) <= 0))
        errs.priceFrom = 'El precio debe ser mayor a 0';
    }
    return errs;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const profileStatus = isProfileComplete(devProfile);
  const userCanPublish = canPublish(user);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!userCanPublish) {
    let detail = 'Solo los developers con acceso habilitado pueden publicar add-ons.';
    if (user?.userType === 'partner') {
      detail = 'Solo Developers y Partner Líderes pueden publicar add-ons.';
    }
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Tu cuenta no tiene permisos para publicar add-ons.</h2>
          <p className="text-slate-600 mb-6">{detail}</p>
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline">Volver al dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!profileStatus.complete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Completa tu perfil developer</h2>
          <p className="text-slate-600 mb-4">Antes de publicar add-ons, necesitas completar tu perfil con:</p>
          <ul className="text-left inline-block text-slate-600 mb-6 space-y-1">
            {profileStatus.missing.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Link to={createPageUrl("DeveloperProfile")}>
              <Button className="bg-blue-600 hover:bg-blue-700">Completar perfil</Button>
            </Link>
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost">Volver al dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addClassification = (value) => {
    const tag = (value ?? form.classificationInput).trim();
    if (!tag) return;
    if (form.classifications.includes(tag)) {
      setErrors({...errors, classification: 'Esta clasificación ya existe'});
      setShowTagSuggestions(false);
      return;
    }
    if (form.classifications.length >= 3) {
      setErrors({...errors, classification: 'Máximo 3 clasificaciones'});
      setShowTagSuggestions(false);
      return;
    }
    setForm({...form, classifications: [...form.classifications, tag], classificationInput: ''});
    setErrors({...errors, classification: ''});
    setShowTagSuggestions(false);
  };

  const removeClassification = (index) => {
    setForm({...form, classifications: form.classifications.filter((_, i) => i !== index)});
  };

  const addYoutubeLink = () => {
    const value = form.youtubeLinkInput.trim();
    if (!value) return;
    if (!value.includes('youtube.com') && !value.includes('youtu.be')) {
      setErrors({...errors, youtube: 'Debe ser una URL válida de YouTube'});
      return;
    }
    if (form.youtubeLinks.length >= 5) {
      setErrors({...errors, youtube: 'Máximo 5 videos'});
      return;
    }
    setForm({...form, youtubeLinks: [...form.youtubeLinks, value], youtubeLinkInput: ''});
    setErrors({...errors, youtube: ''});
  };

  const removeYoutubeLink = (index) => {
    setForm({...form, youtubeLinks: form.youtubeLinks.filter((_, i) => i !== index)});
  };

  const addImage = () => {
    const value = form.imageInput.trim();
    if (!value) return;
    if (form.images.length >= 5) {
      setErrors({...errors, image: 'Máximo 5 imágenes'});
      return;
    }
    setForm({...form, images: [...form.images, value], imageInput: '', coverImage: form.images.length === 0 ? value : form.coverImage});
    setErrors({...errors, image: ''});
  };

  const removeImage = (index) => {
    const newImages = form.images.filter((_, i) => i !== index);
    setForm({
      ...form, 
      images: newImages,
      coverImage: form.coverImage === form.images[index] ? (newImages[0] || '') : form.coverImage
    });
  };

  const setCoverImageHandler = (img) => {
    setForm({...form, coverImage: img});
  };

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

  const validateImageFile = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Solo se permiten imágenes jpeg, png o webp';
    if (file.size > MAX_IMAGE_SIZE) return 'La imagen no debe superar 2MB';
    return null;
  };

  const handleCoverFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validErr = validateImageFile(file);
    if (validErr) { setErrors(prev => ({...prev, image: validErr})); return; }

    setUploadingCover(true);
    setErrors(prev => ({...prev, image: ''}));
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/uploads/addons/cover', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al subir la portada');
      }
      const { url } = await res.json();
      setForm(prev => ({...prev, coverImage: url}));
    } catch (err) {
      setErrors(prev => ({...prev, image: err.message}));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryFilesSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;

    const remaining = 5 - form.images.length;
    if (remaining <= 0) { setErrors(prev => ({...prev, image: 'Máximo 5 imágenes'})); return; }

    const toUpload = selected.slice(0, remaining);
    for (const file of toUpload) {
      const validErr = validateImageFile(file);
      if (validErr) { setErrors(prev => ({...prev, image: validErr})); return; }
    }

    setUploadingGallery(true);
    setErrors(prev => ({...prev, image: ''}));
    try {
      const token = getToken();
      const fd = new FormData();
      for (const file of toUpload) fd.append('files', file);
      const res = await fetch('/api/v1/uploads/addons/images', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al subir las imágenes');
      }
      const { urls } = await res.json();
      setForm(prev => ({...prev, images: [...prev.images, ...urls]}));
    } catch (err) {
      setErrors(prev => ({...prev, image: err.message}));
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!form.description.trim()) newErrors.description = 'La descripción es obligatoria';
    if (form.description.trim().length < 30) newErrors.description = 'La descripción debe tener al menos 30 caracteres';
    if (!form.manufacturer) newErrors.manufacturer = 'Selecciona un ecosistema';
    if (!form.system) newErrors.system = 'Selecciona un sistema';
    if (form.priceFrom && (isNaN(form.priceFrom) || parseFloat(form.priceFrom) <= 0)) {
      newErrors.priceFrom = 'El precio debe ser mayor a 0';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);

    // Mantener compatibilidad con campos legacy
    const contpaqi = form.manufacturer === 'CONTPAQi';
    const softrestaurant = form.manufacturer === 'SoftRestaurant';

    const commonFields = {
      name: form.name.trim(),
      summary: form.summary.trim(),
      description: form.description.trim(),
      contpaqi,
      softrestaurant,
      manufacturer: form.manufacturer,
      system: form.system,
      priceFrom: form.priceFrom ? parseFloat(form.priceFrom) : null,
      licenseType: form.licenseType || null,
      licenseDescription: form.licenseDescription || null,
      tags: form.classifications,
      youtubeLinks: form.youtubeLinks,
      images: form.images,
      coverImage: form.coverImage,
      website: form.website ? normalizeWebsite(form.website) : '',
      contactEmail: form.contactEmail,
      contactWhatsApp: form.contactWhatsApp ? sanitizeWhatsApp(form.contactWhatsApp) : '',
    };

    if (editAddonId) {
      await api.entities.Addons.update(editAddonId, commonFields);
    } else {
      const slug = await generateUniqueSlug(form.name, api.entities.Addons);
      const vendor = devProfile?.displayName || user.company || user.full_name || 'Anónimo';
      await api.entities.Addons.create({
        slug,
        vendor,
        status: 'pending',
        ownerUserId: user.id,
        ...commonFields,
      });
    }

    setSaving(false);
    window.location.href = createPageUrl("Dashboard") + (editAddonId ? "?msg=updated" : "?msg=published");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to={createPageUrl("Dashboard")} className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al dashboard
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{editAddonId ? 'Editar Add-on' : 'Publicar Add-on'}</h1>
        <p className="text-slate-500 mb-6">{editAddonId ? 'Actualiza la información de tu add-on' : 'Tu add-on será revisado antes de aparecer en el catálogo'}</p>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <React.Fragment key={n}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-[11px] font-medium hidden sm:block ${active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${done ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="space-y-8">
          {/* Step 1: Información básica */}
          {step === 1 && <><div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Tag className="w-4 h-4 text-blue-600" />
              </div>
              Información principal
            </h2>
            <div className="space-y-4 pl-10">
              <div>
                <Label>Nombre del add-on *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="mt-1.5" 
                  placeholder="Ej. Facturación CFDI 4.0" 
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label>Resumen corto</Label>
                <Input 
                  value={form.summary} 
                  onChange={e => setForm({...form, summary: e.target.value})} 
                  className="mt-1.5" 
                  placeholder="Una línea describiendo tu add-on" 
                />
              </div>

              <div>
                <Label>Descripción completa * (mínimo 30 caracteres)</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  className="mt-1.5" 
                  rows={5} 
                  placeholder="Describe funcionalidades, beneficios, requisitos, casos de uso..." 
                />
                <p className="text-xs text-slate-500 mt-1">
                  {form.description.length} / 30 caracteres mínimo
                </p>
                {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
              </div>

              <div>
                <Label>Clasificación (máximo 3)</Label>
                <div className="relative mt-1.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        ref={tagInputRef}
                        value={form.classificationInput}
                        onChange={e => {
                          setForm({...form, classificationInput: e.target.value});
                          setShowTagSuggestions(true);
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addClassification(); }
                          if (e.key === 'Escape') setShowTagSuggestions(false);
                        }}
                        placeholder="Ej. Facturación, Nómina, Inventario"
                        disabled={form.classifications.length >= 3}
                      />
                      {showTagSuggestions && form.classifications.length < 3 && (() => {
                        const q = form.classificationInput.toLowerCase();
                        const suggestions = allExistingTags.filter(t =>
                          !form.classifications.includes(t) &&
                          (q === '' || t.toLowerCase().includes(q))
                        ).slice(0, 8);
                        if (suggestions.length === 0) return null;
                        return (
                          <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            {suggestions.map(tag => (
                              <li
                                key={tag}
                                onMouseDown={() => addClassification(tag)}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                              >
                                {tag}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                    <Button
                      type="button"
                      onClick={() => addClassification()}
                      variant="outline"
                      size="icon"
                      disabled={form.classifications.length >= 3}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {errors.classification && <p className="text-sm text-red-500 mt-1">{errors.classification}</p>}
                {form.classifications.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.classifications.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1">
                        {tag}
                        <button onClick={() => removeClassification(i)} className="hover:bg-slate-200 rounded p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compatibilidad — also step 1 */}
          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              Compatibilidad
            </h2>
            <div className="space-y-4 pl-10">
              <div>
                <Label>Ecosistema *</Label>
                <Select value={form.manufacturer} onValueChange={v => setForm({...form, manufacturer: v})}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecciona el ecosistema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTPAQi">CONTPAQi</SelectItem>
                    <SelectItem value="SoftRestaurant">SoftRestaurant</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.manufacturer && <p className="text-sm text-red-500 mt-1">{errors.manufacturer}</p>}
              </div>

              <div>
                <Label>Sistema *</Label>
                <Select value={form.system} onValueChange={v => setForm({...form, system: v})}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecciona el sistema compatible" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTPAQi Nóminas">CONTPAQi Nóminas</SelectItem>
                    <SelectItem value="CONTPAQi Personia">CONTPAQi Personia</SelectItem>
                    <SelectItem value="CONTPAQi Facturación">CONTPAQi Facturación</SelectItem>
                    <SelectItem value="CONTPAQi Comercial Start/PRO">CONTPAQi Comercial Start/PRO</SelectItem>
                    <SelectItem value="CONTPAQi Comercial Premium">CONTPAQi Comercial Premium</SelectItem>
                    <SelectItem value="CONTPAQi Contabilidad">CONTPAQi Contabilidad</SelectItem>
                    <SelectItem value="CONTPAQi Bancos">CONTPAQi Bancos</SelectItem>
                    <SelectItem value="CONTPAQi XML">CONTPAQi XML</SelectItem>
                    <SelectItem value="SoftRestaurant">SoftRestaurant</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.system && <p className="text-sm text-red-500 mt-1">{errors.system}</p>}
              </div>
            </div>
          </div>

          </>}

          {/* Step 2: Precio y clasificación */}
          {step === 2 && <div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              Precio
            </h2>
            <div className="pl-10 space-y-4">
              <div>
                <Label>Precio desde (MXN)</Label>
                <Input
                  type="number"
                  value={form.priceFrom}
                  onChange={e => setForm({...form, priceFrom: e.target.value})}
                  className="mt-1.5"
                  placeholder="Ej. 1990"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Este es el precio base más bajo. Los términos comerciales se revisan directamente con el developer.
                </p>
                {errors.priceFrom && <p className="text-sm text-red-500 mt-1">{errors.priceFrom}</p>}
              </div>

              <div>
                <Label>Tipo de licencia</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {[
                    { value: 'vitalicia', label: 'Vitalicia (pago único)' },
                    { value: 'anual',     label: 'Anual (renovación)' },
                    { value: 'mensual',   label: 'Mensual (suscripción)' },
                  ].map(({ value, label }) => {
                    const checked = form.licenseType.includes(value);
                    return (
                      <label key={value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none ${
                        checked
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? form.licenseType.filter(v => v !== value)
                              : [...form.licenseType, value];
                            setForm({ ...form, licenseType: next });
                          }}
                        />
                        <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                          checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                        }`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Descripción de licencia</Label>
                <Input
                  value={form.licenseDescription}
                  onChange={e => setForm({...form, licenseDescription: e.target.value.slice(0, 120)})}
                  className="mt-1.5"
                  placeholder="Ej. Por RFC, por equipo, por usuario, por empresa…"
                  maxLength={120}
                />
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-slate-500">Indica cómo se mide o aplica la licencia de tu add-on.</p>
                  <p className={`text-xs tabular-nums ${form.licenseDescription.length >= 100 ? 'text-red-500' : 'text-slate-400'}`}>
                    {form.licenseDescription.length}/120
                  </p>
                </div>
              </div>
            </div>
          </div>}

          {/* Step 3: Multimedia */}
          {step === 3 && <><div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Video className="w-4 h-4 text-red-600" />
              </div>
              Videos (YouTube)
            </h2>
            <div className="pl-10 space-y-3">
              <div className="flex gap-2">
                <Input 
                  value={form.youtubeLinkInput} 
                  onChange={e => setForm({...form, youtubeLinkInput: e.target.value})}
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addYoutubeLink())}
                  placeholder="https://www.youtube.com/watch?v=..." 
                />
                <Button type="button" onClick={addYoutubeLink} variant="outline" size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {errors.youtube && <p className="text-sm text-red-500">{errors.youtube}</p>}
              {form.youtubeLinks.length > 0 && (
                <div className="space-y-2">
                  {form.youtubeLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                      <Video className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600 truncate flex-1">{link}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeYoutubeLink(i)} className="h-7 w-7">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">{form.youtubeLinks.length} / 5 videos</p>
            </div>
          </div>

          {/* Imágenes */}
          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-blue-600" />
              </div>
              Imágenes
            </h2>
            <div className="pl-10 space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg border font-medium transition-colors ${imageMode === 'upload' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Subir archivos
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg border font-medium transition-colors ${imageMode === 'url' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Pegar URLs
                </button>
              </div>

              {imageMode === 'upload' && (
                <div className="space-y-4">
                  {/* Cover image */}
                  <div>
                    <Label>Imagen de portada (opcional)</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {uploadingCover
                          ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          : <Upload className="w-4 h-4 mr-1.5" />}
                        {form.coverImage ? 'Cambiar portada' : 'Subir portada'}
                      </Button>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleCoverFileSelect}
                      />
                      {form.coverImage && (
                        <div className="relative w-20 h-14 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                          <img src={form.coverImage} alt="Portada" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm(f => ({...f, coverImage: ''}))}
                            className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gallery images */}
                  <div>
                    <Label>Imágenes de galería (hasta 5)</Label>
                    <div className="mt-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingGallery || form.images.length >= 5}
                        onClick={() => galleryInputRef.current?.click()}
                      >
                        {uploadingGallery
                          ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          : <Plus className="w-4 h-4 mr-1.5" />}
                        Agregar imágenes
                      </Button>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleGalleryFilesSelect}
                      />
                    </div>
                    {form.images.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        {form.images.map((img, i) => (
                          <div key={i} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                            <img src={img} alt={`Imagen ${i+1}`} className="w-full h-32 object-cover" onError={(e) => e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="12"%3EImagen%3C/text%3E%3C/svg%3E'} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(i)} className="h-8 w-8">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">{form.images.length} / 5 imágenes · jpeg, png o webp · máx. 2MB</p>
                  </div>
                </div>
              )}

              {imageMode === 'url' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={form.imageInput}
                      onChange={e => setForm({...form, imageInput: e.target.value})}
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                    <Button type="button" onClick={addImage} variant="outline">
                      <Plus className="w-4 h-4 mr-1.5" /> Agregar
                    </Button>
                  </div>
                  {form.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {form.images.map((img, i) => (
                        <div key={i} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                          <img src={img} alt={`Preview ${i+1}`} className="w-full h-32 object-cover" onError={(e) => e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="12"%3EImagen%3C/text%3E%3C/svg%3E'} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setCoverImageHandler(img)}
                              className={form.coverImage === img ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                            >
                              {form.coverImage === img ? 'Portada' : 'Usar como portada'}
                            </Button>
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(i)} className="h-8 w-8">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          {form.coverImage === img && (
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-blue-600">Portada</Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">{form.images.length} / 5 imágenes</p>
                </div>
              )}

              {errors.image && <p className="text-sm text-red-500">{errors.image}</p>}
            </div>
          </div>

          </>}

          {/* Step 4: Contacto y publicar */}
          {step === 4 && <><div className="border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Links de contacto (opcional)</h2>
            <div className="space-y-4 pl-10">
              <div>
                <Label>Sitio web</Label>
                <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="mt-1.5" placeholder="www.miaddon.com" />
              </div>
              <div>
                <Label>Email de contacto</Label>
                <Input value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="mt-1.5" placeholder="contacto@miaddon.com" />
              </div>
              <div>
                <Label>WhatsApp de contacto</Label>
                <Input value={form.contactWhatsApp} onChange={e => setForm({...form, contactWhatsApp: e.target.value})} className="mt-1.5" placeholder="5512345678" />
              </div>
            </div>
          </div>

          {/* Preview/Resumen */}
          {form.name && form.manufacturer && form.system && (
            <div className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Vista previa</h2>
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{form.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Ecosistema:</span>
                    <Badge variant="secondary">{form.manufacturer}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Sistema:</span>
                    <Badge variant="secondary">{form.system}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Precio:</span>
                    <span className="font-medium text-slate-900">
                      {form.priceFrom ? `Desde $${parseFloat(form.priceFrom).toLocaleString('es-MX')} MXN` : 'Consultar'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Multimedia:</span>
                    <span className="text-slate-700">
                      {form.images.length} {form.images.length === 1 ? 'imagen' : 'imágenes'}, {form.youtubeLinks.length} {form.youtubeLinks.length === 1 ? 'video' : 'videos'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          </>}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={goPrev} className="flex-1 h-11">
                <ArrowLeft className="w-4 h-4 mr-2" /> Anterior
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={goNext} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
                Siguiente →
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                {editAddonId ? 'Guardar cambios' : 'Enviar a revisión'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}