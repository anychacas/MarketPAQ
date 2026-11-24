import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Download, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNoIndex } from '@/lib/useNoIndex';

export default function AdminPartners() {
  useNoIndex();
  return (
    <AuthGuard requiredRoles={['admin']}>
      <PartnersContent />
    </AuthGuard>
  );
}

function PartnersContent() {
  const [leaders, setLeaders] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [q, setQ] = useState('');
  const [leaderUserId, setLeaderUserId] = useState('');
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  // Active filters (committed on search)
  const [activeQ, setActiveQ] = useState('');
  const [activeLeaderUserId, setActiveLeaderUserId] = useState('');

  const loadLeaders = async () => {
    setLeadersLoading(true);
    try {
      const { data } = await api.functions.invoke('adminListPartnerLeaders');
      setLeaders(data?.items ?? []);
    } catch (err) {
      console.error('[AdminPartners] adminListPartnerLeaders failed', err);
      setLeaders([]);
    } finally {
      setLeadersLoading(false);
    }
  };

  const loadPartners = useCallback(async (qVal, leaderVal, limitVal, offsetVal) => {
    setLoading(true);
    try {
      const { data } = await api.functions.invoke('adminListPartners', {
        q: qVal || undefined,
        leaderUserId: leaderVal || undefined,
        limit: limitVal,
        offset: offsetVal,
        sort: 'newest',
      });
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      console.error('[AdminPartners] adminListPartners failed', err);
      toast.error('Error al cargar partners');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaders();
    loadPartners('', '', 100, 0);
  }, []);

  const handleSearch = () => {
    setActiveQ(q);
    setActiveLeaderUserId(leaderUserId);
    setOffset(0);
    loadPartners(q, leaderUserId, limit, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setOffset(0);
    loadPartners(activeQ, activeLeaderUserId, newLimit, 0);
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, offset - limit);
    setOffset(newOffset);
    loadPartners(activeQ, activeLeaderUserId, limit, newOffset);
  };

  const handleNext = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    loadPartners(activeQ, activeLeaderUserId, limit, newOffset);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.functions.invoke('adminExportPartnersCsv', {
        q: activeQ || undefined,
        leaderUserId: activeLeaderUserId || undefined,
        sort: 'newest',
      });
      if (!data?.csv) {
        toast.error('No se recibió CSV');
        return;
      }
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'partners.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV descargado');
    } catch (err) {
      console.error('[AdminPartners] export failed', err);
      toast.error('Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Partners</h1>
        <p className="text-slate-500 mt-1">Lista de partners registrados con su upline</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por email, nombre, empresa o código..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <select
          value={leaderUserId}
          onChange={e => setLeaderUserId(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          disabled={leadersLoading}
        >
          <option value="">Todos los Partner Líderes</option>
          {leaders.map(l => (
            <option key={l.id} value={l.id}>
              {l.name || l.email} {l.partnerLeaderCode ? `(${l.partnerLeaderCode})` : ''}
            </option>
          ))}
        </select>
        <Button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
          Buscar
        </Button>
        <Button
          onClick={handleExport}
          disabled={exporting}
          variant="outline"
          className="border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
          Exportar CSV
        </Button>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          {loading ? 'Cargando...' : `${total} partner${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Mostrar</span>
          {[100, 200, 500].map(n => (
            <button
              key={n}
              onClick={() => handleLimitChange(n)}
              className={`px-2 py-0.5 rounded ${limit === n ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No se encontraron partners</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_2fr] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Partner</span>
              <span>Empresa</span>
              <span>Fecha alta</span>
              <span>Upline (Partner Líder)</span>
            </div>
            <div className="divide-y divide-slate-50">
              {items.map(p => (
                <div key={p.id} className="grid sm:grid-cols-[2fr_1.5fr_1fr_2fr] gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  {/* Partner */}
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{p.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.email}</p>
                  </div>
                  {/* Company */}
                  <div className="flex items-center">
                    <span className="text-sm text-slate-600">{p.company || <span className="text-slate-300">—</span>}</span>
                  </div>
                  {/* Date */}
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('es-MX')}</span>
                  </div>
                  {/* Upline */}
                  <div className="flex items-start gap-2">
                    {p.upline ? (
                      <div>
                        <p className="text-sm text-slate-700">{p.upline.name || p.upline.email}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.upline.email}</p>
                        {p.upline.partnerLeaderCode && (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs mt-1 font-mono">
                            {p.upline.partnerLeaderCode}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-sm">Sin upline</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={!hasPrev || loading}
                className="border-slate-200"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={!hasNext || loading}
                className="border-slate-200"
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
