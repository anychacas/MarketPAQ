import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import AddonCard from '@/components/AddonCard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Package, X, SlidersHorizontal, ChevronDown, Heart } from "lucide-react";
import { hasContactAvailable } from '@/components/helpers';

export default function AddonsCatalog() {
  return (
    <AuthGuard>
      <CatalogContent />
    </AuthGuard>
  );
}

function CatalogContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [addons, setAddons] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [system, setSystem] = useState(searchParams.get('system') || 'all');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [manufacturer, setManufacturer] = useState(searchParams.get('eco') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [tagSearch, setTagSearch] = useState('');
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [priceMin, setPriceMin] = useState(searchParams.get('pmin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('pmax') || '');
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mpq:favorites') || '[]'); } catch { return []; }
  });

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('mpq:favorites', JSON.stringify(next));
      return next;
    });
  };

  // Sync filter state to URL params
  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (system !== 'all') params.system = system;
    if (selectedTag) params.tag = selectedTag;
    if (manufacturer !== 'all') params.eco = manufacturer;
    if (sortBy !== 'recent') params.sort = sortBy;
    if (priceMin) params.pmin = priceMin;
    if (priceMax) params.pmax = priceMax;
    setSearchParams(params, { replace: true });
  }, [q, system, selectedTag, manufacturer, sortBy, priceMin, priceMax]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      const allAddons = await api.entities.Addons.filter({ status: 'published' });
      setAddons(allAddons);

      const ownerIds = [...new Set(allAddons.map(a => a.ownerUserId).filter(Boolean))];
      if (ownerIds.length > 0) {
        const allProfiles = await api.entities.DeveloperProfiles.list();
        const map = {};
        allProfiles.forEach(p => { map[p.userId] = p; });
        setProfiles(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const allTagsWithCount = useMemo(() => {
    const tagCount = {};
    addons.forEach(a => a.tags?.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([tag, count]) => ({ tag, count }));
  }, [addons]);

  const allTags = useMemo(() => allTagsWithCount.map(t => t.tag), [allTagsWithCount]);

  const allSystems = useMemo(() => {
    const sysSet = new Set();
    addons.forEach(a => { if (a.system) sysSet.add(a.system); });
    return [...sysSet].sort((a, b) => a.localeCompare(b, 'es'));
  }, [addons]);

  const allDevelopers = useMemo(() => {
    const devSet = new Set();
    addons.forEach(a => {
      const profile = profiles[a.ownerUserId];
      if (profile?.displayName) devSet.add(profile.displayName);
    });
    return [...devSet].sort();
  }, [addons, profiles]);

  const filtered = useMemo(() => {
    const minVal = priceMin !== '' ? parseFloat(priceMin) : null;
    const maxVal = priceMax !== '' ? parseFloat(priceMax) : null;

    let result = addons.filter(a => {
      if (manufacturer === 'contpaqi' && !a.contpaqi) return false;
      if (manufacturer === 'softrestaurant' && !a.softrestaurant) return false;
      if (manufacturer === 'otro' && (a.contpaqi || a.softrestaurant)) return false;
      if (system !== 'all' && a.system !== system) return false;
      if (selectedTag && !(a.tags || []).includes(selectedTag)) return false;
      if (showFavorites && !favorites.includes(a.id)) return false;

      // Price filter — addons with no price are always shown unless filter is set
      if (minVal !== null && (a.priceFrom == null || a.priceFrom < minVal)) return false;
      if (maxVal !== null && (a.priceFrom == null || a.priceFrom > maxVal)) return false;

      if (q) {
        const search = q.toLowerCase();
        const profile = profiles[a.ownerUserId];
        const devName = profile?.displayName || '';
        const searchable = `${a.name} ${a.summary} ${a.vendor} ${devName} ${(a.tags || []).join(' ')}`.toLowerCase();
        if (!searchable.includes(search)) return false;
      }
      return true;
    });

    // Sorting
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price_asc') {
      result.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => (b.priceFrom ?? -Infinity) - (a.priceFrom ?? -Infinity));
    }

    return result;
  }, [addons, q, system, selectedTag, manufacturer, sortBy, profiles, priceMin, priceMax, showFavorites, favorites]);

  const hasFilters = q || system !== 'all' || selectedTag || manufacturer !== 'all' || priceMin || priceMax || showFavorites;

  const clearFilters = () => {
    setQ('');
    setSystem('all');
    setSelectedTag('');
    setManufacturer('all');
    setPriceMin('');
    setPriceMax('');
    setShowFavorites(false);
    setTagSearch('');
    setTagsExpanded(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Catálogo de add-ons</h1>
          <p className="text-lg text-slate-600">Explora soluciones enfocadas en CONTPAQi y SoftRestaurant</p>
        </div>

        {/* Search bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, sistema o developer…" 
              value={q} 
              onChange={e => setQ(e.target.value)}
              className="pl-12 h-14 text-base rounded-xl border-slate-200 bg-white shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters panel */}
          <aside className="lg:w-72 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" />
                  Filtros
                </h2>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 h-8">
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Ecosistema */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">Ecosistema</label>
                  <Select value={manufacturer} onValueChange={setManufacturer}>
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="contpaqi">CONTPAQi</SelectItem>
                      <SelectItem value="softrestaurant">SoftRestaurant</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sistema */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">Sistema</label>
                  <Select value={system} onValueChange={setSystem}>
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {allSystems.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Precio */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">Precio (MXN)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Mín"
                      value={priceMin}
                      onChange={e => setPriceMin(e.target.value)}
                      className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
                    />
                    <span className="text-slate-400 text-sm flex-shrink-0">–</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Máx"
                      value={priceMax}
                      onChange={e => setPriceMax(e.target.value)}
                      className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
                    />
                  </div>
                </div>

                {/* Favoritos */}
                <div>
                  <button
                    onClick={() => setShowFavorites(v => !v)}
                    className={`w-full flex items-center gap-2.5 h-10 px-3 rounded-lg border text-sm font-medium transition-all ${
                      showFavorites
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 flex-shrink-0 ${showFavorites ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                    Mis favoritos
                    {favorites.length > 0 && (
                      <span className={`ml-auto text-xs font-semibold rounded-full px-1.5 py-0.5 ${showFavorites ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                        {favorites.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Clasificación (Tags) */}
                {allTagsWithCount.length > 0 && (() => {
                  const LIMIT = 8;
                  const visibleTags = allTagsWithCount.filter(({ tag }) =>
                    tag.toLowerCase().includes(tagSearch.toLowerCase())
                  );
                  const displayTags = (!tagsExpanded && !tagSearch)
                    ? visibleTags.slice(0, LIMIT)
                    : visibleTags;
                  const hiddenCount = visibleTags.length - LIMIT;

                  return (
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-3 block">Clasificación</label>

                      {/* Search within tags */}
                      <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar categoría…"
                          value={tagSearch}
                          onChange={e => setTagSearch(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
                        />
                        {tagSearch && (
                          <button
                            onClick={() => setTagSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Tag pills */}
                      <div className="flex flex-wrap gap-2">
                        {displayTags.map(({ tag, count }) => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                          >
                            <Badge
                              variant={selectedTag === tag ? 'default' : 'outline'}
                              className={`cursor-pointer transition-all flex items-center gap-1 ${
                                selectedTag === tag
                                  ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white'
                                  : 'text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                              }`}
                            >
                              {tag}
                              <span className={`text-[10px] font-normal ${selectedTag === tag ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {count}
                              </span>
                            </Badge>
                          </button>
                        ))}
                      </div>

                      {/* Ver más / Ver menos */}
                      {!tagSearch && visibleTags.length > LIMIT && (
                        <button
                          onClick={() => setTagsExpanded(!tagsExpanded)}
                          className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
                        >
                          {tagsExpanded
                            ? <><ChevronDown className="w-3 h-3 rotate-180 transition-transform" /> Ver menos</>
                            : <><ChevronDown className="w-3 h-3 transition-transform" /> Ver {hiddenCount} más</>
                          }
                        </button>
                      )}

                      {tagSearch && visibleTags.length === 0 && (
                        <p className="text-xs text-slate-400 py-1">Sin resultados para "{tagSearch}"</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Results bar */}
            <div className="flex items-center justify-between mb-6 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <span className="text-sm font-medium text-slate-700">
                Mostrando <span className="text-indigo-600 font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'resultado' : 'resultados'}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 hidden sm:inline">Ordenar por:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-36 h-9 rounded-lg border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Más recientes</SelectItem>
                    <SelectItem value="name">A-Z</SelectItem>
                    <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
                    <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
                    <div className="h-3 bg-slate-100 rounded w-full mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No encontramos add-ons con estos filtros</h3>
                <p className="text-slate-500 mb-6">Intenta ajustar tus criterios de búsqueda</p>
                {hasFilters && (
                  <Button variant="outline" onClick={clearFilters} className="rounded-xl">
                    <X className="w-4 h-4 mr-2" /> Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map(addon => (
                  <AddonCard
                    key={addon.id}
                    addon={addon}
                    developer={profiles[addon.ownerUserId]?.displayName}
                    hasContact={hasContactAvailable(addon, profiles[addon.ownerUserId])}
                    isFavorite={favorites.includes(addon.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}