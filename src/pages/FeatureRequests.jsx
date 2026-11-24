import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, X, Lightbulb, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useNoIndex } from '@/lib/useNoIndex';

// ── Status badge helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: 'Abierta',       bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'  },
  planned:     { label: 'Planeada',      bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  in_progress: { label: 'En progreso',   bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  done:        { label: 'Implementada',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  rejected:    { label: 'Descartada',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'   },
};

const STATUS_TABS = [
  { value: 'all',         label: 'Todas' },
  { value: 'open',        label: 'Abiertas' },
  { value: 'planned',     label: 'Planeadas' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done',        label: 'Implementadas' },
  { value: 'rejected',    label: 'Descartadas' },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function timeAgo(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FeatureRequests() {
  useNoIndex();
  const { user, isAuthenticated } = useAuth();

  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Filter / sort state ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('votes'); // 'votes' | 'recent'
  const [showMine, setShowMine] = useState(false);
  const [showMyVotes, setShowMyVotes] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Voting in-flight set (to disable button while request is pending)
  const [votingIds, setVotingIds] = useState(new Set());

  // Admin status editor
  const [editingStatusId, setEditingStatusId] = useState(null);

  const token = () => getToken();

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/feature-requests');
      if (!res.ok) throw new Error('Error al cargar mejoras');
      setItems(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Client-side filter + sort ───────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let list = [...items];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(i => i.status === statusFilter);
    }

    // "Mis propuestas" toggle
    if (showMine && user?.id) {
      list = list.filter(i => i.createdByUserId === user.id);
    }

    // "Mis votos" toggle
    if (showMyVotes) {
      list = list.filter(i => i.hasVoted);
    }

    // Sort
    if (sortBy === 'recent') {
      list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } else {
      // votes desc (default from API, but re-sort after optimistic updates)
      list.sort((a, b) => b.votesCount - a.votesCount || new Date(b.created_date) - new Date(a.created_date));
    }

    return list;
  }, [items, statusFilter, sortBy, showMine, showMyVotes, user?.id]);

  // ── Guard helpers ───────────────────────────────────────────────────────────

  function requireAuth() {
    if (!isAuthenticated) {
      window.location.href = '/Login';
      return false;
    }
    return true;
  }

  // ── Vote toggle ─────────────────────────────────────────────────────────────

  async function handleVote(item) {
    if (!requireAuth()) return;
    if (votingIds.has(item.id)) return;

    // Optimistic update
    const wasVoted = item.hasVoted;
    setItems(prev => prev.map(i =>
      i.id !== item.id ? i : {
        ...i,
        hasVoted: !wasVoted,
        votesCount: wasVoted ? i.votesCount - 1 : i.votesCount + 1,
      },
    ));
    setVotingIds(prev => new Set(prev).add(item.id));

    try {
      const method = wasVoted ? 'DELETE' : 'POST';
      const res = await fetch(`/api/feature-requests/${item.id}/vote`, {
        method,
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const { votesCount, hasVoted } = await res.json();
      // Sync with server truth
      setItems(prev => prev.map(i => i.id !== item.id ? i : { ...i, votesCount, hasVoted }));
    } catch {
      // Revert on error
      setItems(prev => prev.map(i =>
        i.id !== item.id ? i : {
          ...i,
          hasVoted: wasVoted,
          votesCount: wasVoted ? i.votesCount + 1 : i.votesCount - 1,
        },
      ));
    } finally {
      setVotingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  // ── Submit new feature request ──────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    if (!requireAuth()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title: formTitle.trim(), description: formDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message ?? 'Error al enviar la propuesta');
        return;
      }
      setItems(prev => [data, ...prev]);
      setShowModal(false);
      setFormTitle('');
      setFormDesc('');
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Admin: change status ────────────────────────────────────────────────────

  async function handleStatusChange(id, newStatus) {
    try {
      const res = await fetch(`/api/feature-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id !== id ? i : { ...i, status: updated.status }));
    } finally {
      setEditingStatusId(null);
    }
  }

  // ── Empty state copy ────────────────────────────────────────────────────────

  function emptyStateCopy() {
    if (showMine) return { title: 'Aún no has propuesto nada', sub: '¡Sé el primero en proponer una mejora!' };
    if (showMyVotes) return { title: 'No has votado ninguna mejora', sub: 'Explora las propuestas y apoya las que más necesitas.' };
    if (statusFilter !== 'all') return { title: `No hay propuestas con estado "${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}"`, sub: 'Prueba otro filtro o crea una nueva propuesta.' };
    return { title: 'Aún no hay propuestas', sub: '¡Sé el primero en proponer una mejora!' };
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Centro de mejoras</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Vota las mejoras que más necesitas · Inicia sesión para proponer y votar.
            </p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            onClick={() => {
              if (!requireAuth()) return;
              setFormError(null);
              setShowModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Proponer
          </Button>
        </div>

        {/* ── Filters bar ───────────────────────────────────────────────────── */}
        <div className="mb-5 space-y-3">
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  statusFilter === tab.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort + toggles row */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            {/* Sort */}
            <div className="flex gap-1">
              <button
                onClick={() => setSortBy('votes')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  sortBy === 'votes'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                Más votadas
              </button>
              <button
                onClick={() => setSortBy('recent')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                Más recientes
              </button>
            </div>

            {/* Divider */}
            {(isAuthenticated) && <div className="w-px h-4 bg-slate-200" />}

            {/* User toggles — only meaningful when authenticated */}
            {isAuthenticated && (
              <>
                <button
                  onClick={() => { setShowMine(v => !v); setShowMyVotes(false); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    showMine
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  Mis propuestas
                </button>
                <button
                  onClick={() => { setShowMyVotes(v => !v); setShowMine(false); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    showMyVotes
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  Mis votos
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        {error && (
          <div className="text-center py-16 text-slate-500">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filteredItems.length === 0 && (() => {
          const { title, sub } = emptyStateCopy();
          return (
            <div className="text-center py-20">
              <Lightbulb className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">{title}</p>
              <p className="text-slate-400 text-sm mt-1">{sub}</p>
              {(showMine || showMyVotes || statusFilter !== 'all') && (
                <button
                  onClick={() => { setStatusFilter('all'); setShowMine(false); setShowMyVotes(false); }}
                  className="mt-4 text-sm text-blue-600 hover:underline"
                >
                  Ver todas las propuestas
                </button>
              )}
            </div>
          );
        })()}

        {/* List */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex gap-4"
              >
                {/* Vote button column */}
                <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                  <button
                    onClick={() => handleVote(item)}
                    disabled={votingIds.has(item.id)}
                    className={`
                      flex flex-col items-center gap-0.5 w-12 py-2 rounded-xl border transition-all
                      ${item.hasVoted
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}
                      ${votingIds.has(item.id) ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                    title={item.hasVoted ? 'Quitar voto' : 'Votar'}
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span className="text-xs font-bold leading-none">{item.votesCount}</span>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 leading-snug">{item.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && editingStatusId === item.id ? (
                        <select
                          autoFocus
                          defaultValue={item.status}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-0.5 bg-white"
                          onBlur={() => setEditingStatusId(null)}
                          onChange={e => handleStatusChange(item.id, e.target.value)}
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => isAdmin && setEditingStatusId(item.id)}
                          className={isAdmin ? 'cursor-pointer' : ''}
                          title={isAdmin ? 'Clic para cambiar estado' : undefined}
                        >
                          <StatusBadge status={item.status} />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-2 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {item.createdByHandle
                      ? <span>@{item.createdByHandle}</span>
                      : item.createdByName
                        ? <span>{item.createdByName}</span>
                        : <span>Usuario</span>
                    }
                    <span>·</span>
                    <span>{timeAgo(item.created_date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results count when filtered */}
        {!loading && !error && items.length > 0 && filteredItems.length > 0 && (statusFilter !== 'all' || showMine || showMyVotes) && (
          <p className="text-xs text-slate-400 text-center mt-4">
            Mostrando {filteredItems.length} de {items.length} propuesta{items.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Modal: Proponer mejora ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Proponer mejora</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ej: Filtrar add-ons por precio"
                  maxLength={120}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Explica el problema que resuelve o cómo debería funcionar..."
                  rows={4}
                  maxLength={1000}
                  required
                  className="resize-none text-sm"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{formDesc.length}/1000</p>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={submitting || formTitle.trim().length < 5 || formDesc.trim().length < 10}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  Enviar propuesta
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
