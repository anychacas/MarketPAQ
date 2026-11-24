import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Users, Code, Star, ArrowRight, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNoIndex } from '@/lib/useNoIndex';

function getStoredRef() {
  const code = localStorage.getItem('marketpaq_ref_code');
  const ts   = parseInt(localStorage.getItem('marketpaq_ref_ts') || '0', 10);
  if (!code) return null;
  if (Date.now() - ts > 14 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem('marketpaq_ref_code');
    localStorage.removeItem('marketpaq_ref_ts');
    return null;
  }
  return code;
}

function clearStoredRef() {
  localStorage.removeItem('marketpaq_ref_code');
  localStorage.removeItem('marketpaq_ref_ts');
}

export default function OnboardingRole() {
  useNoIndex();
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const isAuth = await api.auth.isAuthenticated();
        if (!isAuth) {
          window.location.href = '/Login';
          return;
        }

        const u = await api.auth.me();
        console.log('User loaded:', u);

        if (u.onboardingComplete === true) {
          navigate(u.userType === 'partner' ? createPageUrl('AddonsCatalog') : createPageUrl('Dashboard'));
          return;
        }

        setUser(u);
      } catch (error) {
        console.error('Error loading user:', error);
        setError('Error al cargar usuario: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  // Partner or Developer role selection
  const selectRole = async (role) => {
    if (!user) return;
    setSavingRole(role);
    setError(null);
    try {
      const { data } = await api.functions.invoke('setMyRole', { role });
      if (!data.success) throw new Error(data.error || 'Error al guardar');

      if (role === 'partner') {
        const refCode = getStoredRef();
        if (refCode) {
          try {
            const { data: linkData } = await api.functions.invoke('linkPartnerUpline', { code: refCode });
            // Definitive outcome (linked, already linked, or invalid code) → discard ref
            if (linkData.success || linkData.reason === 'INVALID_CODE') clearStoredRef();
            // else (e.g. NOT_PARTNER) → keep ref; shouldn't happen but safe
          } catch {
            // Transient failure (network / 5xx) → keep ref so user can retry
            console.warn('[linkPartnerUpline] transient error, keeping ref for retry');
          }
        }
      } else {
        clearStoredRef(); // developer path: always discard
      }

      toast.success('Perfil guardado');
      setTimeout(() => {
        window.location.href = createPageUrl('OnboardingProfile');
      }, 500);
    } catch (error) {
      console.error('Error selecting role:', error);
      setError('Error al guardar: ' + (error.response?.data?.error || error.message));
      toast.error('Error al guardar tu selección');
      setSavingRole(null);
    }
  };

  // Partner Líder selection: call setMyRole('partner_leader') directly — no approval needed
  const selectPartnerLeader = async () => {
    if (!user) return;
    setSavingRole('partnerLeader');
    setError(null);
    try {
      const { data } = await api.functions.invoke('setMyRole', { role: 'partner_leader' });
      if (!data.success) throw new Error(data.error || 'Error al guardar rol');

      // Partner Líderes don't have an upline; discard any stored ref code
      clearStoredRef();

      toast.success('Perfil guardado');
      setTimeout(() => {
        window.location.href = createPageUrl('OnboardingProfile');
      }, 500);
    } catch (error) {
      console.error('Error selecting partner leader:', error);
      setError('Error: ' + (error.response?.data?.error || error.message));
      toast.error('Error al guardar tu selección');
      setSavingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Elige tu perfil</h1>
          <p className="text-lg text-slate-600 mb-2">Esto nos ayuda a mostrarte la experiencia correcta</p>
          {user && (
            <p className="text-sm text-slate-400">
              Conectado como: {user.email}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Partner */}
          <button
            onClick={() => selectRole('partner')}
            disabled={savingRole !== null}
            className="bg-white rounded-3xl border-2 border-slate-200 hover:border-blue-400 p-8 transition-all text-left group hover:shadow-xl disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <Users className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Partner</h3>
            <p className="text-slate-600 mb-6">Accede al catálogo de add-ons y contacta developers directamente.</p>
            <div className="flex items-center text-blue-600 font-medium">
              {savingRole === 'partner' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Continuar como Partner <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Developer */}
          <button
            onClick={() => selectRole('developer')}
            disabled={savingRole !== null}
            className="bg-white rounded-3xl border-2 border-slate-200 hover:border-purple-400 p-8 transition-all text-left group hover:shadow-xl disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
              <Code className="w-8 h-8 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Developer</h3>
            <p className="text-slate-600 mb-6">Publica add-ons y crea tu perfil público.</p>
            <div className="flex items-center text-purple-600 font-medium">
              {savingRole === 'developer' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Continuar como Developer <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Partner Líder */}
          <button
            onClick={selectPartnerLeader}
            disabled={savingRole !== null}
            className="bg-white rounded-3xl border-2 border-slate-200 hover:border-amber-400 p-8 transition-all text-left group hover:shadow-xl disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 group-hover:bg-amber-500 transition-colors">
              <Star className="w-8 h-8 text-amber-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Partner Líder</h3>
            <p className="text-slate-600 mb-2">Tengo una red de Partners.</p>
            <p className="text-xs text-slate-400 mb-6">Publica add-ons y gestiona tu red.</p>
            <div className="flex items-center text-amber-600 font-medium">
              {savingRole === 'partnerLeader' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Continuar como Partner Líder <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {savingRole && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-600 text-sm font-medium">
              {`Guardando perfil...`}
            </p>
          </div>
        )}

        <div className="text-center mt-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { api.auth.logout('/Login'); }}
            className="text-slate-400 hover:text-slate-600"
            disabled={savingRole !== null}
          >
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </Button>
        </div>
      </div>
    </div>
  );
}
