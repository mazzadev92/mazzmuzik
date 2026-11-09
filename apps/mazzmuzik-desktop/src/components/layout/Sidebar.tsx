import React from 'react';
import {
  Compass,
  Search,
  Radio,
  Library,
  ListMusic,
  Download,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

export type ActiveTab =
  | 'home'
  | 'search'
  | 'radio'
  | 'library'
  | 'playlists'
  | 'downloads'
  | 'settings';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { isUpdatingTools } = useSettingsStore();

  const navItems = [
    { id: 'home' as ActiveTab, label: 'Accueil', icon: Compass },
    { id: 'search' as ActiveTab, label: 'Recherche', icon: Search },
    { id: 'radio' as ActiveTab, label: 'Radios Direct', icon: Radio },
    { id: 'library' as ActiveTab, label: 'Bibliothèque', icon: Library },
    { id: 'playlists' as ActiveTab, label: 'Playlists', icon: ListMusic },
    { id: 'downloads' as ActiveTab, label: 'Téléchargements', icon: Download },
  ];

  return (
    <aside className="hidden md:flex w-60 min-w-60 h-full bg-surface border-r border-border flex-col justify-between select-none z-10">
      {/* Brand Header */}
      <div>
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-surface-hi/80 border border-border flex items-center justify-center p-1 shadow-sm">
            <img
              src="/icon.png"
              alt="MazzMuziK"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-apex-white text-base tracking-wide">
                MazzMuziK
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-surface-hi text-champagne border border-border shadow-inner'
                    : 'text-warm-stone/80 hover:text-apex-white hover:bg-surface-hi/50'
                }`}
              >
                <Icon
                  size={18}
                  className={isActive ? 'text-champagne' : 'text-sage/70'}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Settings & Status */}
      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentTab === 'settings'
              ? 'bg-surface-hi text-champagne border border-border'
              : 'text-warm-stone/80 hover:text-apex-white hover:bg-surface-hi/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Settings
              size={18}
              className={currentTab === 'settings' ? 'text-champagne' : 'text-sage/70'}
            />
            <span>Réglages</span>
          </div>
          {isUpdatingTools && (
            <Sparkles size={14} className="text-champagne animate-spin" />
          )}
        </button>
      </div>
    </aside>
  );
};
