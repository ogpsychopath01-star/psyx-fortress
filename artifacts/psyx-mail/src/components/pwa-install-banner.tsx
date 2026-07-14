import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, X } from "lucide-react";
import { useState } from "react";

export function PwaInstallBanner() {
  const { canInstall, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border"
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0000 100%)",
          borderColor: "#cc0000",
          boxShadow: "0 0 20px rgba(204,0,0,0.3)",
        }}
      >
        <img src="/icon-72.png" alt="PSYX" className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-tight">Install PSYX FORTRESS</p>
          <p className="text-gray-400 text-xs mt-0.5 leading-tight">Add to home screen for the full app experience</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={install}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "#cc0000", color: "#fff" }}
          >
            <Download size={12} />
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
