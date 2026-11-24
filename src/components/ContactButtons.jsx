import React from 'react';
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Globe } from "lucide-react";
import { getWhatsAppLink, normalizeWebsite } from './helpers';
import { api } from '@/api/client';

export default function ContactButtons({ whatsapp, email, website, addonId, size = "sm" }) {
  const btnClass = size === "lg" ? "h-10 px-4" : "h-8 px-3 text-xs";

  const handleContactClick = (channel) => {
    if (!addonId) return;
    api.functions.invoke('registerContactEvent', { addonId, channel }).catch(err =>
      console.error('[ContactButtons] registerContactEvent failed', err)
    );
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {whatsapp && (
        <a href={getWhatsAppLink(whatsapp)} target="_blank" rel="noopener noreferrer" onClick={() => handleContactClick('whatsapp')}>
          <Button variant="outline" size="sm" className={`${btnClass} text-green-600 border-green-200 hover:bg-green-50`}>
            <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
          </Button>
        </a>
      )}
      {email && email.includes('@') && (
        <a href={`mailto:${email}`} onClick={() => handleContactClick('email')}>
          <Button variant="outline" size="sm" className={`${btnClass} text-blue-600 border-blue-200 hover:bg-blue-50`}>
            <Mail className="w-4 h-4 mr-1.5" /> Email
          </Button>
        </a>
      )}
      {website && (
        <a href={normalizeWebsite(website)} target="_blank" rel="noopener noreferrer" onClick={() => handleContactClick('web')}>
          <Button variant="outline" size="sm" className={`${btnClass} text-slate-600 border-slate-200 hover:bg-slate-50`}>
            <Globe className="w-4 h-4 mr-1.5" /> Web
          </Button>
        </a>
      )}
    </div>
  );
}
