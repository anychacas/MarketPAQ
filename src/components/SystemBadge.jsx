import React from 'react';
import { Badge } from "@/components/ui/badge";

export default function SystemBadge({ contpaqi, softrestaurant, size = "sm" }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {contpaqi && (
        <Badge variant="secondary" className={`bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 ${size === "lg" ? "text-sm px-3 py-1" : "text-xs"}`}>
          CONTPAQi
        </Badge>
      )}
      {softrestaurant && (
        <Badge variant="secondary" className={`bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 ${size === "lg" ? "text-sm px-3 py-1" : "text-xs"}`}>
          SoftRestaurant
        </Badge>
      )}
    </div>
  );
}