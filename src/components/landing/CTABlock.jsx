import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function CTABlock({ icon: Icon, iconBg, iconColor, heading, description, ctaLabel, ctaHref, note, bg = 'bg-white' }) {
  return (
    <section className={`py-20 ${bg} border-y border-slate-200`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center mx-auto mb-6`}>
          <Icon className={`w-7 h-7 ${iconColor}`} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{heading}</h2>
        <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto">{description}</p>
        <Button
          size="lg"
          variant="outline"
          className="h-12 px-8 rounded-xl"
          onClick={() => { window.location.href = ctaHref; }}
        >
          {ctaLabel} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        {note && <p className="text-sm text-slate-400 mt-4">{note}</p>}
      </div>
    </section>
  );
}
