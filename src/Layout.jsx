import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { api } from '@/api/client';
import { Menu, X, LogOut, Package, LayoutDashboard, PlusCircle, Shield, Loader2, UserCircle, Lightbulb, Users, UserCheck, UserCog, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { isDeveloper, needsOnboarding, canPublish } from '@/components/access';
import { canAccessAdminPanel } from '@/components/permissions';
import Footer from '@/components/Footer';

const publicPages = ["Landing"];

// Public contact number (digits only, with country code).
const CONTACT_WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '');

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsMobileOpen, setToolsMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ── Page-view tracking ────────────────────────────────────────────────────
  useEffect(() => {
    api.functions.invoke('logVisit', {
      path: location.pathname + location.search,
      fullUrl: window.location.href,
      referrer: document.referrer || undefined,
      eventType: 'page_view',
    }).catch(() => {/* silent */})
  }, [location.pathname, location.search])

  useEffect(() => {
    async function loadUser() {
      try {
        const isAuth = await api.auth.isAuthenticated();
        if (isAuth) {
          const { data } = await api.functions.invoke('ensureExtendedUser');
          if (data && data.success) {
            setUser(data.user);

            // ── Hardcore email-verification gate ────────────────────────────
            if (!data.user.emailVerified) {
              if (location.pathname !== '/VerifyEmail') {
                navigate(createPageUrl('VerifyEmail'));
              }
              return;
            }

            const isOnboardingPath = location.pathname.startsWith('/onboarding');
            const isCatalogPath = location.pathname === '/AddonsCatalog';

            // Redirect to onboarding if not complete (except catalog which is accessible)
            if (!isOnboardingPath && !isCatalogPath && needsOnboarding(data.user)) {
              navigate(createPageUrl('OnboardingRole'));
              return;
            }

            // Redirect from landing to addons if onboarded
            if (location.pathname === '/' && !needsOnboarding(data.user)) {
              navigate(createPageUrl('AddonsCatalog'));
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [location.pathname]);

  const isPublic = publicPages.includes(currentPageName);
  const isDev = isDeveloper(user);
  const isAdmin = canAccessAdminPanel(user);
  
  const [devProfile, setDevProfile] = useState(null);
  const [canPublishAddons, setCanPublishAddons] = useState(false);
  
  useEffect(() => {
    async function checkPublishAccess() {
      if (isDev) {
        const profiles = await api.entities.DeveloperProfiles.filter({ userId: user.id });
        if (profiles.length > 0) {
          setDevProfile(profiles[0]);
          const { isProfileComplete } = await import('@/components/helpers');
          const status = isProfileComplete(profiles[0]);
          setCanPublishAddons(status.complete);
        }
      }
    }
    if (user) {
      checkPublishAccess();
    }
  }, [user, isDev]);

  const isActive = (pageName) => currentPageName === pageName;
  const navLink = (pageName) =>
    isActive(pageName)
      ? 'text-indigo-600 bg-indigo-50'
      : 'text-slate-600 hover:text-slate-900';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <style>{`
        :root {
          --accent: #2563EB;
          --accent-light: #3b82f6;
        }
      `}</style>

      <nav className={`sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-shadow duration-200 ${scrolled ? 'shadow-[0_1px_12px_rgba(0,0,0,0.06)]' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl("Landing")} className="flex items-center">
              <img src="/marketpaq-logo.png" alt="MarketPaq" className="h-10 w-auto" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {user ? (
                <>
                  <Link to={createPageUrl("AddonsCatalog")}>
                    <Button variant="ghost" size="sm" className={navLink('AddonsCatalog')}>
                      <Package className="w-4 h-4 mr-1.5" /> Add-ons
                    </Button>
                  </Link>
                  <Link to={createPageUrl("Dashboard")}>
                    <Button variant="ghost" size="sm" className={navLink('Dashboard')}>
                      <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
                    </Button>
                  </Link>
                  <Link to={createPageUrl("FeatureRequests")}>
                    <Button variant="ghost" size="sm" className={navLink('FeatureRequests')}>
                      <Lightbulb className="w-4 h-4 mr-1.5" /> Centro de mejoras
                    </Button>
                  </Link>
                  <Link to={createPageUrl("ProfileSettings")}>
                    <Button variant="ghost" size="sm" className={navLink('ProfileSettings')}>
                      <UserCircle className="w-4 h-4 mr-1.5" /> Editar perfil
                    </Button>
                  </Link>
                  {canPublish(user) && (
                    canPublishAddons ? (
                      <Link to={createPageUrl("PublishAddon")}>
                        <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                          <PlusCircle className="w-4 h-4 mr-1.5" /> Publicar
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-slate-400 cursor-not-allowed" disabled title="Completa tu perfil para publicar">
                        <PlusCircle className="w-4 h-4 mr-1.5" /> Publicar
                      </Button>
                    )
                  )}
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                          <Shield className="w-4 h-4 mr-1.5" /> Herramientas
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("AdminAddons")} className="flex items-center gap-2 cursor-pointer">
                            <Package className="w-4 h-4 text-purple-600" /> Gestionar Add-ons
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("AdminPartners")} className="flex items-center gap-2 cursor-pointer">
                            <Users className="w-4 h-4 text-indigo-600" /> Gestionar Partners
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("AdminDevelopers")} className="flex items-center gap-2 cursor-pointer">
                            <UserCheck className="w-4 h-4 text-blue-600" /> Gestionar Developers
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("AdminUsers")} className="flex items-center gap-2 cursor-pointer">
                            <UserCog className="w-4 h-4 text-slate-600" /> Usuarios
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("AdminVisitLogs")} className="flex items-center gap-2 cursor-pointer">
                            <BookOpen className="w-4 h-4 text-teal-600" /> Bitácora
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div className="w-px h-6 bg-slate-200 mx-2" />
                  <span className="text-sm text-slate-500 mr-2">{user.full_name || user.email}</span>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" onClick={() => { api.auth.logout('/Login'); }}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => window.location.href = '/Login'}>
                    Entrar
                  </Button>
                  <Button size="sm" className="btn-shimmer bg-[#4F46E5] hover:bg-[#4338CA] text-white ml-1" onClick={() => window.location.href = '/Signup'}>
                    Crear cuenta
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link to={createPageUrl("AddonsCatalog")} className="block py-2 text-slate-700" onClick={() => setMenuOpen(false)}>Add-ons</Link>
                <Link to={createPageUrl("Dashboard")} className="block py-2 text-slate-700" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <Link to={createPageUrl("FeatureRequests")} className="block py-2 text-slate-700" onClick={() => setMenuOpen(false)}>Centro de mejoras</Link>
                <Link to={createPageUrl("ProfileSettings")} className="block py-2 text-slate-700" onClick={() => setMenuOpen(false)}>Editar perfil</Link>
                {canPublish(user) && (
                  canPublishAddons ? (
                    <Link to={createPageUrl("PublishAddon")} className="block py-2 text-slate-700" onClick={() => setMenuOpen(false)}>Publicar</Link>
                  ) : (
                    <span className="block py-2 text-slate-400">Publicar (requiere perfil completo)</span>
                  )
                )}
                {isAdmin && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-2 py-2 text-slate-700 w-full text-left"
                      onClick={() => setToolsMobileOpen(v => !v)}
                    >
                      <Shield className="w-4 h-4 text-purple-600" />
                      Herramientas
                      <span className="ml-auto text-slate-400">{toolsMobileOpen ? '▾' : '▸'}</span>
                    </button>
                    {toolsMobileOpen && (
                      <div className="pl-6 space-y-0.5">
                        <Link to={createPageUrl("AdminAddons")} className="flex items-center gap-2 py-2 text-slate-600" onClick={() => setMenuOpen(false)}>
                          <Package className="w-3.5 h-3.5 text-purple-500" /> Gestionar Add-ons
                        </Link>
                        <Link to={createPageUrl("AdminPartners")} className="flex items-center gap-2 py-2 text-slate-600" onClick={() => setMenuOpen(false)}>
                          <Users className="w-3.5 h-3.5 text-indigo-500" /> Gestionar Partners
                        </Link>
                        <Link to={createPageUrl("AdminDevelopers")} className="flex items-center gap-2 py-2 text-slate-600" onClick={() => setMenuOpen(false)}>
                          <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Gestionar Developers
                        </Link>
                        <Link to={createPageUrl("AdminUsers")} className="flex items-center gap-2 py-2 text-slate-600" onClick={() => setMenuOpen(false)}>
                          <UserCog className="w-3.5 h-3.5 text-slate-500" /> Usuarios
                        </Link>
                        <Link to={createPageUrl("AdminVisitLogs")} className="flex items-center gap-2 py-2 text-slate-600" onClick={() => setMenuOpen(false)}>
                          <BookOpen className="w-3.5 h-3.5 text-teal-500" /> Bitácora
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                <button className="block py-2 text-red-500 w-full text-left" onClick={() => { api.auth.logout('/Login'); }}>Cerrar sesión</button>
              </>
            ) : (
              <>
                <button className="block py-2 text-slate-700 w-full text-left" onClick={() => window.location.href = '/Login'}>Entrar</button>
                <button className="block py-2 text-indigo-600 font-medium w-full text-left" onClick={() => window.location.href = '/Signup'}>Crear cuenta</button>
              </>
            )}
          </div>
        )}
      </nav>

      <main className="flex-grow">{children}</main>

      {/* WhatsApp floating button (hidden when VITE_CONTACT_WHATSAPP is unset) */}
      {CONTACT_WHATSAPP && (
      <a
        href={`https://wa.me/${CONTACT_WHATSAPP}?text=Hola%20MarketPaq%2C%20quiero%20informaci%C3%B3n%20sobre%20add-ons%20para%20CONTPAQi%2FSoftRestaurant`}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg transition-transform hover:scale-110"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.126 1.527 5.864L.057 23.882l6.162-1.616A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 0 1-5.002-1.372l-.359-.213-3.718.975.993-3.627-.234-.373A9.778 9.778 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
      </a>
      )}

      <Footer />
    </div>
  );
}