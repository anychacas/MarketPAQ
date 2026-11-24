import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import AuthGuard from '@/components/AuthGuard';
import { Badge } from "@/components/ui/badge";
import { Loader2, User, UserCheck } from "lucide-react";
import { useNoIndex } from '@/lib/useNoIndex';

export default function AdminDevelopers() {
  useNoIndex();
  return (
    <AuthGuard requiredRoles={['admin']}>
      <DevelopersContent />
    </AuthGuard>
  );
}

function DevelopersContent() {
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDevelopers = async () => {
    const users = await api.entities.User.list('-created_date', 200);
    // Show developers and partner_leaders
    const devs = users.filter(u => u.userType === 'developer' || u.userType === 'partner_leader');
    setDevelopers(devs);
    setLoading(false);
  };

  useEffect(() => {
    loadDevelopers();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Gestionar Developers</h1>
      <p className="text-slate-500 mb-6">Developers y Partner Líderes registrados</p>

      {developers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay developers registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {developers.map(dev => (
            <div key={dev.id} className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-slate-900">{dev.full_name || dev.email}</h3>
                  {dev.userType === 'partner_leader' && (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                      <UserCheck className="w-3 h-3 mr-1" /> Partner Líder
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">{dev.email}</p>
                {dev.company && <p className="text-xs text-slate-400 mt-0.5">{dev.company}</p>}
                {dev.partnerLeaderCode && (
                  <p className="text-xs text-purple-600 mt-0.5 font-mono">Código: {dev.partnerLeaderCode}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
