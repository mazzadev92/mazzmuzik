import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ==========================================
// DA MAZZ : TOKENS OFFICIELS (D:\Mazz Laef)
// ==========================================
const TOKENS = {
  OBSIDIAN: '#090D0A',          // Fond principal noir-vert obsidienne (OLED)
  OBSIDIAN_SURFACE: '#121714',  // Surfaces cartes et lecteur
  OBSIDIAN_BORDER: '#1D2A22',   // Bordure hairline 1px
  FOREST: '#123C2C',           // Ombre chloroplaste
  LIVING_GREEN: '#2F674A',      // Accent actif
  SAGE_GREEN: '#94B89A',        // Titres & progression
  EUCALYPTUS: '#6B8F7A',        // Sous-titres & détails
  WARM_STONE: '#D8CAB7',        // Texte secondaire doux
  CHAMPAGNE: '#C9A57A',         // Boutons premium, curseurs, glow
  CHAMPAGNE_GLOW: 'rgba(201, 165, 122, 0.35)',
  COPPER: '#A87D54',           // Alertes discrètes
  APEX_WHITE: '#F4F1EA',        // Blanc chaud luminescent (zéro #FFFFFF)
};

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  durationSec: number;
  audioUrl: string;
  lyrics?: { timeSec: number; text: string }[];
}

// Morceaux initiaux DA MAZZ (Haute Fidélité)
const INITIAL_TRACKS: Track[] = [
  {
    id: 'mazz-1',
    title: 'Bioforge Intelligence',
    artist: 'MAZZ',
    album: 'Engineering Tomorrow',
    artworkUrl: '',
    durationSec: 198,
    audioUrl: 'https://cdn.freesound.org/previews/735/735391_6142149-lq.mp3',
    lyrics: [
      { timeSec: 0, text: 'Nature intelligence. Engineered progress.' },
      { timeSec: 8, text: 'The BioForge Leaf unites biology and science.' },
      { timeSec: 20, text: 'A seed at its core represents infinite possibility.' },
      { timeSec: 42, text: 'Living intelligence organizes tomorrow.' },
      { timeSec: 68, text: 'Autonomous audio architecture in sync.' },
      { timeSec: 95, text: 'Mazz MuZik streaming with zero friction.' },
      { timeSec: 130, text: 'Pure sound. Zero telemetry.' },
    ],
  },
  {
    id: 'mazz-2',
    title: 'Obsidian Resonance',
    artist: 'Tessera',
    album: 'Deep State Architecture',
    artworkUrl: '',
    durationSec: 215,
    audioUrl: 'https://cdn.freesound.org/previews/734/734891_5674468-lq.mp3',
    lyrics: [
      { timeSec: 0, text: 'Signal traversing the neural layers.' },
      { timeSec: 18, text: 'Deep chlorophyll harmonics pulse.' },
      { timeSec: 40, text: 'Obsidian surface, infinite reflection.' },
      { timeSec: 75, text: 'Engineered for human resonance.' },
    ],
  },
  {
    id: 'mazz-3',
    title: 'Eucalyptus Canopy',
    artist: 'Bioforge Core',
    album: 'Living System',
    artworkUrl: '',
    durationSec: 180,
    audioUrl: 'https://cdn.freesound.org/previews/730/730707_12704381-lq.mp3',
    lyrics: [
      { timeSec: 0, text: 'Dawn over the digital canopy.' },
      { timeSec: 22, text: 'Photosynthetic rhythms unfolding.' },
      { timeSec: 54, text: 'Clarity, balance, continuous growth.' },
    ],
  },
];

