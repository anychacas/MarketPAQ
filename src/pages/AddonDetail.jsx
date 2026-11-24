import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import SystemBadge from '@/components/SystemBadge';
import ContactButtons from '@/components/ContactButtons';
import DeveloperCard from '@/components/DeveloperCard';
import RatingStars from '@/components/RatingStars';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Package, Calendar, User, MessageCircle, Star, Play, Infinity, RefreshCw, Key } from "lucide-react";

/** Convert any YouTube URL format to an embed URL; returns null if unrecognisable. */
function toYouTubeEmbed(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('youtube.com/embed/')) return url;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  return null;
}

function formatPrice(price) {
  if (!price || price <= 0) return null;
  return price % 1 === 0 ? String(Math.round(price)) : price.toFixed(2);
}

export default function AddonDetail() {
  return (
    <AuthGuard>
      <DetailContent />
    </AuthGuard>
  );
}

function DetailContent() {
  const [addon, setAddon] = useState(null);
  const [devProfile, setDevProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [myRatingValue, setMyRatingValue] = useState(0);
  const [myRatingComment, setMyRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  const fetchRatingSummary = async (addonId) => {
    setRatingLoading(true);
    try {
      const { data } = await api.functions.invoke('getAddonRatingSummary', { addonId });
      setRatingSummary(data);
      if (data?.myRating) {
        setMyRatingValue(data.myRating.rating);
        setMyRatingComment(data.myRating.comment ?? '');
      }
    } catch (err) {
      console.error('[AddonDetail] getAddonRatingSummary failed', err);
    } finally {
      setRatingLoading(false);
    }
  };

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('slug');
      if (!slug) { setLoading(false); return; }

      const results = await api.entities.Addons.filter({ slug });
      if (results.length > 0) {
        const a = results[0];
        setAddon(a);
        api.functions.invoke('registerAddonView', { addonId: a.id }).catch(err =>
          console.error('[AddonDetail] registerAddonView failed', err)
        );
        fetchRatingSummary(a.id);
        if (a.ownerUserId) {
          const profiles = await api.entities.DeveloperProfiles.filter({ userId: a.ownerUserId });
          if (profiles.length > 0) setDevProfile(profiles[0]);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!myRatingValue) return;
    setSavingRating(true);
    try {
      await api.functions.invoke('rateAddon', {
        addonId: addon.id,
        rating: myRatingValue,
        comment: myRatingComment.trim() || undefined,
      });
      await fetchRatingSummary(addon.id);
    } catch (err) {
      console.error('[AddonDetail] rateAddon failed', err);
    } finally {
      setSavingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Sidebar skeleton */}
            <div className="lg:order-2 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="h-7 w-3/4 bg-slate-200 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
                  <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 space-y-3 border border-indigo-100">
                <div className="h-4 w-12 bg-indigo-200/60 rounded animate-pulse" />
                <div className="h-9 w-2/3 bg-indigo-200/60 rounded animate-pulse" />
                <div className="h-4 w-full bg-indigo-200/40 rounded animate-pulse" />
              </div>
              <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-4 h-4 bg-slate-200 rounded animate-pulse flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                      <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Main content skeleton */}
            <div className="lg:col-span-2 lg:order-1 space-y-8">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="aspect-video bg-slate-200 animate-pulse" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 space-y-4">
                <div className="h-7 w-1/2 bg-slate-200 rounded animate-pulse" />
                <div className="space-y-2.5">
                  {[100, 90, 95, 80, 85].map((w, i) => (
                    <div key={i} className={`h-4 bg-slate-100 rounded animate-pulse`} style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!addon) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Add-on no encontrado</h2>
        <Link to={createPageUrl("AddonsCatalog")}>
          <Button variant="outline" className="mt-4">Volver al catálogo</Button>
        </Link>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Gallery: coverImage first, then unique images[]
  const galleryImages = [];
  if (addon.coverImage) galleryImages.push(addon.coverImage);
  (addon.images || []).forEach(img => {
    if (img && typeof img === 'string' && !galleryImages.includes(img)) galleryImages.push(img);
  });
  const mainImage = activeImage || galleryImages[0] || null;

  // Valid YouTube embed URLs
  const embedVideos = (addon.youtubeLinks || []).map(toYouTubeEmbed).filter(Boolean);

  // Technical fields
  const manufacturerDisplay = addon.manufacturer ||
    (addon.contpaqi ? 'CONTPAQi' : addon.softrestaurant ? 'SoftRestaurant' : null);
  const systemDisplay = addon.system || null;
  const priceFormatted = formatPrice(addon.priceFrom);

  const devProfileUrl = devProfile
    ? createPageUrl('DevProfile') + (devProfile.developerHandle
        ? `?handle=${devProfile.developerHandle}`
        : `?id=${devProfile.userId}`)
    : null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to={createPageUrl("AddonsCatalog")} className="inline-flex items-center text-sm text-slate-600 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al catálogo
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/*
          Single unified 2-column grid.
          Right sidebar comes first in HTML (mobile: title/price/CTA before gallery).
          On desktop, CSS order flips it: left=gallery+content, right=sidebar.
        */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">

          {/* ── RIGHT SIDEBAR (HTML-first for good mobile UX) ── */}
          <div className="lg:order-2 space-y-6">
            <div className="sticky top-24 space-y-6">

              {/* Name + badges + dev link */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-4 leading-snug">{addon.name}</h1>
                <div className="flex flex-wrap gap-2 mb-4">
                  <SystemBadge contpaqi={addon.contpaqi} softrestaurant={addon.softrestaurant} size="lg" />
                  {addon.tags?.map(tag => (
                    <Badge key={tag} className="bg-indigo-100 text-indigo-700 border-0">{tag}</Badge>
                  ))}
                </div>
                {devProfile && devProfileUrl && (
                  <Link to={devProfileUrl} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                    por <span className="font-semibold text-slate-700 hover:text-indigo-600">{devProfile.displayName}</span>
                  </Link>
                )}
              </div>

              {/* Price */}
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 border border-indigo-100">
                <div className="text-sm font-semibold text-slate-600 mb-1">Precio</div>
                {priceFormatted ? (
                  <>
                    <div className="text-3xl font-bold text-slate-900 mt-1">
                      Desde ${priceFormatted}
                      <span className="text-base font-normal text-slate-500 ml-1">MXN</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">Precio base de licencia.</p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-slate-900 mt-1">Precio personalizado</div>
                    <p className="text-sm text-slate-600 mt-1">Contacta al developer para cotización.</p>
                  </>
                )}

                {/* License info */}
                {((Array.isArray(addon.licenseType) && addon.licenseType.length > 0) || addon.licenseDescription) && (
                  <div className="mt-4 pt-4 border-t border-indigo-100 space-y-2">
                    {Array.isArray(addon.licenseType) && addon.licenseType.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {addon.licenseType.map(lt => {
                          const isVitalicia = lt === 'vitalicia';
                          const labels = { vitalicia: 'Vitalicia (pago único)', anual: 'Anual (renovación)', mensual: 'Mensual (suscripción)' };
                          return (
                            <div key={lt} className="flex items-center gap-1.5">
                              {isVitalicia
                                ? <Infinity className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                : <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              }
                              <span className={`text-sm font-semibold ${isVitalicia ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {labels[lt] ?? lt}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {addon.licenseDescription && (
                      <div className="flex items-start gap-2">
                        <Key className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-600">{addon.licenseDescription}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CTA buttons */}
              <div className="space-y-3">
                {(addon.contactWhatsApp || devProfile?.whatsapp || addon.contactEmail || devProfile?.supportEmail) && (
                  <a
                    href={addon.contactWhatsApp || devProfile?.whatsapp
                      ? `https://wa.me/${(addon.contactWhatsApp || devProfile?.whatsapp).replace(/[^0-9]/g, '')}`
                      : `mailto:${addon.contactEmail || devProfile?.supportEmail}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="btn-shimmer w-full h-12 text-base font-semibold bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl shadow-md hover:shadow-lg transition-all">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Contactar developer
                    </Button>
                  </a>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-slate-500 text-center">Otras opciones de contacto:</p>
                  <ContactButtons
                    whatsapp={addon.contactWhatsApp || devProfile?.whatsapp}
                    email={addon.contactEmail || devProfile?.supportEmail}
                    website={addon.website || devProfile?.website}
                    addonId={addon.id}
                    size="sm"
                  />
                </div>

                {devProfile && devProfileUrl && (
                  <Link to={devProfileUrl} className="block">
                    <Button variant="outline" className="w-full h-10 rounded-xl border-slate-300">
                      <User className="w-4 h-4 mr-2" />
                      Ver perfil del developer
                    </Button>
                  </Link>
                )}
              </div>

              {/* Technical info */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">Información técnica</h3>
                <div className="space-y-4">

                  {manufacturerDisplay && (
                    <div className="flex items-start gap-3">
                      <Package className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Ecosistema</div>
                        <div className="text-sm font-medium text-slate-900">{manufacturerDisplay}</div>
                      </div>
                    </div>
                  )}

                  {systemDisplay && (
                    <div className="flex items-start gap-3">
                      <Package className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Sistema</div>
                        <div className="text-sm font-medium text-slate-900">{systemDisplay}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Publicado</div>
                      <div className="text-sm font-medium text-slate-900">
                        {new Date(addon.created_date).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>

                  {addon.vendor && (
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Desarrollado por</div>
                        <div className="text-sm font-medium text-slate-900">{addon.vendor}</div>
                      </div>
                    </div>
                  )}

                  {addon.tags?.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-2">Clasificación</div>
                      <div className="flex flex-wrap gap-1.5">
                        {addon.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs border-slate-300 text-slate-600">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>

          {/* ── LEFT COLUMN (gallery + content) ── */}
          <div className="lg:col-span-2 lg:order-1 space-y-8">

            {/* Gallery */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Main image */}
              <div className="aspect-video bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 flex items-center justify-center">
                {mainImage ? (
                  <img src={mainImage} alt={addon.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-300">
                    <Package className="w-16 h-16" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
              </div>
              {/* Thumbnails — only when there are multiple images */}
              {galleryImages.length > 1 && (
                <div className="flex gap-2 p-3 border-t border-slate-100 overflow-x-auto">
                  {galleryImages.slice(0, 5).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(img)}
                      className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        (activeImage || galleryImages[0]) === img
                          ? 'border-indigo-500 opacity-100'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`${addon.name} ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Descripción del add-on</h2>

              {addon.summary && (
                <p className="text-lg text-slate-700 leading-relaxed mb-6" style={{ lineHeight: '1.75' }}>
                  {addon.summary}
                </p>
              )}

              {addon.description && (
                <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap" style={{ lineHeight: '1.8' }}>
                  {addon.description}
                </div>
              )}

              {!addon.description && !addon.summary && (
                <p className="text-sm text-slate-400 italic">El developer aún no ha añadido una descripción.</p>
              )}

              {/* Value props — only when there's enough content to warrant them */}
            </div>

            {/* Videos — all valid YouTube links */}
            {embedVideos.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Play className="w-6 h-6 text-slate-500" />
                  {embedVideos.length === 1 ? 'Video demostrativo' : `Videos demostrativos (${embedVideos.length})`}
                </h2>
                <div className="space-y-6">
                  {embedVideos.map((src, i) => (
                    <div key={i} className="aspect-video rounded-xl overflow-hidden bg-slate-100">
                      <iframe
                        src={src}
                        className="w-full h-full"
                        allowFullScreen
                        title={`Video demostrativo ${embedVideos.length > 1 ? i + 1 : ''}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Developer card */}
            {devProfile && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Sobre el desarrollador</h2>
                </div>
                <DeveloperCard profile={devProfile} />
              </div>
            )}

            {/* Ratings & reviews */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Reseñas</h2>
                {ratingSummary && ratingSummary.totalCount > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-900">{ratingSummary.avgRating?.toFixed(1)}</span>
                    <span className="text-sm text-slate-500">· {ratingSummary.totalCount} reseña{ratingSummary.totalCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {ratingLoading ? (
                <div className="flex items-center gap-2 text-slate-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Cargando reseñas…</span>
                </div>
              ) : (
                <>
                  <form onSubmit={handleRatingSubmit} className="mb-8 pb-8 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      {ratingSummary?.myRating ? 'Tu calificación' : 'Califica este add-on'}
                    </p>
                    <RatingStars value={myRatingValue} onChange={setMyRatingValue} size="lg" />
                    <Textarea
                      className="mt-4 resize-none text-sm"
                      placeholder="Comentario opcional…"
                      rows={3}
                      value={myRatingComment}
                      onChange={(e) => setMyRatingComment(e.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={savingRating || !myRatingValue}
                      className="mt-3 bg-[#4F46E5] hover:bg-[#4338CA]"
                      size="sm"
                    >
                      {savingRating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {ratingSummary?.myRating ? 'Actualizar calificación' : 'Guardar calificación'}
                    </Button>
                  </form>

                  {ratingSummary?.lastRatings?.length > 0 ? (
                    <div className="space-y-4">
                      {ratingSummary.lastRatings.map((r, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <RatingStars value={r.score} size="sm" readonly />
                            <span className="text-xs text-slate-400">
                              {new Date(r.createdAt).toLocaleDateString('es-MX')}
                            </span>
                          </div>
                          {r.comment && (
                            <p className="text-sm text-slate-600 leading-relaxed">{r.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Este add-on aún no tiene reseñas.</p>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
