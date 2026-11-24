import React from 'react';
import { Package, User, Link2, Star, MessageCircle } from 'lucide-react';

export default function PreviewPanel() {
  return (
    <div className="relative">
      {/* Browser chrome frame */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Browser bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="flex-1 bg-white rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-400 ml-2 truncate">
            marketpaq.com/AddonsCatalog
          </div>
        </div>

        {/* Content */}
        <div className="p-4 bg-slate-50/50 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Catálogo de Add-ons
          </p>

          {/* 2 mini addon cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-14 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-slate-800 truncate">Cobranza Automática</p>
                <span className="inline-block mt-1 text-[9px] bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-semibold">
                  CONTPAQi
                </span>
                <div className="flex items-center gap-0.5 mt-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-2 h-2 ${s <= 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-14 bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-slate-800 truncate">Control de Mesas</p>
                <span className="inline-block mt-1 text-[9px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-semibold">
                  SoftRestaurant
                </span>
                <div className="flex items-center gap-0.5 mt-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-2 h-2 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Developer mini card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-800">@javier.morales</p>
                <p className="text-[9px] text-slate-500">5 add-ons publicados</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] bg-slate-100 text-slate-400 rounded-lg px-2 py-1 font-medium cursor-not-allowed select-none">
              <MessageCircle className="w-2.5 h-2.5" />
              Contactar
            </div>
          </div>

          {/* Partner Líder join chip */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-3 h-3 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-indigo-700">Invitación Partner Líder</p>
              <p className="text-[10px] text-indigo-500 font-mono">/join/MPL-XC4K2</p>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative blurs */}
      <div className="absolute -bottom-6 -right-6 w-36 h-36 bg-blue-200/25 rounded-full blur-2xl -z-10 pointer-events-none" />
      <div className="absolute -top-6 -left-6 w-28 h-28 bg-purple-200/25 rounded-full blur-2xl -z-10 pointer-events-none" />
    </div>
  );
}
