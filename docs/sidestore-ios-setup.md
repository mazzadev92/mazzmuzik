# Guide d'installation et de signature iOS : Mazz MuZik

Ce guide détaille l'installation de l'application cliente iOS **Mazz MuZik** via sideloading (sans compte développeur payant Apple et sans passer par l'App Store).

---

## 1. Choix de la méthode d'installation

| Méthode | Prérequis | Expiration | Câble / PC après setup |
| :--- | :--- | :--- | :--- |
| **TrollStore** (Idéal si compatible) | iOS 14.0 à 15.8.3, 16.0 à 16.6.1, 17.0 | **Permanente** (aucune expiration) | **Zéro PC, Zéro câble** |
| **SideStore** (Recommandé standard) | N'importe quelle version d'iOS | Renouvellement auto via WireGuard | PC requis **1 seule fois** |
| **Sideloadly** | N'importe quelle version d'iOS | 7 jours (renouvellement Wi-Fi avec PC allumé) | Nécessite le PC sur le même réseau |

> [!TIP]
> **Vérifiez votre version iOS d'abord** : Rendez-vous dans *Réglages > Général > Informations*. Si votre version est supportée par **TrollStore**, installez directement le fichier `.ipa` via TrollStore : vous bénéficiez d'une installation permanente sans limite d'apps et sans compte Apple.

---

## 2. Procédure SideStore (Recommandée avec tunnel WireGuard)

SideStore a la particularité de re-signer vos applications directement depuis votre iPhone, sans aucun ordinateur, grâce à un VPN local ou distant. Avec le tunnel WireGuard **`mazz0`** de Mazz MuZik, le rafraîchissement des 7 jours s'effectue automatiquement en arrière-plan.

### Étape 1 : Obtenir le fichier `.ipa` non signé
1. Allez sur votre dépôt GitHub de Mazz MuZik dans l'onglet **Actions**.
2. Sélectionnez le workflow **Build iOS IPA (Unsigned for Sideloading)**.
3. Téléchargez l'artefact `MazzMuZik-unsigned-ipa`.

### Étape 2 : Préparation unique sous Windows (Jitterbugpair)
Le PC sous Windows ne sert qu'une seule et unique fois pour générer le fichier d'appairage cryptographique (`.mobiledevicepairing`) :
1. Téléchargez **jitterbugpair** pour Windows (depuis les releases officielles de SideStore ou Jitterbug).
2. Connectez votre iPhone au PC via un câble USB et déverrouillez-le.
3. Acceptez « Faire confiance à cet ordinateur » sur l'écran de l'iPhone.
4. Ouvrez un terminal PowerShell et lancez :
   ```powershell
   .\jitterbugpair.exe
   ```
5. Un fichier nommé `<UDID>.mobiledevicepairing` est généré dans le dossier.
6. Envoyez ce fichier sur votre iPhone (via AirDrop, iCloud Drive ou câble).

### Étape 3 : Installation initiale de SideStore
1. Installez SideStore sur l'iPhone via **SideStore Installer** ou **AltServer** configuré pour SideStore.
2. Sur l'iPhone, allez dans *Réglages > Général > VPN et gestion des appareils*, puis faites confiance au certificat de votre compte Apple.
3. Activez le **Mode Développeur** sur iOS 16+ (*Réglages > Confidentialité et sécurité > Mode Développeur*).
4. Ouvrez SideStore et sélectionnez le fichier `.mobiledevicepairing` généré à l'étape 2.

### Étape 4 : Installation de Mazz MuZik
1. Transférez `MazzMuZik-unsigned.ipa` sur votre iPhone (Fichiers / iCloud).
2. Ouvrez SideStore, allez dans l'onglet **My Apps**, appuyez sur le bouton `+` en haut à gauche.
3. Sélectionnez le fichier `MazzMuZik-unsigned.ipa`.
4. SideStore signe l'application avec votre identifiant Apple gratuit et l'installe.

### Étape 5 : Rafraîchissement transparent via WireGuard `mazz0`
1. Lorsque vous êtes en déplacement, votre tunnel WireGuard **`mazz0`** est actif pour accéder au serveur Mazz MuZik de votre domicile.
2. SideStore utilise cette boucle réseau WireGuard pour contacter les services de signature locaux sans aucun PC physique.
3. L'application Mazz MuZik reste fonctionnelle indéfiniment sans interruption.

> [!WARNING]
> **Limite des 3 applications** : Un compte Apple gratuit limite chaque appareil à **3 applications sideloadées actives** simultanément (SideStore inclus, donc 2 apps personnelles en plus). Veillez à ne pas saturer les slots d'applications.

---

## 3. Alternative de test rapide : Sideloadly

Si vous souhaitez simplement tester l'application avant de configurer SideStore :
1. Téléchargez et lancez **Sideloadly** sous Windows.
2. Branchez votre iPhone via USB.
3. Glissez-déposez le fichier `MazzMuZik-unsigned.ipa` dans Sideloadly.
4. Renseignez votre identifiant Apple et cliquez sur **Start**.
5. Sideloadly prend en charge l'authentification 2FA et permet ensuite le re-sideload automatique en Wi-Fi lorsque le PC est allumé.

*(N'utilisez 3uTools que pour du dépannage pontuel, privilégiez SideStore ou Sideloadly pour la gestion des certificats et de la 2FA).*

---

## 4. Première configuration dans Mazz MuZik iOS

Une fois l'application installée et lancée sur votre iPhone :
1. Rendez-vous dans l'onglet **Réglages** (icône d'engrenage).
2. Entrez l'URL de votre serveur :
   - À domicile sur le Wi-Fi local : `http://192.168.1.X:4040`
   - Hors du domicile via WireGuard : `http://10.7.0.1:4040`
3. Renseignez votre nom d'utilisateur et votre mot de passe (créés lors du setup initial).
4. Appuyez sur **Tester la connexion** pour vérifier l'accès OpenSubsonic.
5. Vous pouvez ajuster le plafond du cache local (par défaut : 10 Go) selon la mémoire disponible sur votre appareil.
