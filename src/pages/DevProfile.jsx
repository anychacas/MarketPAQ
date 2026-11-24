import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SystemBadge from '@/components/SystemBadge';
import ContactButtons from '@/components/ContactButtons';
import AddonCard from '@/components/AddonCard';
import RatingStars from '@/components/RatingStars';
import { User, MapPin, Globe, Loader2, Package, MessageCircle, ExternalLink, Copy, Check } from "lucide-react";
import { setDocTitle, setMetaTag, setOgTag, setCanonical } from '@/lib/seo';

export default function DevProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [handle, setHandle] = useState(null);

  // Rating state
  const [ratingSummary, setRatingSummary] = useState(null);
  const [myRatingValue, setMyRatingValue] = useState(0);
  const [myRatingComment, setMyRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get('handle');
    const legacyId = params.get('id'); // backward compat: old links used ?id=<userId>

    if (!h && !legacyId) {
      console.debug('DevProfile: No handle or id in URL');
      setLoading(false);
      setError('invalid_handle');
      return;
    }

    let timeoutId;
    let cancelled = false;

    async function load() {
      try {
        // Timeout de 8 segundos
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            console.debug('DevProfile: Load timeout');
            setLoading(false);
            setError('timeout');
          }
        }, 8000);

        let resolvedHandle = h;

        // Backward compat: ?id=<userId> — resolve profile first to get developerHandle
        if (!resolvedHandle && legacyId) {
          console.debug('DevProfile: legacy ?id= fallback:', legacyId);
          const byId = await api.entities.DeveloperProfiles.filter({ userId: legacyId });
          if (cancelled) return;
          if (byId.length === 0) {
            clearTimeout(timeoutId);
            setLoading(false);
            setError('not_found');
            return;
          }
          resolvedHandle = byId[0].developerHandle || null;
          if (!resolvedHandle) {
            // Profile exists but user has no handle yet — show it without shareable URL
            setProfile(byId[0]);
            const addons = await api.entities.Addons.filter({ ownerUserId: legacyId, status: 'published' });
            if (!cancelled) setAddons(addons);
            clearTimeout(timeoutId);
            setLoading(false);
            return;
          }
        }

        setHandle(resolvedHandle);
        console.debug('DevProfile handle:', resolvedHandle);

        // Cargar perfil directamente por developerHandle (1 llamada en vez de 2)
        const profiles = await api.entities.DeveloperProfiles.filter({ developerHandle: resolvedHandle });
        if (cancelled) return;
        if (profiles.length === 0) {
          console.debug('DevProfile: Profile not found for handle:', resolvedHandle);
          clearTimeout(timeoutId);
          setLoading(false);
          setError('not_found');
          return;
        }
        setProfile(profiles[0]);
        console.debug('DevProfile: Profile found:', profiles[0].id);

        // Cargar add-ons publicados por developerHandle
        const published = await api.entities.Addons.filter({ developerHandle: resolvedHandle, status: 'published' });
        if (cancelled) return;
        console.debug('DevProfile: Addons loaded:', published.length);
        setAddons(published);

        clearTimeout(timeoutId);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.debug('DevProfile: Error loading:', err.message);
          clearTimeout(timeoutId);
          setError(err.message || 'Error al cargar el perfil');
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // Fetch developer rating summary once profile.id is known
  useEffect(() => {
    if (!profile?.id) return;
    api.functions.invoke('getDeveloperRatingSummary', { developerId: profile.id })
      .then(({ data }) => {
        setRatingSummary(data);
        if (data.myRating) {
          setMyRatingValue(data.myRating.rating);
          setMyRatingComment(data.myRating.comment ?? '');
        }
      })
      .catch(err => console.error('[DevProfile] getDeveloperRatingSummary failed', err));
  }, [profile?.id]);

  // ── SEO: update meta tags when profile loads ──────────────────────────────
  useEffect(() => {
    const name = profile?.displayName || 'Developer';
    const title = `${name} | Developer en MarketPAQ`;
    const rawDesc = profile?.bio || '';
    const desc = rawDesc.length > 0
      ? (rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc)
      : `Conoce el perfil de ${name} en MarketPAQ y descubre sus add-ons, especialidades y formas de contacto.`;
    const url = window.location.href;
    const image = 'https://marketpaq.com/favicon.png?v=2';

    setDocTitle(title);
    setMetaTag('description', desc);
    setOgTag('og:title', title);
    setOgTag('og:description', desc);
    setOgTag('og:type', 'profile');
    setOgTag('og:url', url);
    setOgTag('og:image', image);
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', desc);
    setCanonical(url);
  }, [profile]);

  const handleRatingSubmit = async () => {
    if (!myRatingValue || !profile?.id) return;
    setSavingRating(true);
    setRatingSaved(false);
    try {
      await api.functions.invoke('rateDeveloper', {
        developerId: profile.id,
        rating: myRatingValue,
        comment: myRatingComment || undefined,
      });
      const { data } = await api.functions.invoke('getDeveloperRatingSummary', { developerId: profile.id });
      setRatingSummary(data);
      setRatingSaved(true);
    } catch (err) {
      console.error('[DevProfile] rateDeveloper failed', err);
    } finally {
      setSavingRating(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setAddons([]);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        {/* Hero skeleton */}
        <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-32 h-32 rounded-3xl bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-4">
                <div className="h-12 w-72 bg-slate-200 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-slate-200 rounded-full animate-pulse" />
                </div>
                <div className="h-5 w-96 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
                <div className="flex gap-3 pt-2">
                  <div className="h-12 w-36 bg-slate-200 rounded-xl animate-pulse" />
                  <div className="h-12 w-36 bg-slate-200 rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200 p-10 space-y-4">
              <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="space-y-2.5">
                {[100, 88, 94].map((w, j) => (
                  <div key={j} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error: Handle inválido o faltante
  if (error === 'invalid_handle') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="max-w-md mx-auto px-4 text-center">
          <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Falta el identificador del developer</h2>
          <p className="text-slate-600 mb-6">Revisa el link o busca en el catálogo.</p>
          <Link to={createPageUrl("AddonsCatalog")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">Volver al catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error: Developer no encontrado
  if (error === 'not_found' || (!profile && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="max-w-md mx-auto px-4 text-center">
          <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Developer no encontrado</h2>
          <p className="text-slate-600 mb-6">Revisa el link o busca en el catálogo.</p>
          <Link to={createPageUrl("AddonsCatalog")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">Volver al catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error: Timeout o error genérico
  if (error === 'timeout' || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="max-w-md mx-auto px-4 text-center">
          <User className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {error === 'timeout' ? 'La carga está tardando mucho' : 'Error al cargar el perfil'}
          </h2>
          <p className="text-slate-600 mb-6">
            {error === 'timeout' 
              ? 'No pudimos cargar el perfil. Intenta de nuevo.' 
              : 'Ocurrió un problema al cargar el perfil.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRetry} className="bg-indigo-600 hover:bg-indigo-700">
              Reintentar
            </Button>
            <Link to={createPageUrl("AddonsCatalog")}>
              <Button variant="outline">Volver al catálogo</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(`Hola ${profile.displayName}, te contacto desde MarketPaq`);
  const profileUrl = `${window.location.origin}/DevProfile?handle=${handle}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getHeadline = () => {
    if (profile.bio && profile.bio.length > 120) {
      return profile.bio.substring(0, 120) + '...';
    } else if (profile.bio) {
      return profile.bio;
    }
    return 'Developer independiente especializado en soluciones empresariales.';
  };

  const getWebsiteDomain = () => {
    if (!profile.website) return null;
    try {
      const url = new URL(profile.website.startsWith('http') ? profile.website : 'https://' + profile.website);
      return url.hostname.replace('www.', '');
    } catch {
      return profile.website;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 border-b border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 to-purple-100/40 backdrop-blur-3xl"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Avatar/Logo */}
            <div className="flex-shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt={profile.displayName} className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl" />
              ) : (
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-white shadow-xl">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <h1 className="text-5xl font-bold text-slate-900 mb-2 leading-tight">{profile.displayName}</h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <SystemBadge contpaqi={profile.contpaqi} softrestaurant={profile.softrestaurant} size="lg" />
              </div>

              {/* Rating summary in hero */}
              {ratingSummary && (
                <div className="flex items-center gap-2 mb-5 pointer-events-none">
                  <RatingStars value={ratingSummary.avgRating ?? 0} readonly size="sm" />
                  <span className="text-slate-600 text-sm">
                    {ratingSummary.totalCount > 0
                      ? `${Number(ratingSummary.avgRating).toFixed(1)} · ${ratingSummary.totalCount} ${ratingSummary.totalCount === 1 ? 'reseña' : 'reseñas'}`
                      : 'Sin reseñas aún'}
                  </span>
                </div>
              )}

              <p className="text-lg text-slate-700 leading-relaxed mb-6 max-w-2xl">
                {getHeadline()}
              </p>
              
              <div className="flex flex-wrap gap-3 mb-6 text-sm">
                {profile.location && (
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200">
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-700">{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200">
                    <Globe className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-700">{getWebsiteDomain()}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#contacto"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 shadow-lg">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contactar
                  </Button>
                </a>
                <a
                  href="#addons"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('addons')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Button size="lg" variant="outline" className="h-12 px-8 bg-white/80 backdrop-blur-sm border-slate-300">
                    <Package className="w-4 h-4 mr-2" />
                    Ver add-ons
                  </Button>
                </a>
              </div>

              {/* Compact share block — visible above the fold */}
              {handle && (
                <div className="mt-5 flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2.5 max-w-lg">
                  <Copy className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500 flex-shrink-0 hidden sm:inline">Comparte este perfil:</span>
                  <span className="text-xs font-mono text-slate-600 truncate flex-1">{profileUrl}</span>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : null}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Contacto directo */}
        <div id="contacto" className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl border border-blue-100 p-10 shadow-sm">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Contacto directo</h2>
            <p className="text-lg text-slate-600 mb-8">Responde directamente el developer. Cotiza y agenda demo.</p>
            
            <div className="flex flex-col items-center gap-4">
              <ContactButtons
                whatsapp={profile.whatsapp}
                email={profile.supportEmail}
                website={profile.website}
                size="lg"
              />
              
              <p className="text-sm text-slate-500 mt-2">
                Mensaje sugerido: <span className="italic">"Hola, te contacto desde MarketPaq..."</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Sobre el developer</h2>
          {profile.bio ? (
            <div className="max-w-3xl">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-lg" style={{lineHeight: '1.8'}}>
                {profile.bio}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Este developer aún no ha agregado una descripción.</p>
            </div>
          )}
        </div>

        {/* Ratings card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Calificaciones</h2>

          {/* User rating form */}
          {user ? (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="text-base font-semibold text-slate-800 mb-4">
                {ratingSummary?.myRating ? 'Tu calificación' : 'Califica a este developer'}
              </h3>
              <div className="flex flex-col gap-4">
                <RatingStars value={myRatingValue} onChange={setMyRatingValue} size="lg" />
                <Textarea
                  placeholder="Comentario opcional (experiencia, trato, calidad del trabajo…)"
                  value={myRatingComment}
                  onChange={e => setMyRatingComment(e.target.value)}
                  rows={3}
                  className="bg-white"
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleRatingSubmit}
                    disabled={savingRating || myRatingValue === 0}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {savingRating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Guardar calificación
                  </Button>
                  {ratingSaved && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Guardado
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-6">Inicia sesión para calificar a este developer.</p>
          )}

          {/* Recent reviews */}
          {ratingSummary && ratingSummary.lastRatings?.length > 0 ? (
            <div>
              <h3 className="text-base font-semibold text-slate-700 mb-4">Últimas reseñas</h3>
              <div className="space-y-4">
                {ratingSummary.lastRatings.map((r, i) => (
                  <div key={i} className="flex gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex-shrink-0 pointer-events-none">
                      <RatingStars value={r.score} readonly size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {r.comment && (
                        <p className="text-sm text-slate-700 leading-relaxed mb-1">{r.comment}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : ratingSummary && ratingSummary.totalCount === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay reseñas para este developer.</p>
          ) : null}
        </div>

        {/* Compartir perfil — solo si el developer tiene handle */}
        {handle && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Comparte este perfil</h2>
            <p className="text-slate-600 mb-6">Comparte tu página con Partners o clientes.</p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 font-mono text-sm text-slate-700 overflow-x-auto">
                {profileUrl}
              </div>
              <Button onClick={handleCopy} variant="outline" className="flex-shrink-0">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Addons */}
        <div id="addons">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-6 h-6 text-indigo-600" />
            <h2 className="text-3xl font-bold text-slate-900">Add-ons publicados</h2>
            <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">{addons.length}</Badge>
          </div>

          {addons.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg text-slate-500">Aún no hay add-ons publicados. Vuelve pronto.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {addons.map(addon => (
                <AddonCard key={addon.id} addon={addon} hasContact={true} />
              ))}
            </div>
          )}
        </div>

        {/* CTA final */}
        {(profile.whatsapp || profile.supportEmail) && (
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-10 text-center text-white shadow-xl">
            <h3 className="text-3xl font-bold mb-3">¿Quieres una demo o cotización?</h3>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Contacta directamente y recibe una respuesta personalizada.
            </p>
            {profile.whatsapp ? (
              <a href={`https://wa.me/${profile.whatsapp.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 h-14 px-10 text-lg shadow-lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contactar por WhatsApp
                </Button>
              </a>
            ) : (
              <a href={`mailto:${profile.supportEmail}`}>
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 h-14 px-10 text-lg shadow-lg">
                  Contactar por Email
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}