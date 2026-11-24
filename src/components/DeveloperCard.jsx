import React from 'react';
import { Badge } from "@/components/ui/badge";
import { User, AlertCircle } from "lucide-react";
import SystemBadge from './SystemBadge';
import ContactButtons from './ContactButtons';
import { isProfileComplete } from './helpers';

export default function DeveloperCard({ profile }) {
  if (!profile) return null;
  
  const { complete } = isProfileComplete(profile);
  
  return (
    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{profile.displayName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <SystemBadge contpaqi={profile.contpaqi} softrestaurant={profile.softrestaurant} />
            {!complete && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                <AlertCircle className="w-3 h-3 mr-1" /> Perfil incompleto
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {profile.bio && (
        <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">{profile.bio}</p>
      )}
      
      <ContactButtons 
        whatsapp={profile.whatsapp} 
        email={profile.supportEmail} 
        website={profile.website} 
      />
    </div>
  );
}