"use client";

import React, { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { Wifi, WifiOff } from "lucide-react";

export interface NetworkStatusIndicatorProps {
  className?: string;
  forceOnline?: boolean;
  showText?: boolean;
}

/**
 * Indicador sutil de conectividade de bancada operacional (Online / Offline).
 * Utiliza eventos nativos window.addEventListener('online'/'offline')
 * com atualização de estado reativa.
 */
export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  className,
  forceOnline,
  showText = true,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof forceOnline === "boolean") return forceOnline;
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    if (typeof forceOnline === "boolean") {
      setIsOnline(forceOnline);
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [forceOnline]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Status da conexão: ${isOnline ? "Online" : "Offline"}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-mono select-none px-2 py-0.5 border rounded",
        isOnline
          ? "text-zinc-600 bg-zinc-50 border-zinc-200"
          : "text-rose-700 bg-rose-50 border-rose-200",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isOnline ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
        )}
        aria-hidden="true"
      />
      {isOnline ? (
        <Wifi className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
      ) : (
        <WifiOff className="w-3 h-3 text-rose-600 shrink-0" aria-hidden="true" />
      )}
      {showText && (
        <span className="font-semibold tracking-wider text-[11px] uppercase">
          {isOnline ? "Online" : "Offline"}
        </span>
      )}
    </div>
  );
};

NetworkStatusIndicator.displayName = "NetworkStatusIndicator";
