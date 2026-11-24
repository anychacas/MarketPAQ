import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package, Star, Infinity, RefreshCw, Heart } from "lucide-react";
import SystemBadge from './SystemBadge';
import { api } from '@/api/client';

function formatPrice(price) {
  if (!price || price <= 0) return null;
  return price % 1 === 0 ? String(Math.round(price)) : price.toFixed(2);
}

function getCoverGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palettes = [
    'from-indigo-100 to-violet-50',
    'from-blue-100 to-cyan-50',
    'from-emerald-100 to-teal-50',
    'from-amber-100 to-orange-50',
    'from-rose-100 to-pink-50',
    'from-violet-100 to-purple-50',
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

// TODO: refactor data model to systems[] array so a single add-on can declare
// multiple systems and the card can display "XML +2" etc.
function getSystemLabel(addon) {
  if (addon.system) return addon.system;
  if (addon.contpaqi) return 'CONTPAQi (general)';
  if (addon.softrestaurant) return 'SoftRestaurant (general)';
  return 'General';
}

export default function AddonCard({ addon, developer, hasContact, isFavorite, onToggleFavorite }) {
  const [ratingInfo, setRatingInfo] = useState(null);

  useEffect(() => {
    if (!addon?.id) return;
    api.functions.invoke('getAddonRatingSummary', { addonId: addon.id })
      .then(({ data }) => setRatingInfo(data))
      .catch(err => console.error('[AddonCard] rating fetch failed', err));
  }, [addon?.id]);

  const priceFormatted = formatPrice(addon.priceFrom);

  return (
    <Link
      to={createPageUrl("AddonDetail") + `?slug=${addon.slug}`}
      className="group block"
    >
      <div className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.04),0_12px_32px_rgba(79,70,229,0.10)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden h-full flex flex-col">
        {/* Cover image or placeholder */}
        <div className="relative w-full h-40 border-b border-slate-100 overflow-hidden">
          {/* Gradient background — always visible, image overlays it */}
          <div className={`absolute inset-0 bg-gradient-to-br ${getCoverGradient(addon.name)}`} />
          {addon.coverImage
            ? <img src={addon.coverImage} alt={addon.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <div className="absolute inset-0 flex items-center justify-center">
                <Package className="w-12 h-12 text-slate-400/60" />
              </div>
          }
          {/* Price badge */}
          {priceFormatted && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100 shadow-sm">
              ${priceFormatted}
            </div>
          )}
          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(addon.id); }}
              className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors"
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400 hover:text-red-400'}`} />
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1">
          {/* Title & badges */}
          <div className="mb-3">
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-1">
              {addon.name}
            </h3>
            <div className="flex gap-2 items-center flex-wrap mb-2">
              {/* Ecosistema */}
              <SystemBadge contpaqi={addon.contpaqi} softrestaurant={addon.softrestaurant} />
              {/* Sistema */}
              <Badge variant="secondary" className="text-xs text-slate-500 bg-slate-50 border border-slate-200">
                {getSystemLabel(addon)}
              </Badge>
              {/* Clasificación */}
              {addon.tags && addon.tags.length > 0 && (
                <Badge variant="secondary" className="text-xs text-slate-600 bg-slate-100 border-0">
                  {addon.tags[0]}
                </Badge>
              )}
            </div>
            {developer && (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-slate-500">por {developer}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 leading-relaxed mb-3 flex-1 line-clamp-2">
            {addon.summary || 'Sin descripción disponible'}
          </p>

          {/* Rating display — pointer-events-none so the Link captures clicks */}
          <div className="flex items-center gap-1 mb-3 pointer-events-none" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className={`w-4 h-4 ${s <= Math.round(ratingInfo?.avgRating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
              />
            ))}
            <span className="text-xs text-slate-500 ml-1">
              {ratingInfo === null
                ? ''
                : ratingInfo.totalCount > 0
                  ? `${Number(ratingInfo.avgRating).toFixed(1)} · ${ratingInfo.totalCount} ${ratingInfo.totalCount === 1 ? 'reseña' : 'reseñas'}`
                  : 'Sin reseñas aún'}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-700">
                {priceFormatted
                  ? <>Desde <span className="text-indigo-600">${priceFormatted} MXN</span></>
                  : <>Precio: <span className="text-indigo-600">consultar</span></>
                }
              </div>
              {Array.isArray(addon.licenseType) && addon.licenseType.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {addon.licenseType.map(lt => (
                    <span key={lt} className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                      lt === 'vitalicia' ? 'bg-emerald-50 text-emerald-700'
                      : lt === 'anual'   ? 'bg-amber-50 text-amber-700'
                      :                   'bg-blue-50 text-blue-700'
                    }`}>
                      {lt === 'vitalicia'
                        ? <><Infinity className="w-3 h-3" /> Vitalicia</>
                        : lt === 'mensual'
                          ? <><RefreshCw className="w-3 h-3" /> Mensual</>
                          : <><RefreshCw className="w-3 h-3" /> Anual</>
                      }
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {hasContact && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Contactar
                </span>
              )}
              <div className="inline-flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700 transition-colors">
                Ver detalle <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
