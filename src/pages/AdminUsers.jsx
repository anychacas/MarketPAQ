import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useNoIndex } from '@/lib/useNoIndex';

export default function AdminUsers() {
  useNoIndex();
  return (
    <AuthGuard requiredRoles={['admin']}>
      <UsersContent />
    </AuthGuard>
  );
}

const USER_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'unset', label: 'Sin definir' },
  { value: 'partner', label: 'Partner' },
  { value: 'developer', label: 'Developer' },
  { value: 'partner_leader', label: 'Partner Líder' },
];

const USER_TYPE_ROW_OPTIONS = [
  { value: 'unset', label: 'Sin definir' },
  { value: 'partner', label: 'Partner' },
  { value: 'developer', label: 'Developer' },
  { value: 'partner_leader', label: 'Partner Líder' },
];

function UsersContent() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(new Set());

  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [userType, setUserType] = useState('');
  const [activeUserType, setActiveUserType] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // edits[userId] = { userType, canPublishAddons, onboardingComplete }
  const [edits, setEdits] = useState({});

  const loadUsers = useCallback(async (qVal, typeVal, limitVal, offsetVal) => {
    setLoading(true);
    try {
      const body = { limit: limitVal, offset: offsetVal };
      if (qVal) body.q = qVal;
      if (typeVal) body.userType = typeVal;
      const { data } = await api.functions.invoke('adminListUsers', body);
      setItems(data?.users ?? []);
      setTotal(data?.total ?? 0);
      setEdits({});
    } catch (err) {
      console.error('[AdminUsers] adminListUsers failed', err);
      toast.error('Error cargando usuarios');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers('', '', limit, 0);
  }, [loadUsers, limit]);

  const handleSearch = () => {
    setActiveQ(q);
    setActiveUserType(userType);
    setOffset(0);
    loadUsers(q, userType, limit, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
    loadUsers(activeQ, activeUserType, limit, newOffset);
  };

  const getEdit = (user) => edits[user.id] ?? {
    userType: user.userType ?? 'unset',
    canPublishAddons: !!user.canPublishAddons,
    onboardingComplete: !!user.onboardingComplete,
  };

  const setEdit = (userId, field, value) => {
    setEdits(prev => ({
      ...prev,
      [userId]: { ...getEdit(items.find(u => u.id === userId)), ...prev[userId], [field]: value },
    }));
  };

  const hasEdits = (user) => {
    if (!edits[user.id]) return false;
    const e = edits[user.id];
    return (
      e.userType !== (user.userType ?? 'unset') ||
      e.canPublishAddons !== !!user.canPublishAddons ||
      e.onboardingComplete !== !!user.onboardingComplete
    );
  };

  const handleSave = async (user) => {
    const patch = edits[user.id];
    if (!patch) return;
    setSaving(prev => new Set(prev).add(user.id));
    try {
      await api.entities.User.update(user.id, patch);
      toast.success('Guardado');
      await loadUsers(activeQ, activeUserType, limit, offset);
    } catch (err) {
      console.error('[AdminUsers] save failed', err);
      toast.error('Error al guardar');
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(user.id); return s; });
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Gestión de Usuarios</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Buscar email, nombre, empresa..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-72"
        />
        <select
          value={userType}
          onChange={e => setUserType(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white text-slate-700"
        >
          {USER_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button onClick={handleSearch} size="sm">
          <Search className="w-4 h-4 mr-1.5" /> Buscar
        </Button>
        <span className="text-sm text-slate-500 self-center ml-2">
          {total} usuario{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Email</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Nombre</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Empresa</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Tipo</th>
                <th className="px-3 py-3 text-center font-medium text-slate-600">Publicar</th>
                <th className="px-3 py-3 text-center font-medium text-slate-600">Onboarding</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Código/Upline</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Alta</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : items.map(user => {
                const e = getEdit(user);
                const dirty = hasEdits(user);
                const isSaving = saving.has(user.id);
                return (
                  <tr key={user.id} className={dirty ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate" title={user.email}>
                      {user.email}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{user.name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{user.company || '—'}</td>
                    <td className="px-3 py-2">
                      <select
                        value={e.userType ?? 'unset'}
                        onChange={ev => setEdit(user.id, 'userType', ev.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-xs bg-white w-32"
                      >
                        {USER_TYPE_ROW_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!e.canPublishAddons}
                        onChange={ev => setEdit(user.id, 'canPublishAddons', ev.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!e.onboardingComplete}
                        onChange={ev => setEdit(user.id, 'onboardingComplete', ev.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate">
                      {user.partnerLeaderCode
                        ? <span className="font-mono text-blue-600">{user.partnerLeaderCode}</span>
                        : user.uplinePartnerLeaderId
                          ? <span className="text-slate-400">upline:{user.uplinePartnerLeaderId.slice(0, 8)}</span>
                          : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant={dirty ? 'default' : 'ghost'}
                        disabled={!dirty || isSaving}
                        onClick={() => handleSave(user)}
                        className="text-xs px-2 py-1 h-7"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                        Guardar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4 justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => handlePageChange(Math.max(0, offset - limit))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-600">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total || loading}
            onClick={() => handlePageChange(offset + limit)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
