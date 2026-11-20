import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Calculator,
  Database,
  FileCheck2,
  Globe2,
  Truck,
  X,
} from 'lucide-react';
import type { NavSection } from '../types/skyguard';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  openAnomalyCount: number;
  pendingCloseLineCount: number;
  brokerVarianceCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'executive', label: 'Executive Overview', icon: BarChart3 },
  { id: 'anomalies', label: 'Cost Intelligence', icon: AlertTriangle },
  { id: 'close', label: 'Quarterly Close', icon: FileCheck2 },
  { id: 'trade', label: 'Trade Intelligence', icon: Globe2 },
  { id: 'interprovincial', label: 'Interprovincial Costs', icon: Truck },
  { id: 'analyst', label: 'AI Financial Analyst', icon: Bot },
  { id: 'roi', label: 'Business Impact & ROI', icon: Calculator },
  { id: 'data', label: 'Data Management', icon: Database },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  openAnomalyCount,
  pendingCloseLineCount,
  brokerVarianceCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const [logoError, setLogoError] = useState(false);

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col bg-white text-[#333333] select-none">
      {/* Genuine SKYJACK Brand Logo on crisp white canvas + SKYGUARD AI product label */}
      <div className="px-5 py-5 border-b border-stone-200 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {!logoError ? (
            <img
              src="/assets/aistudio/image_6dc12cf5.png"
              alt="SKYJACK — simply reliable"
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-9 max-w-[175px] w-auto object-contain"
            />
          ) : (
            <span className="text-lg font-bold tracking-tight text-[#333333]">
              SKYJACK
            </span>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-[#333333] focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="pt-1 border-t border-stone-100">
          <div className="text-xs font-semibold tracking-tight text-[#F04F25]">
            SKYGUARD AI
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
            Student competition prototype — not an official SKYJACK deployment.
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary sections" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[11px] font-medium text-stone-500">
          Workspaces
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const count =
            item.id === 'anomalies'
              ? openAnomalyCount
              : item.id === 'close'
              ? pendingCloseLineCount
              : item.id === 'trade'
              ? brokerVarianceCount
              : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#F04F25] ${
                isActive
                  ? 'bg-[#FFF3ED] text-[#D9421B] font-semibold'
                  : 'text-[#333333] hover:bg-[#F6F5F3]'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[#F04F25]' : 'text-stone-500'
                  }`}
                />
                <span className="whitespace-nowrap truncate">{item.label}</span>
              </span>
              {count !== null && count > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums shrink-0 ${
                    isActive ? 'text-[#F04F25]' : 'text-stone-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Active Threshold Summary */}
        <div className="pt-5 px-3">
          <div className="border-t border-stone-200 pt-4 space-y-2.5">
            <div className="text-[11px] font-medium text-stone-500">
              Control Thresholds
            </div>
            <div className="space-y-2 text-xs text-stone-600">
              <div className="flex items-center justify-between gap-2">
                <span>Walk Materiality</span>
                <span className="font-mono tabular-nums font-medium text-[#333333]">
                  CAD $1.0M
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Entry Screen</span>
                <span className="font-mono tabular-nums font-medium text-[#333333]">
                  CAD $250K
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Broker Contract</span>
                <span className="font-mono tabular-nums font-medium text-[#333333]">
                  0.20%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>China Extra Rate</span>
                <span className="font-mono tabular-nums font-medium text-[#333333]">
                  25.0%
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Case Personas Footer */}
      <div className="border-t border-stone-200 px-4 py-3.5 bg-[#FAFAFA]">
        <div className="text-[11px] font-medium text-stone-500">
          Case Workflow Roles
        </div>
        <div className="mt-1 text-xs text-[#333333]">
          Dana (Plant) · Helen (Close) · Marco (Trade)
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-stone-200 bg-white">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-xl border-r border-stone-200 bg-white">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
