import React from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Floating button to summon Copilot from any view in the app
export function HybridAgentFloatingTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-xs sm:text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-400/30 group"
      title="Open TradeFlow Hybrid AI Copilot"
    >
      <div className="relative">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
      </div>
      <span className="font-semibold tracking-wide">AI Copilot</span>
      <Badge className="bg-white/20 text-white text-[9px] px-1.5 py-0 border-none font-mono">
        Hybrid
      </Badge>
    </button>
  );
}