export default function AppWrapper() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(INITIAL_TRACKS[0]);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Moteur Audio moderne Expo Audio
  const player = useAudioPlayer(currentTrack?.audioUrl || null);
  const status = useAudioPlayerStatus(player);

  const glowAnim = useRef(new Animated.Value(0.7)).current;
  const lyricsScrollRef = useRef<any>(null);

  // Configuration Audio iOS arrière-plan & veille
  useEffect(() => {
    async function configureAudio() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
      } catch (err) {
        console.warn('Audio config error:', err);
      }
    }
    configureAudio();

    // Pulse subtil du logo Bioforge Leaf
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1.0, duration: 2400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.65, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Recherche universelle en direct (Apple Music / Global Catalog)
  const performSearch = async (query: string) => {
    const q = query.trim();
    if (!q) {
      setTracks(INITIAL_TRACKS);
      return;
    }

    setIsSearching(true);
    Keyboard.dismiss();
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=25`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const fetchedTracks: Track[] = data.results
          .filter((item: any) => item.previewUrl)
          .map((item: any) => ({
            id: String(item.trackId),
            title: item.trackName || 'Sans titre',
            artist: item.artistName || 'Artiste inconnu',
            album: item.collectionName || 'Single',
            artworkUrl: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
            durationSec: Math.round((item.trackTimeMillis || 30000) / 1000),
            audioUrl: item.previewUrl,
            lyrics: [
              { timeSec: 0, text: `Écoute de "${item.trackName}"` },
              { timeSec: 5, text: `Par ${item.artistName}` },
              { timeSec: 12, text: `Album : ${item.collectionName || 'Single'}` },
              { timeSec: 20, text: 'Flux direct haute fidélité MazzMuziK' },
            ],
          }));

        if (fetchedTracks.length > 0) {
          setTracks(fetchedTracks);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Lecture d'un morceau
  const playTrack = (track: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTrack(track);
    player.replace(track.audioUrl);
    player.play();
  };

  const togglePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const playNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    playTrack(tracks[nextIndex]);
  };

  const playPrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrack(tracks[prevIndex]);
  };

  const seek = (ratio: number) => {
    Haptics.selectionAsync();
    const duration = status.duration || currentTrack?.durationSec || 1;
    const targetSec = ratio * duration;
    player.seekTo(targetSec);
  };

  const formatTime = (sec: number) => {
    const totalSec = Math.floor(sec || 0);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentTime = status.currentTime || 0;
  const duration = status.duration || currentTrack?.durationSec || 1;
  const progress = duration > 0 ? currentTime / duration : 0;
  const isPlaying = status.playing;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* HEADER DA MAZZ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('./assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerBrand}>MAZZ</Text>
            <Text style={styles.headerTagline}>Engineering Tomorrow</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>MazzMuziK</Text>
        </View>
      </View>

      {/* BARRE DE RECHERCHE EN DIRECT */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color={TOKENS.EUCALYPTUS} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher tout son, rap, artiste..."
            placeholderTextColor={TOKENS.EUCALYPTUS}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => performSearch(searchQuery)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={TOKENS.CHAMPAGNE} style={{ marginRight: 10 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => performSearch(searchQuery)}>
              <Ionicons name="arrow-forward-circle" size={24} color={TOKENS.CHAMPAGNE} style={{ marginRight: 8 }} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* TITRE SECTION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'RÉSULTATS DE RECHERCHE' : 'SÉLECTIONS MAZZ'}
        </Text>
        <Text style={styles.sectionSub}>Flux audio haute fidélité • Zéro pub</Text>
      </View>

      {/* LISTE DES MORCEAUX */}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = currentTrack?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.trackCard, isSelected && styles.trackCardActive]}
              onPress={() => playTrack(item)}
              activeOpacity={0.75}
            >
              <View style={styles.trackThumb}>
                {item.artworkUrl ? (
                  <Image source={{ uri: item.artworkUrl }} style={styles.trackThumbImgCover} />
                ) : (
                  <Image source={require('./assets/logo.png')} style={styles.trackThumbImg} resizeMode="contain" />
                )}
              </View>
              <View style={styles.trackDetails}>
                <Text
                  style={[styles.trackTitle, isSelected && { color: TOKENS.CHAMPAGNE }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.artist} • {item.album}
                </Text>
              </View>
              <Text style={styles.trackDuration}>
                {Math.floor(item.durationSec / 60)}:{(item.durationSec % 60).toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* MINI-PLAYER FLOTTANT AU-DESSUS DU HOME INDICATOR */}
      {currentTrack && (
        <TouchableOpacity
          style={[styles.miniPlayer, { bottom: Math.max(14, insets.bottom) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFullPlayerVisible(true);
          }}
          activeOpacity={0.9}
        >
          <View style={styles.miniProgressBar}>
            <View style={[styles.miniProgressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.miniPlayerRow}>
            <View style={styles.miniThumbContainer}>
              {currentTrack.artworkUrl ? (
                <Image source={{ uri: currentTrack.artworkUrl }} style={styles.miniThumb} />
              ) : (
                <Image source={require('./assets/logo.png')} style={styles.miniThumb} resizeMode="contain" />
              )}
            </View>
            <View style={styles.miniDetails}>
              <Text style={styles.miniTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.miniArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <TouchableOpacity style={styles.miniPlayBtn} onPress={togglePlayPause}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={TOKENS.OBSIDIAN}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniNextBtn} onPress={playNext}>
              <Ionicons name="play-skip-forward" size={20} color={TOKENS.APEX_WHITE} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* GRAND LECTEUR IMMERSIF (NOW PLAYING MODAL) */}
      <Modal
        visible={fullPlayerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
          {/* HEADER MODAL */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFullPlayerVisible(false);
              }}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="chevron-down" size={28} color={TOKENS.APEX_WHITE} />
            </TouchableOpacity>
            <View style={styles.modalTitleBox}>
              <Text style={styles.modalBrand}>MAZZ MUZIK</Text>
              <Text style={styles.modalAlbum} numberOfLines={1}>
                {currentTrack?.album || 'Engineering Tomorrow'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLyrics(!showLyrics);
              }}
              style={[styles.lyricsToggleBtn, showLyrics && styles.lyricsToggleActive]}
            >
              <Text style={[styles.lyricsToggleText, showLyrics && { color: TOKENS.OBSIDIAN }]}>
                LRC
              </Text>
            </TouchableOpacity>
          </View>

          {/* CENTRE : POCHETTE HD OU PAROLES SYNCHRONISÉES */}
          <View style={styles.modalCenter}>
            {showLyrics ? (
              <ScrollView
                ref={lyricsScrollRef}
                style={styles.lyricsScroll}
                contentContainerStyle={styles.lyricsContent}
                showsVerticalScrollIndicator={false}
              >
                {currentTrack?.lyrics && currentTrack.lyrics.length > 0 ? (
                  currentTrack.lyrics.map((line, idx) => {
                    const nextLine = currentTrack.lyrics![idx + 1];
                    const isActive =
                      currentTime >= line.timeSec &&
                      (!nextLine || currentTime < nextLine.timeSec);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          Haptics.selectionAsync();
                          player.seekTo(line.timeSec);
                        }}
                      >
                        <Text style={[styles.lyricLine, isActive && styles.lyricLineActive]}>
                          {line.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.noLyricsText}>Aucune parole synchronisée</Text>
                )}
              </ScrollView>
            ) : (
              <Animated.View style={[styles.coverBox, { opacity: glowAnim }]}>
                {currentTrack?.artworkUrl ? (
                  <Image source={{ uri: currentTrack.artworkUrl }} style={styles.coverImageCover} />
                ) : (
                  <Image source={require('./assets/logo.png')} style={styles.coverImage} resizeMode="contain" />
                )}
              </Animated.View>
            )}
          </View>

          {/* DÉTAILS MORCEAU */}
          <View style={styles.modalTrackInfo}>
            <Text style={styles.modalTrackTitle} numberOfLines={1}>
              {currentTrack?.title}
            </Text>
            <Text style={styles.modalTrackArtist} numberOfLines={1}>
              {currentTrack?.artist}
            </Text>
          </View>

          {/* BARRE DE PROGRESSION TACTILE */}
          <View style={styles.progressSection}>
            <TouchableOpacity
              style={styles.progressTrack}
              activeOpacity={1}
              onPress={(e) => {
                const width = Dimensions.get('window').width - 48;
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
                seek(ratio);
              }}
            >
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </TouchableOpacity>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* COMMANDES DE LECTURE NATIVES */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={playPrevious} style={styles.sideControlBtn}>
              <Ionicons name="play-skip-back-sharp" size={32} color={TOKENS.APEX_WHITE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlayPause} style={styles.mainPlayBtn}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color={TOKENS.OBSIDIAN}
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={playNext} style={styles.sideControlBtn}>
              <Ionicons name="play-skip-forward-sharp" size={32} color={TOKENS.APEX_WHITE} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// FEUILLE DE STYLE DA MAZZ BIOFORGE LEAF
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.OBSIDIAN,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.OBSIDIAN_BORDER,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3.5,
    color: TOKENS.CHAMPAGNE,
  },
  headerTagline: {
    fontSize: 10,
    color: TOKENS.EUCALYPTUS,
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.OBSIDIAN_BORDER,
    backgroundColor: TOKENS.OBSIDIAN_SURFACE,
  },
  badgeText: {
    fontSize: 12,
    color: TOKENS.SAGE_GREEN,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: TOKENS.OBSIDIAN_SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.OBSIDIAN_BORDER,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: TOKENS.APEX_WHITE,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.WARM_STONE,
    letterSpacing: 1.5,
  },
  sectionSub: {
    fontSize: 11,
    color: TOKENS.EUCALYPTUS,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.OBSIDIAN_SURFACE,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: TOKENS.OBSIDIAN_BORDER,
  },
  trackCardActive: {
    borderColor: TOKENS.CHAMPAGNE,
    backgroundColor: '#151D18',
  },
  trackThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: TOKENS.FOREST,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  trackThumbImg: {
    width: 32,
    height: 32,
  },
  trackThumbImgCover: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.APEX_WHITE,
    marginBottom: 3,
  },
  trackArtist: {
    fontSize: 12,
    color: TOKENS.SAGE_GREEN,
  },
  trackDuration: {
    fontSize: 12,
    color: TOKENS.WARM_STONE,
    marginLeft: 8,
  },
  // Mini Player
  miniPlayer: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: TOKENS.OBSIDIAN_SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.OBSIDIAN_BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
  miniProgressBar: {
    height: 2,
    backgroundColor: TOKENS.OBSIDIAN_BORDER,
    width: '100%',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: TOKENS.CHAMPAGNE,
  },
  miniPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  miniThumbContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: TOKENS.FOREST,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniThumb: {
    width: '100%',
    height: '100%',
  },
  miniDetails: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.APEX_WHITE,
  },
  miniArtist: {
    fontSize: 11,
    color: TOKENS.SAGE_GREEN,
    marginTop: 2,
  },
  miniPlayBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TOKENS.CHAMPAGNE,
    borderRadius: 19,
    marginLeft: 6,
  },
  miniNextBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  // Full Player Modal
  modalContainer: {
    flex: 1,
    backgroundColor: TOKENS.OBSIDIAN,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalTitleBox: {
    alignItems: 'center',
    maxWidth: '70%',
  },
  modalBrand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: TOKENS.CHAMPAGNE,
  },
  modalAlbum: {
    fontSize: 11,
    color: TOKENS.EUCALYPTUS,
    marginTop: 2,
  },
  lyricsToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.CHAMPAGNE,
  },
  lyricsToggleActive: {
    backgroundColor: TOKENS.CHAMPAGNE,
  },
  lyricsToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.CHAMPAGNE,
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
  },
  coverBox: {
    width: 270,
    height: 270,
    borderRadius: 24,
    backgroundColor: TOKENS.OBSIDIAN_SURFACE,
    borderWidth: 1,
    borderColor: TOKENS.OBSIDIAN_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: TOKENS.CHAMPAGNE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 12,
  },
  coverImageCover: {
    width: '100%',
    height: '100%',
  },
  coverImage: {
    width: 190,
    height: 190,
  },
  lyricsScroll: {
    width: '100%',
    height: '100%',
  },
  lyricsContent: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  lyricLine: {
    fontSize: 16,
    color: TOKENS.WARM_STONE,
    opacity: 0.4,
    paddingVertical: 12,
    textAlign: 'center',
  },
  lyricLineActive: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKENS.CHAMPAGNE,
    opacity: 1.0,
    textShadowColor: TOKENS.CHAMPAGNE_GLOW,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  noLyricsText: {
    color: TOKENS.EUCALYPTUS,
    marginTop: 80,
    fontSize: 15,
  },
  modalTrackInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTrackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TOKENS.APEX_WHITE,
    textAlign: 'center',
  },
  modalTrackArtist: {
    fontSize: 15,
    color: TOKENS.SAGE_GREEN,
    marginTop: 4,
  },
  progressSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: TOKENS.OBSIDIAN_BORDER,
    borderRadius: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: TOKENS.CHAMPAGNE,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: TOKENS.WARM_STONE,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 10,
  },
  sideControlBtn: {
    padding: 8,
  },
  mainPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.CHAMPAGNE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: TOKENS.CHAMPAGNE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
});
