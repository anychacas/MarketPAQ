import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Loader2, Package, ShieldAlert } from "lucide-react";
import SystemBadge from '@/components/SystemBadge';
import { canAccessAdminPanel, canApproveAddons } from '@/components/permissions';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { useNoIndex } from '@/lib/useNoIndex';

export default function AdminAddons() {
  useNoIndex();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
        
        if (!canAccessAdminPanel(currentUser)) {
          // Redirigir o mostrar error
          setLoading(false);
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Auth error:', err);
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !canAccessAdminPanel(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="max-w-md mx-auto px-4 text-center">
          <ShieldAlert className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso denegado</h2>
          <p className="text-slate-600 mb-6">No tienes permisos para acceder al panel de administración.</p>
          <Link to={createPageUrl("Dashboard")}>
            <Button className="bg-blue-600 hover:bg-blue-700">Volver al Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <AdminContent user={user} />;
}

function AdminContent({ user }) {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    const all = await api.entities.Addons.list('-created_date', 200);
    setAddons(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    if (!canApproveAddons(user)) {
      console.error('Usuario no tiene permisos para aprobar add-ons');
      return;
    }
    
    setActionLoading(id);
    await api.entities.Addons.update(id, { status });
    await load();
    setActionLoading(null);
  };

  const statusColor = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    published: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200'
  };

  const renderList = (items) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          No hay add-ons en esta categoría
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {items.map(addon => (
          <div key={addon.id} className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900">{addon.name}</h3>
                <Badge variant="outline" className={`text-xs ${statusColor[addon.status]}`}>
                  {addon.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mb-2">{addon.summary}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Vendor: {addon.vendor}</span>
                <SystemBadge contpaqi={addon.contpaqi} softrestaurant={addon.softrestaurant} />
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {addon.status === 'pending' && (
                <>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(addon.id, 'published')} disabled={actionLoading === addon.id}>
                    {actionLoading === addon.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Publicar
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus(addon.id, 'rejected')} disabled={actionLoading === addon.id}>
                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                </>
              )}
              {addon.status === 'published' && (
                <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => updateStatus(addon.id, 'pending')} disabled={actionLoading === addon.id}>
                  Despublicar
                </Button>
              )}
              {addon.status === 'rejected' && (
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(addon.id, 'published')} disabled={actionLoading === addon.id}>
                  Publicar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const pending = addons.filter(a => a.status === 'pending');
  const published = addons.filter(a => a.status === 'published');
  const rejected = addons.filter(a => a.status === 'rejected');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Moderar Add-ons</h1>
      <p className="text-slate-500 mb-6">Revisa y aprueba los add-ons enviados por developers</p>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pendientes {pending.length > 0 && <Badge className="ml-1.5 bg-amber-100 text-amber-700 text-xs">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published">Publicados ({published.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rechazados ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderList(pending)}</TabsContent>
        <TabsContent value="published">{renderList(published)}</TabsContent>
        <TabsContent value="rejected">{renderList(rejected)}</TabsContent>
      </Tabs>
    </div>
  );
}