import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Compass, Search, Radio, Library, Settings } from 'lucide-react';
import { Sidebar, type ActiveTab } from './components/layout/Sidebar';
import { BottomPlayer } from './components/player/BottomPlayer';
import { RightPanel } from './components/layout/RightPanel';
import { EqualizerModal } from './components/player/EqualizerModal';
import { NowPlayingModal } from './components/player/NowPlayingModal';
import { ShaderVisualizer } from './components/player/ShaderVisualizer';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { RadioView } from './views/RadioView';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';
import { useSettingsStore } from './store/settingsStore';
import { audioEngine } from './services/audioEngine';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes cache
      gcTime: 60 * 60 * 1000,    // 1 hour garbage collection
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ActiveTab>('home');

  useEffect(() => {
    // Initialise audio engine with persisted equalizer settings on startup
    const bands = useSettingsStore.getState().eqBands;
    if (bands && bands.length === 10) {
      audioEngine.setEqualizerGains(bands);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative w-full h-[100dvh] flex flex-col bg-obsidian text-apex-white overflow-hidden select-none font-sans">
        {/* Background WebGL Shader Visualizer */}
        <ShaderVisualizer />

        {/* Top/Main Container: Sidebar + Content + RightPanel */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

          <main className="flex-1 flex flex-col min-w-0 bg-obsidian/90 backdrop-blur-sm relative overflow-hidden pt-[env(safe-area-inset-top)] md:pt-0">
            {currentTab === 'home' && <HomeView />}
            {currentTab === 'search' && <SearchView />}
            {currentTab === 'radio' && <RadioView />}
            {currentTab === 'library' && <LibraryView />}
            {currentTab === 'playlists' && <LibraryView />}
            {currentTab === 'downloads' && <LibraryView />}
            {currentTab === 'settings' && <SettingsView />}
          </main>

          <RightPanel />
        </div>

        {/* Fixed Bottom Player Bar */}
        <BottomPlayer />

        {/* Mobile Bottom Navigation Bar (iPhone / Android) */}
        <nav className="md:hidden shrink-0 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around z-20 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] select-none">
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              currentTab === 'home' ? 'text-champagne font-semibold' : 'text-warm-stone/60'
            }`}
          >
            <Compass size={18} />
            <span className="text-[10px]">Accueil</span>
          </button>

          <button
            onClick={() => setCurrentTab('search')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              currentTab === 'search' ? 'text-champagne font-semibold' : 'text-warm-stone/60'
            }`}
          >
            <Search size={18} />
            <span className="text-[10px]">Recherche</span>
          </button>

          <button
            onClick={() => setCurrentTab('radio')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              currentTab === 'radio' ? 'text-champagne font-semibold' : 'text-warm-stone/60'
            }`}
          >
            <Radio size={18} />
            <span className="text-[10px]">Radios</span>
          </button>

          <button
            onClick={() => setCurrentTab('library')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              currentTab === 'library' || currentTab === 'playlists' ? 'text-champagne font-semibold' : 'text-warm-stone/60'
            }`}
          >
            <Library size={18} />
            <span className="text-[10px]">Bibliothèque</span>
          </button>

          <button
            onClick={() => setCurrentTab('settings')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
              currentTab === 'settings' ? 'text-champagne font-semibold' : 'text-warm-stone/60'
            }`}
          >
            <Settings size={18} />
            <span className="text-[10px]">Réglages</span>
          </button>
        </nav>

        {/* 10-Band Equalizer Modal */}
        <EqualizerModal />

        {/* Full Screen Spotify-style Now Playing Modal */}
        <NowPlayingModal />
      </div>
    </QueryClientProvider>
  );
};
export default App;
