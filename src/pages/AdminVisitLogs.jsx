import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, RefreshCw, Globe } from 'lucide-react';
import { useNoIndex } from '@/lib/useNoIndex';

export default function AdminVisitLogs() {
  useNoIndex();
  return (
    <AuthGuard requiredRoles={['admin']}>
      <VisitLogsContent />
    </AuthGuard>
  );
}

const LIMIT = 50;

function VisitLogsContent() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (query, off) => {
    setLoading(true);
    try {
      const { data } = await api.functions.invoke('adminGetVisitLogs', {
        q: query || undefined,
        limit: LIMIT,
        offset: off,
      });
      if (data?.success) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Error cargando bitácora', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeQ, offset);
  }, [activeQ, offset, load]);

  function handleSearch(e) {
    e.preventDefault();
    setOffset(0);
    setActiveQ(q);
  }

  function handleRefresh() {
    setOffset(0);
    setActiveQ(q);
    load(q, 0);
  }

  const hasPrev = offset > 0;
  const hasNext = offset + LIMIT < total;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Bitácora de visitas</h1>
        </div>
        <p className="text-sm text-slate-500">Registro de navegación por la plataforma. Los datos más recientes aparecen primero.</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por IP, ruta o correo"
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm">Buscar</Button>
        <Button type="button" size="sm" variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </form>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400 mb-3">
          {total === 0 ? 'Sin resultados' : `${total.toLocaleString()} registro${total !== 1 ? 's' : ''}${activeQ ? ` para "${activeQ}"` : ''}`}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay visitas registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Fecha/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">IP</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Ruta</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Referrer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Navegador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-mono text-xs">
                    {new Date(log.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs text-slate-600">
                    {log.ip ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 max-w-[180px]">
                    {log.userEmail ? (
                      <span className="text-slate-800 truncate block" title={log.userEmail}>{log.userEmail}</span>
                    ) : (
                      <span className="text-slate-400 italic">Anónimo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {log.userType ? (
                      <UserTypeBadge type={log.userType} role={log.role} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <span className="font-mono text-xs text-slate-700 truncate block" title={log.path}>{log.path}</span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[160px]">
                    {log.referrer ? (
                      <span className="text-xs text-slate-500 truncate block" title={log.referrer}>{log.referrer}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[180px]">
                    {log.userAgent ? (
                      <span className="text-xs text-slate-400 truncate block" title={log.userAgent}>
                        {log.userAgent.substring(0, 60)}{log.userAgent.length > 60 ? '…' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {offset + 1}–{Math.min(offset + LIMIT, total)} de {total}
          </span>
          <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setOffset(o => o + LIMIT)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

function UserTypeBadge({ type, role }) {
  if (role === 'admin') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Admin</span>;
  const map = {
    developer:      { label: 'Developer',      cls: 'bg-blue-100 text-blue-700' },
    partner:        { label: 'Partner',         cls: 'bg-green-100 text-green-700' },
    partner_leader: { label: 'Partner Líder',   cls: 'bg-indigo-100 text-indigo-700' },
    unset:          { label: 'Sin definir',     cls: 'bg-slate-100 text-slate-500' },
  };
  const cfg = map[type] ?? { label: type, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}
