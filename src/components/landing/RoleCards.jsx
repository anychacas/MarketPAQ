import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';

const ROLES = [
  {
    key: 'partner',
    label: 'Partner',
    headerBg: 'bg-blue-600',
    description: 'Accede a soluciones listas para ofrecer a tus clientes.',
    bullets: [
      'Catálogo especializado de add-ons por sistema',
      'Contacto directo con el developer',
      'Información clara de precios y características',
      'Soluciones verificadas y organizadas en un solo lugar',
    ],
    cta: 'Crear cuenta como Partner',
    ctaHref: '/Signup?role=partner',
    bulletColor: 'text-blue-600',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white border-0',
  },
  {
    key: 'developer',
    label: 'Developer',
    headerBg: 'bg-green-600',
    description: 'Publica tus add-ons y construye presencia profesional.',
    bullets: [
      'Incluye todo lo de Partner',
      'Publica add-ons en el catálogo especializado',
      'Perfil público compartible con tu historial',
      'Llega a Partners que buscan soluciones activamente',
    ],
    cta: 'Crear cuenta para publicar',
    ctaHref: '/Signup?role=developer',
    bulletColor: 'text-green-600',
    btnClass: 'bg-green-600 hover:bg-green-700 text-white border-0',
  },
  {
    key: 'partner_leader',
    label: 'Partner Líder',
    headerBg: 'bg-indigo-600',
    description: 'Gestiona tu red de Partners con herramientas dedicadas.',
    bullets: [
      'Incluye todo lo de Partner y Developer',
      'Código único para gestionar tu red (/join/:code)',
      'Dashboard "Mi Red" con estadísticas del canal',
      'QR compartible para incorporar nuevos Partners',
    ],
    cta: 'Crear cuenta como Partner Líder',
    ctaHref: '/Signup?role=partner_leader',
    bulletColor: 'text-indigo-600',
    btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white border-0',
  },
];

export default function RoleCards({ onExplore }) {
  return (
    <section className="py-24 bg-slate-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Elige tu rol</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            MarketPAQ está diseñado para tres tipos de usuarios profesionales
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {ROLES.map((role) => (
            <div
              key={role.key}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className={`${role.headerBg} px-6 py-5`}>
                <h3 className="text-xl font-bold text-white">{role.label}</h3>
                <p className="text-sm mt-1 text-white/80">{role.description}</p>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {role.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 ${role.bulletColor} flex-shrink-0 mt-0.5`} />
                      <span className="text-sm text-slate-700">{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <Button
                    className={`w-full ${role.btnClass}`}
                    onClick={() => { window.location.href = role.ctaHref; }}
                  >
                    {role.cta} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
