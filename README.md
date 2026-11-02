# Mazz MuZik

> Écosystème auto-hébergé de musique personnelle : serveur domestique qui agrège des sources publiques, et client iOS pour écouter à distance et hors ligne.
> Tout en open source, sous licence GPL-3.0.

---

## CHARTE D'UTILISATION

Cadre à retenir, sans y revenir à chaque décision :

1. Usage strictement personnel et non commercial. L'utilisateur n'héberge pas
   de contenu, ne le redistribue pas, ne le revend pas.
2. L'application agit comme un navigateur et un agrégateur : elle lit des
   ressources publiquement accessibles et les restitue dans une interface
   unifiée. Elle n'est ni un service de streaming, ni un ayant droit.
3. Les œuvres restent la propriété de leurs auteurs et producteurs. La
   bibliothèque locale est un cache personnel, pas une collection distribuée.
4. Aucune clé d'API privée, aucun abonnement, aucun compte tiers. Tout ce qui
   peut être lu anonymement doit l'être.
5. L'utilisateur assume la conformité de son usage à la législation locale.

Conséquences pratiques : pas de message d'avertissement dans l'UI, pas de
demande de confirmation légale, pas de "selon les cas". Tu implémentes, tu
documentes, tu avances.

---

## Architecture de Mazz MuZik

Mazz MuZik est structuré en monorepo :

- **`crates/mazzmuzik-core`** : Cœur métier en Rust.
  - Résolution de pistes en cascade via trait `SourceProvider` : YT Music anonyme → YouTube → Deezer → SoundCloud → Bandcamp → Audius → Soulseek.
  - Algorithme de scoring de similarité (titre normalisé, artiste, durée ±3 s, ISRC/MBID).
  - Cache de résolution SQLite avec TTL, invalidation sur échec, réessai exponentiel.
  - Superviseur de téléchargement sous-processus `yt-dlp` avec PoToken via provider `bgutil` (pérennité du mode anonyme).
  - Enrichissement canonique MusicBrainz et paroles synchronisées LRCLIB (`.lrc`).
  - Taggage automatique ID3v2.4 / Vorbis Comments + cover art intégrée.
  - Rangement automatique sur disque : `Artiste/Album/TT - Titre.ext` (album « Singles » à la volée pour les orphelins).
  - File d'attente avec reprise et file d'arbitrage manuel pour les scores inférieurs au seuil de confiance.
  - Importers anonymes de playlists publiques (Spotify, YT Music, Deezer, CSV, M3U).
- **`crates/mazzmuzik-db`** : Couche de persistance SQLite avec migrations versionnées `sqlx` en mode WAL.
- **`crates/mazzmuzik-server`** : Démon HTTP (Axum) exposant :
  - L'API REST interne pour l'interface de gestion et le pilotage de la bibliothèque.
  - L'implémentation complète OpenSubsonic v1.16.1 (XML & JSON) compatible avec Amperfy, substreamer, DSub, etc.
  - L'interface web minimale d'administration embarquée.
- **`apps/mazzmuzik-ios`** : Application mobile iOS en Flutter (package `mazzmuzik`, bundle id `fun.mazzmuzik.app`).
  - Streaming audio et mode hors-ligne avec cache LRU disque borné et vidable.
  - Contrôles natifs Lock Screen et Control Center (`audio_service`).
  - Paroles synchronisées, recherche, playlists, gestion du serveur.
  - Sideload sans fil via SideStore ou TrollStore, CI GitHub Actions.

---

## Démarrage rapide

### Configuration

Copiez le fichier d'exemple :
```bash
cp config/mazzmuzik.example.toml ~/.config/mazzmuzik/mazzmuzik.toml
```

### Lancement avec Docker Compose

```bash
docker compose up -d
```

### Compilation native (Rust)

```bash
cargo build --release
./target/release/mazzmuzik-server --config config/mazzmuzik.example.toml
```

---

## Documentation

- [Charte d'utilisation (texte intégral)](./docs/charte-utilisation.md)
- [Guide d'installation iOS (SideStore / TrollStore)](./docs/sidestore-ios-setup.md)
- [Guide de configuration WireGuard (`mazz0`)](./docs/wireguard-setup.md)

---

## Licence

Distribué sous licence **GNU General Public License v3.0 (GPL-3.0)**. Voir le fichier [`LICENSE`](./LICENSE) pour le texte intégral.
