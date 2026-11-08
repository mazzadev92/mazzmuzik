export interface EQPreset {
  id: string;
  name: string;
  category: 'bass' | 'vocals' | 'genres' | 'studio';
  categoryLabel: string;
  description: string;
  gains: [number, number, number, number, number, number, number, number, number, number];
}

export const EQ_CATEGORIES = [
  { id: 'all', label: 'Tous les Presets' },
  { id: 'bass', label: 'Basses & Impact' },
  { id: 'vocals', label: 'Voix & Clarté' },
  { id: 'genres', label: 'Styles & Genres' },
  { id: 'studio', label: 'Studio & Mixage' },
] as const;

export const EQ_PRESETS: EQPreset[] = [
  // 1. BASS & IMPACT
  {
    id: 'ultra_bass',
    name: 'Ultra Bass Boost',
    category: 'bass',
    categoryLabel: 'Basses & Impact',
    description: 'Sub-bass extrême et infrabasses telluriques pour casques et subwoofers lourds.',
    gains: [11, 10, 7, 3, 0, -1, 0, 1, 2, 3],
  },
  {
    id: 'bass_boost',
    name: 'Bass Boost Standard',
    category: 'bass',
    categoryLabel: 'Basses & Impact',
    description: 'Renforcement musclé des graves tout en préservant la netteté du mixage.',
    gains: [7, 6, 5, 2, 0, 0, 0, 1, 2, 3],
  },
  {
    id: 'kick_punch',
    name: 'Kick Punch (Transitoires)',
    category: 'bass',
    categoryLabel: 'Basses & Impact',
    description: 'Grosse caisse percutante (64-125Hz), creux anti-boue à 250Hz et claquant à 4kHz.',
    gains: [5, 9, 7, -3, -2, 1, 2, 6, 2, 1],
  },
  {
    id: 'trap_808',
    name: '808 Trap Thump',
    category: 'bass',
    categoryLabel: 'Basses & Impact',
    description: 'Sub 808 ultra-lourd avec charlestons étincelants pour Trap, Drill et Hip-Hop.',
    gains: [10, 8, 4, -2, -3, 0, 2, 5, 7, 6],
  },
  {
    id: 'deep_house',
    name: 'Deep House Club',
    category: 'bass',
    categoryLabel: 'Basses & Impact',
    description: 'Kick 4/4 profond, basses rondes et haut du spectre aéré pour sets clubs.',
    gains: [8, 7, 5, 1, -1, 0, 2, 4, 6, 5],
  },

  // 2. VOCALS & CLARITY
  {
    id: 'vocals',
    name: 'Voix Claires / Lead Vocal',
    category: 'vocals',
    categoryLabel: 'Voix & Clarté',
    description: 'Mise en avant chirurgicale de la voix principale sans résonance nasale.',
    gains: [-3, -2, 0, 2, 4, 6, 5, 3, 1, 0],
  },
  {
    id: 'podcast_crisp',
    name: 'Podcast & Voix Studio',
    category: 'vocals',
    categoryLabel: 'Voix & Clarté',
    description: 'Suppression des bruits sourds de micro, présence cristalline et diction nette.',
    gains: [-6, -4, -1, 1, 3, 5, 6, 5, 2, 0],
  },
  {
    id: 'air_treble',
    name: 'Treble & Aiguës Cristallines',
    category: 'vocals',
    categoryLabel: 'Voix & Clarté',
    description: 'Ouverture brillante du haut du spectre (brillance des cymbales, souffle vocal).',
    gains: [-2, -1, 0, 0, 1, 2, 4, 6, 9, 11],
  },
  {
    id: 'acoustic',
    name: 'Acoustique / Cordes & Piano',
    category: 'vocals',
    categoryLabel: 'Voix & Clarté',
    description: 'Équilibre organique pour guitares acoustiques, violons et pianos à queue.',
    gains: [3, 3, 2, 0, 1, 2, 3, 4, 3, 2],
  },
  {
    id: 'warm_vintage',
    name: 'Chaleur Vinyle / Bande Tape',
    category: 'vocals',
    categoryLabel: 'Voix & Clarté',
    description: 'Son analogique chaleureux avec bas-médium soyeux et atténuation des aigus agressifs.',
    gains: [4, 4, 5, 3, 1, 0, -1, -2, -3, -4],
  },

  // 3. STYLES & GENRES
  {
    id: 'hiphop_rap',
    name: 'Hip-Hop & Rap FR',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Profil calibré pour gros kicks, basses 808 glissantes et voix rappées bien incisives.',
    gains: [9, 8, 5, 0, -1, 2, 4, 3, 5, 4],
  },
  {
    id: 'edm_festival',
    name: 'EDM & Festival Drop',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Dynamique taillée pour les drops électro, synths perçants et basses compressées.',
    gains: [9, 8, 4, -1, -2, 2, 4, 6, 7, 6],
  },
  {
    id: 'rock_metal',
    name: 'Rock & Métal Électrique',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Attaque franche des guitares saturées, caisse claire tendue et cymbales tranchantes.',
    gains: [6, 7, 4, -2, 1, 4, 5, 5, 4, 3],
  },
  {
    id: 'rnb_soul',
    name: 'R&B / Soul & Funk',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Ligne de basse veloutée, médium doux et chaleur intimiste.',
    gains: [7, 6, 4, 2, 1, 2, 3, 3, 4, 4],
  },
  {
    id: 'pop_modern',
    name: 'Modern Pop Radio',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Calibration calibrée radio/streaming moderne, équilibrée et entraînante.',
    gains: [5, 5, 2, -1, 0, 3, 4, 4, 5, 5],
  },
  {
    id: 'jazz_club',
    name: 'Jazz Lounge Club',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Contrebasse boisée, balais feutrés et trompette chaleureuse.',
    gains: [3, 4, 4, 2, 1, 1, 2, 3, 2, 1],
  },
  {
    id: 'classical',
    name: 'Classique & Symphonique',
    category: 'genres',
    categoryLabel: 'Styles & Genres',
    description: 'Respect de la dynamique orchestrale et spatialisation aérée des pupitres.',
    gains: [4, 3, 1, 0, 0, 1, 2, 3, 5, 6],
  },

  // 4. STUDIO & MIXING
  {
    id: 'flat',
    name: 'Référence Neutre (Flat)',
    category: 'studio',
    categoryLabel: 'Studio & Mixage',
    description: 'Réponse linéaire 0 dB d\'écoute de référence neutre pour monitoring studio.',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'v_shape',
    name: 'Courbe V-Shape (Smiley)',
    category: 'studio',
    categoryLabel: 'Studio & Mixage',
    description: 'Basses profondes et aigus vifs avec médiums en retrait pour un rendu spectaculaire.',
    gains: [8, 6, 3, -2, -4, -3, 0, 4, 7, 8],
  },
  {
    id: 'loudness',
    name: 'Loudness Contour (Fletcher)',
    category: 'studio',
    categoryLabel: 'Studio & Mixage',
    description: 'Compensation physiologique de l\'oreille humaine pour écoute à bas volume.',
    gains: [7, 5, 2, 0, -2, -1, 1, 3, 6, 7],
  },
  {
    id: 'lofi_radio',
    name: 'Lo-Fi Vintage Radio AM',
    category: 'studio',
    categoryLabel: 'Studio & Mixage',
    description: 'Effet mégaphone / transistor rétro vintage, bande passante coupée aux extrémités.',
    gains: [-12, -10, -6, 2, 6, 7, 4, -3, -9, -12],
  },
];
