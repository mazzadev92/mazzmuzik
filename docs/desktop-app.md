# Application Desktop Mazz MuZik (Tauri v2)

L'application de bureau **Mazz MuZik** est développée avec **Tauri v2** (Rust + HTML5/CSS/JavaScript moderne). Elle offre un lecteur de musique de bureau ultra-léger (< 15 Mo), réactif, avec intégration des touches multimédia du clavier et synchronisation des paroles en temps réel.

---

## 1. Fonctionnalités de l'application Desktop

- **Navigation complète** : Morceaux, Albums, Artistes, Recherche instantanée.
- **Lecteur audio intégré** :
  - Lecture, pause, suivant, précédent, lecture aléatoire (Shuffle), répétition (Repeat).
  - Barre de progression interactive (scrubbing temps réel).
  - Contrôle du volume avec raccourci muet.
- **Raccourcis clavier & Contrôles multimédia** :
  - `Espace` : Lecture / Pause
  - `Ctrl + Flèche droite` : Morceau suivant
  - `Ctrl + Flèche gauche` : Morceau précédent
- **Tiroir de paroles synchronisées (Synced Lyrics)** :
  - Défilement automatique synchronisé avec la lecture audio.
  - Mise en surbrillance de la ligne active.
  - Clic sur une ligne pour sauter immédiatement à ce passage du morceau.
- **Connexion OpenSubsonic native** :
  - Compatible en réseau local (`http://127.0.0.1:4040`, `http://192.168.x.x:4040`) ou à distance via WireGuard (`http://10.7.0.1:4040`).

---

## 2. Lancement en mode développement

Assurez-vous que Node.js et Cargo sont installés :

```bash
cd apps/mazzmuzik-desktop

# 1. Installer les dépendances npm
npm install

# 2. Lancer l'application en mode dev (live-reload)
npm run tauri dev
```

---

## 3. Compilation du binaire de production (.exe / .msi)

Pour générer l'installateur Windows autonome :

```bash
cd apps/mazzmuzik-desktop
npm run tauri build
```

Le binaire exécutable et l'installateur `.msi` seront générés dans le dossier :
`apps/mazzmuzik-desktop/src-tauri/target/release/bundle/`

---

## 4. Alternative : Clients tiers de bureau OpenSubsonic

Mazz MuZik implémente rigoureusement l'API **OpenSubsonic v1.16.1**. Vous pouvez également connecter immédiatement n'importe quel lecteur de bureau tiers réputé :
- **Feishin** (Windows / macOS / Linux)
- **Sonixd**
- **Supersonic**
- **Strawberry Music Player**
