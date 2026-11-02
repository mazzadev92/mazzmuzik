# Configuration WireGuard : Tunnel Privé `mazz0`

Pour écouter votre musique sur votre iPhone en 4G/5G sans jamais exposer le port `4040` de Mazz MuZik sur l'Internet public, nous déployons un tunnel WireGuard dédié nommé **`mazz0`**.

Cette configuration remplit un double rôle :
1. **Sécurité totale** : Aucun port HTTP n'est ouvert sur votre box ou votre routeur. Seul un port UDP aléatoire (WireGuard) est accessible, chiffré de bout en bout avec Noise Protocol.
2. **SideStore sans PC** : Le tunnel `mazz0` permet à SideStore de joindre les services locaux pour rafraîchir la signature de Mazz MuZik automatiquement.

---

## 1. Topologie Réseau

```
[ iPhone / Client iOS ] (10.7.0.2)
         │  (Chiffrement WireGuard Noise)
         ▼  [UDP: 51820]
[ Box Internet / Routeur ]
         │  (Redirection de port UDP unique)
         ▼
[ Serveur Domestique ] (10.7.0.1 sur interface mazz0)
         │
         ├── Interface mazz0 (VPN WireGuard)
         └── Port 4040 (Mazz MuZik Server)
```

---

## 2. Configuration sur le serveur hôte (Linux)

### A. Génération des clés cryptographiques
```bash
# Installer wireguard et qrencode
sudo apt-get install -y wireguard qrencode

# Se placer dans le répertoire WireGuard
cd /etc/wireguard
umask 077

# Clés serveur
wg genkey | tee server_private.key | wg pubkey > server_public.key

# Clés client iPhone
wg genkey | tee iphone_private.key | wg pubkey > iphone_public.key
```

### B. Fichier de configuration du serveur : `/etc/wireguard/mazz0.conf`
Créez le fichier `/etc/wireguard/mazz0.conf` :
```ini
[Interface]
Address = 10.7.0.1/24
ListenPort = 51820
PrivateKey = <CONTENU_DE_server_private.key>

# Routage des paquets vers le réseau local si nécessaire
PostUp = iptables -A FORWARD -i mazz0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i mazz0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Client iPhone (Mazz MuZik + SideStore)
[Peer]
PublicKey = <CONTENU_DE_iphone_public.key>
AllowedIPs = 10.7.0.2/32
```

Activez l'interface et le service au démarrage :
```bash
sudo systemctl enable --now wg-quick@mazz0
```

---

## 3. Configuration du Client iOS (iPhone)

### A. Fichier de configuration client : `iphone-mazz0.conf`
Générez sur le serveur le fichier de configuration pour votre iPhone :
```ini
[Interface]
PrivateKey = <CONTENU_DE_iphone_private.key>
Address = 10.7.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <CONTENU_DE_server_public.key>
Endpoint = <VOTRE_IP_PUBLIQUE_OU_NOM_DE_DOMAINE_DDNS>:51820
# Ne router vers le VPN que l'IP du serveur pour préserver votre débit 4G/5G
AllowedIPs = 10.7.0.0/24
PersistentKeepalive = 25
```

### B. Import instantané par QR Code
Affichez le QR code directement dans votre terminal :
```bash
qrencode -t ansiutf8 < /etc/wireguard/iphone-mazz0.conf
```
1. Téléchargez l'application officielle **WireGuard** sur l'App Store.
2. Ouvrez l'application, appuyez sur `+` > **Créer à partir d'un code QR**.
3. Scannez le terminal, nommez la connexion **`mazz0`**.
4. Activez le commutateur WireGuard.

---

## 4. Test et Connexion dans Mazz MuZik iOS

1. Désactivez le Wi-Fi de votre iPhone pour passer en 4G/5G.
2. Activez le tunnel **`mazz0`** dans l'application WireGuard.
3. Ouvrez **Mazz MuZik** > **Réglages**.
4. Dans l'URL du serveur, entrez :
   ```
   http://10.7.0.1:4040
   ```
5. Appuyez sur **Tester la connexion** : le voyant passe au vert « Connecté ».
6. Vous profitez d'une diffusion audio sans perte, sécurisée et fluide n'importe où dans le monde.
