import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';

const STATIC_PLACEHOLDERS = [
  { name: 'Add-on Cobranza Automática',    system: 'CONTPAQi',       tag: 'Cobranza',    bg: 'from-blue-50 to-blue-100',       iconCls: 'text-blue-400',    badgeCls: 'bg-blue-100 text-blue-700' },
  { name: 'Add-on Reportes Avanzados',     system: 'CONTPAQi',       tag: 'Reportes',    bg: 'from-blue-50 to-blue-100',       iconCls: 'text-blue-400',    badgeCls: 'bg-blue-100 text-blue-700' },
  { name: 'Add-on Facturación Express',    system: 'CONTPAQi',       tag: 'Facturación', bg: 'from-blue-50 to-blue-100',       iconCls: 'text-blue-400',    badgeCls: 'bg-blue-100 text-blue-700' },
  { name: 'Add-on Control de Mesas',       system: 'SoftRestaurant', tag: 'Operaciones', bg: 'from-emerald-50 to-emerald-100', iconCls: 'text-emerald-400', badgeCls: 'bg-emerald-100 text-emerald-700' },
  { name: 'Add-on Cierres de Turno',       system: 'SoftRestaurant', tag: 'Reportes',    bg: 'from-emerald-50 to-emerald-100', iconCls: 'text-emerald-400', badgeCls: 'bg-emerald-100 text-emerald-700' },
  { name: 'Add-on Gestión de Inventario',  system: 'SoftRestaurant', tag: 'Inventario',  bg: 'from-emerald-50 to-emerald-100', iconCls: 'text-emerald-400', badgeCls: 'bg-emerald-100 text-emerald-700' },
];

function getCoverGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    'from-indigo-100 to-violet-50', 'from-blue-100 to-cyan-50',
    'from-emerald-100 to-teal-50',  'from-amber-100 to-orange-50',
    'from-rose-100 to-pink-50',     'from-violet-100 to-purple-50',
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function formatPrice(price) {
  if (!price || price <= 0) return null;
  return price % 1 === 0 ? String(Math.round(price)) : price.toFixed(2);
}

function RealAddonCard({ addon, isAuth }) {
  const priceFormatted = formatPrice(addon.priceFrom);
  const systemLabel = addon.system || (addon.contpaqi ? 'CONTPAQi' : addon.softrestaurant ? 'SoftRestaurant' : 'General');
  const ecosystem = addon.manufacturer || (addon.contpaqi ? 'CONTPAQi' : addon.softrestaurant ? 'SoftRestaurant' : null);
  const ecosystemCls = ecosystem === 'CONTPAQi'
    ? 'bg-blue-100 text-blue-700'
    : ecosystem === 'SoftRestaurant'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-600';

  const inner = (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
      {/* Cover */}
      <div className={`relative h-28 bg-gradient-to-br ${getCoverGradient(addon.name)} overflow-hidden`}>
        {addon.coverImage
          ? <img src={addon.coverImage} alt={addon.name} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-10 h-10 text-slate-400/50" />
            </div>
        }
        {priceFormatted && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
            ${priceFormatted}
          </div>
        )}
        {!isAuth && (
          <div className="absolute inset-0 backdrop-blur-[1px] bg-white/10 flex items-end justify-end p-2">
            <span className="bg-white/90 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Regístrate para ver
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1">{addon.name}</h3>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {ecosystem && (
            <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${ecosystemCls}`}>{ecosystem}</span>
          )}
          {addon.tags?.[0] && (
            <span className="text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 font-medium">{addon.tags[0]}</span>
          )}
        </div>
        {addon.summary && (
          <p className="text-xs text-slate-500 line-clamp-2 flex-1">{addon.summary}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {priceFormatted ? `Desde $${priceFormatted} MXN` : 'Precio: consultar'}
          </span>
          {isAuth && (
            <span className="text-xs font-medium text-indigo-600 flex items-center gap-0.5">
              Ver <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (isAuth) {
    return (
      <Link to={createPageUrl('AddonDetail') + `?slug=${addon.slug}`} className="block h-full">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}

export default function FeaturedPlaceholders({ isAuth = false }) {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Addons.filter({ status: 'published' })
      .then(all => {
        const sorted = [...all].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setAddons(sorted.slice(0, 6));
      })
      .catch(() => setAddons([]))
      .finally(() => setLoading(false));
  }, []);

  const showReal = !loading && addons.length > 0;

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Add-ons disponibles</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {isAuth
              ? 'Los más recientes en el catálogo. Haz clic para ver todos los detalles.'
              : 'Crea tu cuenta gratis para ver el catálogo completo y contactar developers directamente.'}
          </p>
          {!isAuth && !loading && addons.length > 0 && (
            <p className="mt-2 text-xs text-slate-400 italic">Mostrando add-ons reales del marketplace.</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {showReal
              ? addons.map(addon => (
                  <RealAddonCard key={addon.id} addon={addon} isAuth={isAuth} />
                ))
              : STATIC_PLACEHOLDERS.map(item => (
                  <div key={item.name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className={`h-28 bg-gradient-to-br ${item.bg} flex items-center justify-center`}>
                      <Package className={`w-10 h-10 ${item.iconCls}`} />
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1">{item.name}</h3>
                      <div className="flex gap-2 flex-wrap">
                        <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${item.badgeCls}`}>{item.system}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 font-medium">{item.tag}</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Regístrate gratis para ver detalles
                      </p>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        <div className="text-center">
          {isAuth ? (
            <Link to={createPageUrl('AddonsCatalog')}>
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl">
                Ver catálogo completo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl"
              onClick={() => { window.location.href = '/Signup'; }}
            >
              Crear cuenta para ver el catálogo completo <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
