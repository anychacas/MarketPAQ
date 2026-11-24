import React from 'react';
import { BookOpen, MessageSquare, Globe, Lightbulb } from 'lucide-react';

const ITEMS = [
  { icon: BookOpen,     label: 'Catálogo especializado', cls: 'bg-blue-50 text-blue-700 border-blue-200',   iconCls: 'text-blue-600' },
  { icon: MessageSquare,label: 'Contacto directo',   cls: 'bg-green-50 text-green-700 border-green-200', iconCls: 'text-green-600' },
  { icon: Globe,        label: 'Perfiles públicos',  cls: 'bg-purple-50 text-purple-700 border-purple-200', iconCls: 'text-purple-600' },
  { icon: Lightbulb,   label: 'Centro de mejoras',  cls: 'bg-amber-50 text-amber-700 border-amber-200',  iconCls: 'text-amber-600' },
];

export default function ProofStrip() {
  return (
    <div className="py-8 border-y border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ITEMS.map(({ icon: Icon, label, cls, iconCls }) => (
            <div key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cls}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${iconCls}`} />
              <span className="text-sm font-medium leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
