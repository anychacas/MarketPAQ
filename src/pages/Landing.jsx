import React, { useEffect, useState } from 'react';
import { createPageUrl } from "@/utils";
import { api } from '@/api/client';
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Users, Search, Rocket, Package,
  Lightbulb, ChevronDown, ChevronUp,
} from "lucide-react";
import PreviewPanel from "@/components/landing/PreviewPanel";
import ProofStrip from "@/components/landing/ProofStrip";
import RoleCards from "@/components/landing/RoleCards";
import FeaturedPlaceholders from "@/components/landing/FeaturedPlaceholders";
import CTABlock from "@/components/landing/CTABlock";
import { setDocTitle, setMetaTag, setOgTag, setCanonical, injectJsonLd, removeJsonLd } from '@/lib/seo';

const FAQ_ITEMS = [
  {
    q: '¿Necesito pagar para usar MarketPAQ?',
    a: 'No. Crear cuenta, explorar el catálogo y contactar developers es completamente gratis. La donación voluntaria (desde $20 MXN) ayuda a mantener la plataforma, pero no es obligatoria.',
  },
  {
    q: '¿Qué es un Partner y qué es un Partner Líder?',
    a: 'Un Partner es el usuario principal de MarketPAQ: accede al catálogo, contacta developers y evalúa add-ons. Un Partner Líder es un Partner que gestiona su propia red de Partners — tiene un código único (/join/:code) y un dashboard "Mi Red" con estadísticas de su canal.',
  },
  {
    q: '¿Cómo contacto al developer de un add-on?',
    a: 'Cada add-on en el catálogo muestra el perfil del developer. Desde ahí puedes contactarlo directamente: el contacto es personal, sin intermediarios ni comisiones de la plataforma.',
  },
  {
    q: '¿Puedo publicar add-ons gratis como Developer?',
    a: 'Sí. Crear cuenta como Developer y publicar add-ons es completamente gratis. No existe paywall ni aportación obligatoria para publicar.',
  },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section className="py-20 bg-slate-50/60">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">
          Preguntas frecuentes
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-slate-50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-slate-800 pr-4 text-sm sm:text-base">{item.q}</span>
                {open === i
                  ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                }
              </button>
              {open === i && (
                <div className="bg-white px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    api.auth.isAuthenticated().then(setIsAuth);
  }, []);

  useEffect(() => {
    const TITLE = 'MarketPAQ | Marketplace de add-ons para CONTPAQi y SoftRestaurant';
    const DESC = 'MarketPAQ es el marketplace profesional de add-ons para CONTPAQi y SoftRestaurant. Descubre desarrolladores, soluciones y herramientas para el ecosistema.';
    const URL = 'https://marketpaq.com/';

    setDocTitle(TITLE);
    setMetaTag('description', DESC);
    setOgTag('og:title', 'MarketPAQ');
    setOgTag('og:description', DESC);
    setOgTag('og:type', 'website');
    setOgTag('og:url', URL);
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', 'MarketPAQ');
    setMetaTag('twitter:description', DESC);
    setCanonical(URL);

    injectJsonLd('faq-schema', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });

    return () => { removeJsonLd('faq-schema'); };
  }, []);

  const handleExploreClick = () => {
    if (isAuth) {
      window.location.href = createPageUrl("AddonsCatalog");
    } else {
      window.location.href = '/Signup';
    }
  };

  return (
    <div className="bg-white">
      {/* 1. HERO */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #EEF2FF 0%, #F5F3FF 25%, #FAFAFA 60%, #F8FAFC 100%)' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(79,70,229,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Decorative blobs */}
        <div className="absolute top-20 right-20 w-80 h-80 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-blue-200/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left: copy */}
            <div>
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 mb-6 animate-fade-in-up">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Hecho para distribuidores CONTPAQi y SoftRestaurant
              </div>

              <h1
                className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-5 animate-fade-in-up"
                style={{ animationDelay: '80ms' }}
              >
                El marketplace profesional de add-ons para{' '}
                <span className="text-blue-600">CONTPAQi</span>{' '}
                y{' '}
                <span className="text-orange-500">SoftRestaurant</span>
              </h1>

              <p
                className="text-lg text-slate-600 leading-relaxed mb-8 max-w-lg animate-fade-in-up"
                style={{ animationDelay: '160ms' }}
              >
                Catálogo especializado, contacto directo con developers y perfiles compartibles.
                Todo en un solo lugar.
              </p>

              <div
                className="flex flex-col sm:flex-row items-start gap-3 mb-6 animate-fade-in-up"
                style={{ animationDelay: '240ms' }}
              >
                <Button
                  size="lg"
                  className="btn-shimmer bg-[#4F46E5] hover:bg-[#4338CA] text-white h-12 px-7 text-base rounded-xl shadow-md"
                  onClick={handleExploreClick}
                >
                  Explorar add-ons <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-7 text-base rounded-xl border-slate-300"
                  onClick={() => { window.location.href = createPageUrl('Signup'); }}
                >
                  Crear cuenta gratis
                </Button>
              </div>

              <div
                className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 text-sm animate-fade-in-up"
                style={{ animationDelay: '320ms' }}
              >
                <a href="/Signup?role=partner" className="text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                  Soy Partner →
                </a>
                <a href="/Signup?role=developer" className="text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                  Soy Developer →
                </a>
                <a href="/Signup?role=partner_leader" className="text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                  Soy Partner Líder →
                </a>
              </div>

              <p className="text-xs text-slate-400">
                Enfocado en los ecosistemas CONTPAQi y SoftRestaurant.
              </p>
            </div>

            {/* Right: product preview (desktop only) */}
            <div className="hidden lg:block">
              <PreviewPanel />
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROOF STRIP */}
      <ProofStrip />

      {/* 3. CÓMO FUNCIONA */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Cómo funciona</h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              Tres pasos para conectar con el ecosistema de add-ons
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                bg: 'bg-blue-100',
                iconCls: 'text-blue-600',
                step: '01',
                title: 'Elige tu perfil',
                desc: 'Regístrate como Partner, Developer o Partner Líder según tu rol en el ecosistema.',
              },
              {
                icon: Search,
                bg: 'bg-green-100',
                iconCls: 'text-green-600',
                step: '02',
                title: 'Explora o publica',
                desc: 'Navega el catálogo especializado de add-ons o publica tu solución para llegar a Partners activos.',
              },
              {
                icon: Rocket,
                bg: 'bg-purple-100',
                iconCls: 'text-purple-600',
                step: '03',
                title: 'Conecta y crece',
                desc: 'Contacta developers directamente, deja reseñas y comparte invitaciones de Partner Líder.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-white rounded-2xl border border-slate-200 p-8 text-center hover:shadow-lg hover:border-indigo-100 transition-all overflow-hidden"
              >
                {/* Decorative step number */}
                <span className="absolute -top-3 right-3 text-8xl font-black text-slate-100 select-none pointer-events-none leading-none">
                  {item.step}
                </span>
                <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center mx-auto mb-5`}>
                  <item.icon className={`w-7 h-7 ${item.iconCls}`} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 tracking-widest mb-2">PASO {item.step}</p>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ROLE CARDS */}
      <RoleCards onExplore={handleExploreClick} />

      {/* 5. FEATURED PLACEHOLDERS */}
      <FeaturedPlaceholders isAuth={isAuth} />

      {/* 6. SISTEMAS SOPORTADOS */}
      <section className="py-24 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Sistemas soportados</h2>
            <p className="text-lg text-slate-600">
              MarketPAQ no es un marketplace genérico. Está construido exclusivamente para:
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">CONTPAQi</h3>
              <p className="text-slate-600 leading-relaxed">
                Add-ons y soluciones desarrolladas por la comunidad para el ecosistema CONTPAQi,
                el ERP más usado en México para contabilidad y facturación.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <Package className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">SoftRestaurant</h3>
              <p className="text-slate-600 leading-relaxed">
                Herramientas especializadas para restaurantes y negocios de alimentos
                que operan con SoftRestaurant.
              </p>
            </div>
          </div>
          <p className="text-center text-slate-500 mt-10 max-w-xl mx-auto text-sm">
            Un entorno profesional para quienes trabajan activamente con estos sistemas empresariales.
          </p>
        </div>
      </section>

      {/* 7. CENTRO DE MEJORAS */}
      <CTABlock
        icon={Lightbulb}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        heading="Centro de Mejoras"
        description="Vota por las funcionalidades que más necesitas o propón mejoras para el ecosistema. Tu voz construye la plataforma."
        ctaLabel="Crear cuenta para proponer y votar"
        ctaHref={createPageUrl('Signup')}
        note="Gratis. Requiere cuenta para participar."
        bg="bg-white"
      />

      {/* 8. FAQ */}
      <FAQ />
    </div>
  );
}
