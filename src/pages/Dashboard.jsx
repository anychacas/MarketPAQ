import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, User, PlusCircle, Loader2, Shield, CheckCircle2, Clock, XCircle, Copy, Eye, Edit, ExternalLink, BarChart2, MessageCircle, Users, Star, Link2, LayoutGrid, Trash2 } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import RatingStars from '@/components/RatingStars';
import { isProfileComplete } from '@/components/helpers';
import { isDeveloper, canPublish } from '@/components/access';
import { canAccessAdminPanel } from '@/components/permissions';
import { toast } from 'sonner';
import { useNoIndex } from '@/lib/useNoIndex';

export default function Dashboard() {
  useNoIndex();
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function getDefaultTab(u) {
  if (canAccessAdminPanel(u)) return 'admin';
  if (u?.userType === 'partner_leader' && u?.partnerLeaderCode) return 'canal';
  if (isDeveloper(u)) return 'addons';
  return 'explorar';
}

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [devProfile, setDevProfile] = useState(null);
  const [myAddons, setMyAddons] = useState([]);
  const [pendingAddons, setPendingAddons] = useState([]);
  const [approvedAddons, setApprovedAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addonStats, setAddonStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [distributorStats, setDistributorStats] = useState(null);
  const [distStatsLoading, setDistStatsLoading] = useState(false);
  const [myAddonRatings, setMyAddonRatings] = useState([]);
  const [myDevRatings, setMyDevRatings] = useState([]);
  const [myRatingsLoading, setMyRatingsLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState(null);
  const [channelSummary, setChannelSummary] = useState(null);
  const [channelPartners, setChannelPartners] = useState([]);
  const [showAllPartners, setShowAllPartners] = useState(false);
  const [networkPeriod, setNetworkPeriod] = useState(30);
  const [channelTab, setChannelTab] = useState('invitar');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [addonsFilter, setAddonsFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(null);
  const [adminViewAll, setAdminViewAll] = useState(false);
  const [deletingAddonId, setDeletingAddonId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    async function load() {
      const u = await api.auth.me();
      setUser(u);

      // Restore persisted tab or fall back to role default
      const storageKey = `mpq:dashboardTab:${u.id}`;
      const savedTab = localStorage.getItem(storageKey);
      const preValidTabs = ['explorar'];
      if (u.userType === 'partner_leader' && u.partnerLeaderCode) preValidTabs.push('canal');
      if (isDeveloper(u)) preValidTabs.push('addons');
      if (canAccessAdminPanel(u)) preValidTabs.push('admin');
      setActiveTab(savedTab && preValidTabs.includes(savedTab) ? savedTab : getDefaultTab(u));

      const admin = canAccessAdminPanel(u);
      const dev = isDeveloper(u);
      const partner = u?.userType === 'partner';
      const showPartnerPanel = admin || dev || partner;

      // Fire parallel fetches after resolving user
      const fetches = [];

      if (dev) {
        fetches.push(
          api.entities.DeveloperProfiles.filter({ userId: u.id }).then(profiles => {
            setDevProfile(profiles[0] ?? null);
          })
        );
        fetches.push(
          api.entities.Addons.filter({ ownerUserId: u.id }).then(addons => {
            setMyAddons(addons);
          })
        );
        setStatsLoading(true);
        fetches.push(
          api.functions.invoke('getDeveloperAddonStats').then(({ data }) => {
            setAddonStats(data);
          }).catch(err => {
            console.error('[Dashboard] getDeveloperAddonStats failed', err);
          }).finally(() => setStatsLoading(false))
        );
      }

      if (showPartnerPanel) {
        setDistStatsLoading(true);
        fetches.push(
          api.functions.invoke('getDistributorAddonStats').then(({ data }) => {
            setDistributorStats(data);
          }).catch(err => {
            console.error('[Dashboard] getDistributorAddonStats failed', err);
          }).finally(() => setDistStatsLoading(false))
        );
      }

      if (admin) {
        fetches.push(
          api.entities.Addons.filter({ status: 'pending' }).then(p => setPendingAddons(p))
        );
        fetches.push(
          api.entities.Addons.filter({ status: 'published' }, '-updated_date', 10).then(a => setApprovedAddons(a))
        );
      }

      setMyRatingsLoading(true);
      fetches.push(
        Promise.all([
          api.functions.invoke('getMyAddonRatings'),
          api.functions.invoke('getMyDeveloperRatings'),
        ]).then(([addonResp, devResp]) => {
          setMyAddonRatings(addonResp.data?.ratings ?? []);
          setMyDevRatings(devResp.data?.ratings ?? []);
        }).catch(err => {
          console.error('[Dashboard] getMy*Ratings failed', err);
        }).finally(() => setMyRatingsLoading(false))
      );

      await Promise.all(fetches);
      setLoading(false);
    }
    load();
  }, []);

  const loadChannelData = () => {
    setChannelLoading(true);
    setChannelError(null);
    api.functions.invoke('getMyPartnerChannel')
      .then(({ data }) => {
        setChannelSummary(data?.summary ?? null);
        setChannelPartners(data?.partners ?? []);
      })
      .catch(err => {
        console.error('[Dashboard] getMyPartnerChannel failed', err);
        const status = err?.response?.status ?? err?.status ?? err?.statusCode;
        setChannelError(status === 403 || status === 400 ? 'forbidden' : 'network');
      })
      .finally(() => setChannelLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    if (!(user.userType === 'partner_leader' && !!user.partnerLeaderCode)) return;
    loadChannelData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: if activeTab points to a tab that no longer exists, reset to default.
  // Runs in an effect to avoid calling setState during render.
  useEffect(() => {
    if (!user || activeTab === null) return;
    const validIds = ['explorar'];
    if (user.userType === 'partner_leader' && user.partnerLeaderCode) validIds.push('canal');
    if (isDeveloper(user)) validIds.push('addons');
    if (myRatingsLoading || myAddonRatings.length > 0 || myDevRatings.length > 0) validIds.push('ratings');
    if (canAccessAdminPanel(user)) validIds.push('admin');
    if (!validIds.includes(activeTab)) {
      setActiveTab(getDefaultTab(user));
    }
  }, [user, activeTab, myRatingsLoading, myAddonRatings, myDevRatings]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyProfileLink = () => {
    const handle = user?.developerHandle || devProfile?.developerHandle;
    if (!handle) return;
    const url = `${window.location.origin}/DevProfile?handle=${handle}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprobado</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDeleteAddon = async (addonId) => {
    setDeletingAddonId(addonId);
    try {
      await api.entities.Addons.delete(addonId);
      setMyAddons(prev => prev.filter(a => a.id !== addonId));
      toast.success('Add-on eliminado correctamente');
    } catch {
      toast.error('No se pudo eliminar el add-on');
    } finally {
      setDeletingAddonId(null);
      setConfirmDeleteId(null);
    }
  };

  if (loading || activeTab === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="h-10 bg-slate-200 rounded-xl w-48 animate-pulse" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-9 w-28 bg-slate-200 rounded-full animate-pulse" />)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="h-6 bg-slate-200 rounded w-40 animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border border-slate-100 rounded-lg">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-slate-100 rounded w-2/3 animate-pulse" />
              </div>
              <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isDev = isDeveloper(user);
  const isAdmin = canAccessAdminPanel(user);
  const isPartnerUser = user?.userType === 'partner';
  const isApprovedLeader = user?.userType === 'partner_leader' && !!user?.partnerLeaderCode;
  const profileStatus = isDev ? isProfileComplete(devProfile) : null;
  const userCanPublish = canPublish(user) && profileStatus?.complete;
  const developerHandle = user?.developerHandle || devProfile?.developerHandle || null;
  const showRatings = myRatingsLoading || myAddonRatings.length > 0 || myDevRatings.length > 0;

  // ── Build tab list (icon + optional badge) ─────────────────────────────────
  const tabs = [];
  if (isApprovedLeader) tabs.push({
    id: 'canal', label: 'Tu canal', icon: Link2,
    badge: channelSummary != null ? channelSummary.totalPartners : null,
  });
  if (isDev) tabs.push({
    id: 'addons', label: 'Tus add-ons', icon: Package,
    badge: myAddons.length,
  });
  tabs.push({
    id: 'explorar', label: 'Explorar', icon: BarChart2,
    badge: distributorStats ? distributorStats.totalAddons : null,
  });
  if (showRatings) tabs.push({
    id: 'ratings', label: 'Calificaciones', icon: Star,
    badge: (myAddonRatings.length + myDevRatings.length) || null,
  });
  if (isAdmin) tabs.push({
    id: 'admin', label: 'Administración', icon: Shield,
    badge: pendingAddons.length,
  });

  // ── Section: Tu canal (Partner Líder) ──────────────────────────────────────────────
  const CanalSection = () => {
    const code = user.partnerLeaderCode;
    const joinUrl = `${window.location.origin}/join/${code}`;
    const copyCode = () => { navigator.clipboard.writeText(code); toast.success('Copiado'); };
    const copyLink = () => { navigator.clipboard.writeText(joinUrl); toast.success('Copiado'); };

    const filteredPartners = channelPartners.filter(p => {
      if (!partnerQuery.trim()) return true;
      const q = partnerQuery.toLowerCase();
      return (
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q)
      );
    });
    const displayedPartners = showAllPartners ? filteredPartners : filteredPartners.slice(0, 20);

    const subTabs = [
      { id: 'invitar', label: 'Invitar' },
      { id: 'actividad', label: 'Actividad' },
      { id: 'partners', label: `Partners${channelSummary != null ? ` (${channelSummary.totalPartners})` : ''}` },
    ];

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Tu canal (Partner Líder)
          </CardTitle>
          <CardDescription>Comparte tu enlace de invitación y haz crecer tu red</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sub-tab pills */}
          <div className="flex gap-1 border-b border-slate-100 pb-3">
            {subTabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChannelTab(t.id)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  channelTab === t.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Loading / error states */}
          {channelLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando canal…</span>
            </div>
          ) : channelError === 'forbidden' ? (
            <p className="text-sm text-slate-500">Disponible solo para Partner Líder aprobado.</p>
          ) : channelError ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">Error al cargar la red.</p>
              <button type="button" onClick={loadChannelData} className="text-sm text-indigo-600 hover:underline">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Invitar */}
              {channelTab === 'invitar' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Tu código</p>
                      <code className="text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded px-3 py-1.5 block">{code}</code>
                    </div>
                    <button type="button" onClick={copyCode} className="mt-5 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Copiar clave">
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Tu link</p>
                      <code className="text-xs font-mono bg-slate-50 border border-slate-200 rounded px-3 py-1.5 block truncate">{joinUrl}</code>
                    </div>
                    <button type="button" onClick={copyLink} className="mt-5 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Copiar link">
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <QRCodeSVG value={joinUrl} size={200} />
                    <p className="text-xs text-slate-400">Escánealo para registrarse</p>
                  </div>
                </div>
              )}

              {/* Actividad */}
              {channelTab === 'actividad' && (
                channelSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-slate-900">{channelSummary.totalPartners}</p>
                        <p className="text-xs text-slate-500">Partners</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-slate-900">{channelSummary.last7Days}</p>
                        <p className="text-xs text-slate-500">Últimos 7 días</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-slate-900">{channelSummary.last30Days}</p>
                        <p className="text-xs text-slate-500">Últimos 30 días</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Actividad de tu red</p>
                        <div className="flex gap-1">
                          {[7, 30].map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setNetworkPeriod(d)}
                              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                networkPeriod === d
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >{d}d</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-purple-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-slate-900">
                            {networkPeriod === 7 ? (channelSummary.network_addon_views_last7 ?? 0) : (channelSummary.network_addon_views_last30 ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">Vistas de add-ons</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-slate-900">
                            {networkPeriod === 7 ? (channelSummary.network_contact_events_last7 ?? 0) : (channelSummary.network_contact_events_last30 ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">Contactos</p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-slate-900">
                            {networkPeriod === 7 ? (channelSummary.network_feature_votes_last7 ?? 0) : (channelSummary.network_feature_votes_last30 ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">Votos</p>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-slate-900">
                            {networkPeriod === 7 ? (channelSummary.network_ratings_last7 ?? 0) : (channelSummary.network_ratings_last30 ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">Calificaciones</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No hay datos de actividad todavía.</p>
                )
              )}

              {/* Partners */}
              {channelTab === 'partners' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={partnerQuery}
                    onChange={e => setPartnerQuery(e.target.value)}
                    placeholder="Buscar por nombre, empresa o correo…"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {channelPartners.length === 0 ? (
                    <p className="text-sm text-slate-400">No tienes partners aún.</p>
                  ) : filteredPartners.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin resultados.</p>
                  ) : (
                    <>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {displayedPartners.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{p.full_name || '(Sin nombre)'}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {p.company ? `${p.company} · ` : ''}{p.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.email && (
                                <button
                                  type="button"
                                  title="Copiar correo"
                                  onClick={() => { navigator.clipboard.writeText(p.email); toast.success('Correo copiado'); }}
                                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 transition-colors"
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                </button>
                              )}
                              <p className="text-xs text-slate-400">
                                {new Date(p.createdAt).toLocaleDateString('es-MX')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredPartners.length > 20 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPartners(v => !v)}
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          {showAllPartners ? 'Ocultar' : `Ver todos (${filteredPartners.length})`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Section: Tus add-ons (Developer) ───────────────────────────────────────
  const AddonsSection = () => (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Panel de Developer</h2>
          <p className="text-slate-600 text-sm">Administra tus add-ons y comparte tu perfil público</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Mi Perfil Público
          </CardTitle>
          <CardDescription>Comparte tu perfil para que Partners te contacten</CardDescription>
        </CardHeader>
        <CardContent>
          {!devProfile ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium mb-1">Tu perfil público aún no está configurado</p>
              <p className="text-xs text-amber-700 mb-3">Crea tu perfil de desarrollador para que los Partners puedan encontrarte y contactarte.</p>
              <Link to={createPageUrl('DeveloperProfile')}>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Edit className="w-4 h-4 mr-2" /> Crear mi perfil
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-5 mb-4">
                <p className="text-sm text-slate-600 mb-2">Tu link público:</p>
                {developerHandle ? (
                  <code className="text-xs bg-white px-3 py-2 rounded border border-slate-200 block break-all">
                    {window.location.origin}/DevProfile?handle={developerHandle}
                  </code>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                    Primero define tu handle en tu perfil
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyProfileLink} variant="outline" disabled={!developerHandle}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar link
                </Button>
                {developerHandle && (
                  <Link to={createPageUrl(`DevProfile?handle=${developerHandle}`)}>
                    <Button variant="outline">
                      <Eye className="w-4 h-4 mr-2" /> Ver mi perfil
                    </Button>
                  </Link>
                )}
                <Link to={createPageUrl('DeveloperProfile')}>
                  <Button variant="outline">
                    <Edit className="w-4 h-4 mr-2" /> Editar perfil
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Activity Metrics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            Resumen de actividad
          </CardTitle>
          <CardDescription>Vistas y contactos de tus add-ons</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando métricas…</span>
            </div>
          ) : !addonStats || addonStats.error ? (
            <p className="text-sm text-slate-500 py-4">No se pudieron cargar las métricas por ahora.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-blue-50 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{addonStats.totalViews.toLocaleString('es-MX')}</div>
                    <div className="text-xs text-slate-500">Total vistas</div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{addonStats.totalContacts.toLocaleString('es-MX')}</div>
                    <div className="text-xs text-slate-500">Total contactos</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-500" /> Más vistos
                  </h4>
                  {addonStats.topViewed.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin vistas todavía</p>
                  ) : (
                    <ol className="space-y-2">
                      {addonStats.topViewed.map((item, i) => (
                        <li key={item.addonId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-400 font-mono w-4 shrink-0">#{i + 1}</span>
                            <Link
                              to={createPageUrl(`AddonDetail?slug=${item.slug}`)}
                              className="truncate text-slate-800 hover:text-blue-600 transition-colors font-medium"
                            >
                              {item.name}
                            </Link>
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">{item.viewsCount.toLocaleString('es-MX')} vistas</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-green-500" /> Más contactados
                  </h4>
                  {addonStats.topContacted.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin contactos todavía</p>
                  ) : (
                    <ol className="space-y-2">
                      {addonStats.topContacted.map((item, i) => (
                        <li key={item.addonId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-400 font-mono w-4 shrink-0">#{i + 1}</span>
                            <Link
                              to={createPageUrl(`AddonDetail?slug=${item.slug}`)}
                              className="truncate text-slate-800 hover:text-blue-600 transition-colors font-medium"
                            >
                              {item.name}
                            </Link>
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">{item.contactsCount.toLocaleString('es-MX')} contactos</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* My Addons */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Mis Add-ons ({myAddons.length})
              </CardTitle>
              <CardDescription>Gestiona tus publicaciones y su estado</CardDescription>
            </div>
            {userCanPublish && (
              <Link to={createPageUrl('PublishAddon')}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <PlusCircle className="w-4 h-4 mr-2" /> Publicar
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {myAddons.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No tienes add-ons publicados</h3>
              <p className="text-slate-600 mb-6">Comienza a compartir tus soluciones con la comunidad</p>
              {userCanPublish ? (
                <Link to={createPageUrl('PublishAddon')}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <PlusCircle className="w-4 h-4 mr-2" /> Publicar mi primer add-on
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-amber-600">Completa tu perfil para publicar</p>
              )}
            </div>
          ) : (
            <>
              {/* Filter pills */}
              {(() => {
                const normalizeStatus = (s) => String(s || '').toLowerCase();
                const statusMatch = (addonStatus, filter) => {
                  const s = normalizeStatus(addonStatus);
                  if (filter === 'published') return s === 'published' || s === 'approved';
                  if (filter === 'pending')   return s === 'pending';
                  if (filter === 'rejected')  return s === 'rejected';
                  return true;
                };
                const filters = [
                  { id: 'all', label: 'Todos', count: myAddons.length },
                  { id: 'published', label: 'Publicados', count: myAddons.filter(a => statusMatch(a.status, 'published')).length },
                  { id: 'pending', label: 'Pendientes', count: myAddons.filter(a => statusMatch(a.status, 'pending')).length },
                  { id: 'rejected', label: 'Rechazados', count: myAddons.filter(a => statusMatch(a.status, 'rejected')).length },
                ];
                return (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {filters.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAddonsFilter(f.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          addonsFilter === f.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {f.label} <span className="ml-1 opacity-75">({f.count})</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const normalizeStatus = (s) => String(s || '').toLowerCase();
                const statusMatch = (addonStatus, filter) => {
                  const s = normalizeStatus(addonStatus);
                  if (filter === 'published') return s === 'published' || s === 'approved';
                  if (filter === 'pending')   return s === 'pending';
                  if (filter === 'rejected')  return s === 'rejected';
                  return true;
                };
                const filtered = addonsFilter === 'all' ? myAddons : myAddons.filter(a => statusMatch(a.status, addonsFilter));
                if (filtered.length === 0) return (
                  <p className="text-sm text-slate-400 py-4 text-center">No hay add-ons en esta categor&iacute;a.</p>
                );
                return (
            <div className="space-y-3">
              {filtered.map(addon => (
                <div key={addon.id} className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{addon.name}</h3>
                      {getStatusBadge(addon.status)}
                    </div>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{addon.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {addon.manufacturer && <Badge variant="outline" className="text-xs">{addon.manufacturer}</Badge>}
                      {addon.system && <Badge variant="outline" className="text-xs">{addon.system}</Badge>}
                      {addon.priceFrom && <Badge variant="secondary" className="text-xs">Desde ${addon.priceFrom.toLocaleString('es-MX')} MXN</Badge>}
                    </div>
                  </div>
                  {userCanPublish && (
                    <Link to={createPageUrl(`PublishAddon?id=${addon.id}`)}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  <Link to={createPageUrl(`AddonDetail?slug=${addon.slug}`)}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                  {userCanPublish && (
                    confirmDeleteId === addon.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteAddon(addon.id)}
                          disabled={deletingAddonId === addon.id}
                        >
                          {deletingAddonId === addon.id ? <Loader2 className="w-4 h-4 animate-spin" /> : '¿Eliminar?'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:border-red-300"
                        onClick={() => setConfirmDeleteId(addon.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )
                  )}
                </div>
              ))}
            </div>
              );
            })()}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );

  // ── Section: Explorar (Marketplace) ───────────────────────────────────────
  const ExplorarSection = () => {
    const showWelcome = !distStatsLoading && (!distributorStats || distributorStats.error || !distributorStats.totalAddons);
    return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Explorar el marketplace</h2>
          <p className="text-slate-600 text-sm">Descubre add-ons y sigue la actividad global</p>
        </div>
      </div>

      {showWelcome && (
        <Card className="mb-6 border-blue-100 bg-gradient-to-br from-blue-50/60 to-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              Empieza explorando el catálogo
            </CardTitle>
            <CardDescription className="text-slate-600 text-sm leading-relaxed">
              Descubre add-ons para CONTPAQi y SoftRestaurant, compara opciones y contacta developers directamente desde MarketPAQ.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <Button
              className="bg-blue-600 hover:bg-blue-700 h-9"
              onClick={() => { window.location.href = createPageUrl('AddonsCatalog'); }}
            >
              <Package className="w-4 h-4 mr-2" />
              Ir al catálogo
            </Button>
            <Button
              variant="outline"
              className="h-9 text-slate-600"
              onClick={() => { window.location.href = createPageUrl('FeatureRequests'); }}
            >
              Ver centro de mejoras
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            Resumen del marketplace
          </CardTitle>
          <CardDescription>Actividad global de los add-ons</CardDescription>
        </CardHeader>
        <CardContent>
          {distStatsLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando métricas…</span>
            </div>
          ) : !distributorStats || distributorStats.error ? (
            <p className="text-sm text-slate-500 py-4">Las métricas globales estarán disponibles cuando haya más actividad registrada en el marketplace.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{distributorStats.totalAddons.toLocaleString('es-MX')}</div>
                    <div className="text-xs text-slate-500">Total add-ons</div>
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{distributorStats.totalDevelopers.toLocaleString('es-MX')}</div>
                    <div className="text-xs text-slate-500">Desarrolladores</div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{distributorStats.totalContactEvents.toLocaleString('es-MX')}</div>
                    <div className="text-xs text-slate-500">Total contactos</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-green-500" /> Top 10 más contactados
                  </h4>
                  {distributorStats.topContacted.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin contactos registrados todavía</p>
                  ) : (
                    <ol className="space-y-2">
                      {distributorStats.topContacted.map((item, i) => (
                        <li key={item.addonId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-400 font-mono w-5 shrink-0">#{i + 1}</span>
                            <span className="min-w-0">
                              <Link
                                to={createPageUrl(`AddonDetail?slug=${item.slug}`)}
                                className="block truncate text-slate-800 hover:text-blue-600 transition-colors font-medium"
                              >
                                {item.name}
                              </Link>
                              {(item.manufacturer || item.system) && (
                                <span className="text-xs text-slate-400">{[item.manufacturer, item.system].filter(Boolean).join(' · ')}</span>
                              )}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">{item.contactsCount.toLocaleString('es-MX')} contactos</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-500" /> Últimos 10 publicados
                  </h4>
                  {distributorStats.latestAddons.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin add-ons publicados todavía</p>
                  ) : (
                    <ol className="space-y-2">
                      {distributorStats.latestAddons.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0">
                            <Link
                              to={createPageUrl(`AddonDetail?slug=${item.slug}`)}
                              className="block truncate text-slate-800 hover:text-blue-600 transition-colors font-medium"
                            >
                              {item.name}
                            </Link>
                            {(item.manufacturer || item.system) && (
                              <span className="text-xs text-slate-400">{[item.manufacturer, item.system].filter(Boolean).join(' · ')}</span>
                            )}
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">
                            {new Date(item.createdAt).toLocaleDateString('es-MX')}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick access */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = createPageUrl('AddonsCatalog')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Explorar Catálogo
            </CardTitle>
            <CardDescription>Descubre add-ons para tus sistemas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Ver todos los add-ons</Button>
          </CardContent>
        </Card>
      </div>
    </>
    );
  };

  // ── Section: Ratings ───────────────────────────────────────────────────────
  const RatingsSection = () => (
    <Card className="mt-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Mis calificaciones
        </CardTitle>
        <CardDescription>Resumen de add-ons y developers que has calificado</CardDescription>
      </CardHeader>
      <CardContent>
        {myRatingsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando calificaciones…</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-500" /> Add-ons calificados ({myAddonRatings.length})
              </h4>
              {myAddonRatings.length === 0 ? (
                <p className="text-xs text-slate-400">Ninguno todavía</p>
              ) : (
                <ol className="space-y-3">
                  {myAddonRatings.map(r => (
                    <li key={r.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={createPageUrl('AddonDetail') + `?slug=${r.addon.slug}`}
                          className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors truncate"
                        >
                          {r.addon.name}
                        </Link>
                        <div className="pointer-events-none flex-shrink-0">
                          <RatingStars value={r.score} readonly size="sm" />
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-slate-500 line-clamp-1">{r.comment}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {new Date(r.updatedAt ?? r.createdAt).toLocaleDateString('es-MX')}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Developers calificados ({myDevRatings.length})
              </h4>
              {myDevRatings.length === 0 ? (
                <p className="text-xs text-slate-400">Ninguno todavía</p>
              ) : (
                <ol className="space-y-3">
                  {myDevRatings.map(r => (
                    <li key={r.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        {r.developer.user?.handle ? (
                          <Link
                            to={createPageUrl('DevProfile') + `?handle=${r.developer.user.handle}`}
                            className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors truncate"
                          >
                            {r.developer.displayName}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {r.developer.displayName}
                          </span>
                        )}
                        <div className="pointer-events-none flex-shrink-0">
                          <RatingStars value={r.score} readonly size="sm" />
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-slate-500 line-clamp-1">{r.comment}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {new Date(r.updatedAt ?? r.createdAt).toLocaleDateString('es-MX')}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Section: Admin full panel (read-only — used in vista completa) ───────────
  const AdminFullPanel = () => (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Panel de Administración</h2>
            <p className="text-slate-600 text-sm">Vista de auditoría — gestión completa en Admin Addons</p>
          </div>
        </div>
        <Link to={createPageUrl('AdminAddons')}>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-1.5" /> Ir a Admin Addons
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Add-ons Pendientes ({pendingAddons.length})
          </CardTitle>
          <CardDescription>Solo lectura — aprueba o rechaza en /AdminAddons</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAddons.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No hay add-ons pendientes de aprobación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAddons.map(addon => (
                <div key={addon.id} className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{addon.name}</h3>
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">{addon.summary}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-slate-500">Developer: <span className="font-medium text-slate-700">{addon.vendor}</span></span>
                      {addon.manufacturer && <Badge variant="outline" className="text-xs">{addon.manufacturer}</Badge>}
                      {addon.system && <Badge variant="outline" className="text-xs">{addon.system}</Badge>}
                    </div>
                  </div>
                  <Link to={createPageUrl(`AddonDetail?slug=${addon.slug}`)}>
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-1.5" /> Ver
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {approvedAddons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Últimos Aprobados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {approvedAddons.map(addon => (
                <div key={addon.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{addon.name}</p>
                    <p className="text-xs text-slate-500">{addon.vendor}</p>
                  </div>
                  <Link to={createPageUrl(`AddonDetail?slug=${addon.slug}`)}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="border-t border-slate-200 my-8" />
    </div>
  );

  // ── Section: Admin tab simplified (count + quick links only) ───────────────
  const AdminTabPanel = () => (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link to={createPageUrl('AdminAddons')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pendingAddons.length > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                  {pendingAddons.length > 0
                    ? <Clock className="w-6 h-6 text-amber-600" />
                    : <CheckCircle2 className="w-6 h-6 text-green-600" />}
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{pendingAddons.length}</p>
                  <p className="text-sm text-slate-500">Pendientes de aprobación</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl('AdminAddons')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-100">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{approvedAddons.length}</p>
                  <p className="text-sm text-slate-500">Últimos aprobados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to={createPageUrl('AdminAddons')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-5 h-5 text-purple-600" />
                Gestionar Add-ons
              </CardTitle>
              <CardDescription>Aprobar, rechazar y revisar add-ons</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to={createPageUrl('AdminPartners')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-indigo-600" />
                Gestionar Partners
              </CardTitle>
              <CardDescription>Ver y administrar la red de partners</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to={createPageUrl('AdminDevelopers')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-blue-600" />
                Gestionar Developers
              </CardTitle>
              <CardDescription>Ver perfiles y métricas de developers</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );

  // ── KPI bar (above-the-fold mini-cards per active tab) ────────────────────
  const renderKpis = () => {
    const wrap = 'grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6';
    const card = 'bg-white border border-slate-200 rounded-xl px-4 py-3';
    const val  = 'text-2xl font-bold text-slate-900 leading-none';
    const lbl  = 'text-xs text-slate-500 mt-1';
    const dash = '—';
    const fmt  = n => (n != null ? Number(n).toLocaleString('es-MX') : dash);

    if (activeTab === 'canal') return (
      <div className={wrap}>
        <div className={card}><p className={val}>{fmt(channelSummary?.totalPartners)}</p><p className={lbl}>Partners totales</p></div>
        <div className={card}><p className={val}>{fmt(channelSummary?.last30Days)}</p><p className={lbl}>Nuevos (30d)</p></div>
        <div className={card}><p className={val}>{fmt(channelSummary?.network_addon_views_last30)}</p><p className={lbl}>Vistas red (30d)</p></div>
        <div className={card}><p className={val}>{fmt(channelSummary?.network_contact_events_last30)}</p><p className={lbl}>Contactos red (30d)</p></div>
      </div>
    );

    if (activeTab === 'addons') {
      const published = myAddons.filter(a => a.status === 'published').length;
      return (
        <div className={wrap}>
          <div className={card}><p className={val}>{myAddons.length}</p><p className={lbl}>Mis add-ons</p></div>
          <div className={card}><p className={val}>{published}</p><p className={lbl}>Publicados</p></div>
          <div className={card}><p className={val}>{addonStats ? fmt(addonStats.totalViews) : dash}</p><p className={lbl}>Total vistas</p></div>
          <div className={card}><p className={val}>{addonStats ? fmt(addonStats.totalContacts) : dash}</p><p className={lbl}>Total contactos</p></div>
        </div>
      );
    }

    if (activeTab === 'explorar') return (
      <div className={wrap}>
        <div className={card}><p className={val}>{fmt(distributorStats?.totalAddons)}</p><p className={lbl}>Total add-ons</p></div>
        <div className={card}><p className={val}>{fmt(distributorStats?.totalDevelopers)}</p><p className={lbl}>Desarrolladores</p></div>
        <div className={card}><p className={val}>{fmt(distributorStats?.totalContactEvents)}</p><p className={lbl}>Total contactos</p></div>
        <div className={card}><p className={val}>{fmt(distributorStats?.topContacted?.[0]?.contactsCount)}</p><p className={lbl}>Top contactos</p>{distributorStats?.topContacted?.[0]?.name && <p className="text-xs text-slate-400 truncate mt-0.5">{distributorStats.topContacted[0].name}</p>}</div>
      </div>
    );

    if (activeTab === 'ratings') return (
      <div className={wrap}>
        <div className={card}><p className={val}>{myAddonRatings.length + myDevRatings.length}</p><p className={lbl}>Total calificaciones</p></div>
        <div className={card}><p className={val}>{myAddonRatings.length}</p><p className={lbl}>Add-ons calificados</p></div>
        <div className={card}><p className={val}>{myDevRatings.length}</p><p className={lbl}>Developers calificados</p></div>
        <div className={card}><p className={val}>{dash}</p><p className={lbl}>Promedio</p></div>
      </div>
    );

    if (activeTab === 'admin') return null;

    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Admin: vista completa toggle */}
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setAdminViewAll(v => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              adminViewAll
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Vista completa
          </button>
        </div>
      )}

      {adminViewAll ? (
        /* ── Admin audit: all sections stacked ── */
        <>
          <AdminFullPanel />
          {isApprovedLeader && <CanalSection />}
          {isDev && <AddonsSection />}
          <ExplorarSection />
          {showRatings && <RatingsSection />}
        </>
      ) : (
        /* ── Normal tab mode ── */
        <>
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (user) localStorage.setItem(`mpq:dashboardTab:${user.id}`, tab.id);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    active
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                  {tab.label}
                  {tab.badge != null && (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full border ${
                      active
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      {Number(tab.badge).toLocaleString('es-MX')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* KPI bar */}
          {renderKpis()}

          {/* Tab content */}
          {activeTab === 'canal' && isApprovedLeader && <CanalSection />}
          {activeTab === 'addons' && isDev && <AddonsSection />}
          {activeTab === 'explorar' && <ExplorarSection />}
          {activeTab === 'ratings' && showRatings && <RatingsSection />}
          {activeTab === 'admin' && isAdmin && <AdminTabPanel />}
        </>
      )}
    </div>
  );
}
