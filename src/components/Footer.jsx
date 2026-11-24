import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";

// Public contact number (digits only, with country code). Link hidden when unset.
const CONTACT_WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '');

export default function Footer() {
  return (
    <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-800 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Columna 1 - MarketPaq */}
          <div>
            <div className="inline-flex items-center justify-center bg-white rounded-xl px-4 py-2 mb-4">
              <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-8 w-auto" />
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Marketplace profesional de add-ons para ecosistemas CONTPAQi y SoftRestaurant.
            </p>
          </div>

          {/* Columna 2 - Comunidad */}
          <div>
            <h3 className="text-zinc-100 font-semibold mb-3">Comunidad</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={createPageUrl("AddonsCatalog")} className="hover:text-indigo-400 transition-colors">
                  Explorar Add-ons
                </Link>
              </li>
              <li>
                <Link to="/Signup?role=partner" className="hover:text-indigo-400 transition-colors">
                  Soy Partner
                </Link>
              </li>
              <li>
                <Link to="/Signup?role=developer" className="hover:text-indigo-400 transition-colors">
                  Soy Developer
                </Link>
              </li>
              <li>
                <Link to="/Signup?role=partner_leader" className="hover:text-indigo-400 transition-colors">
                  Soy Partner Líder
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("FeatureRequests")} className="hover:text-indigo-400 transition-colors">
                  Centro de mejoras
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-8 pt-6 text-center text-sm text-zinc-600">
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-6" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
            <span>Desarrollado por</span>
            <a
              href="https://www.fixitcomputacion.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              FIX-IT Computación
            </a>
            {CONTACT_WHATSAPP && (
              <>
                <span className="hidden sm:inline">•</span>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Contacto desarrollador
                </a>
              </>
            )}
            <span className="hidden sm:inline">•</span>
            <Link to="/Privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Aviso de privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}