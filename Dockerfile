# ==============================================================================
# Mazz MuZik - Multi-stage Production Container
# ==============================================================================

# ------------------------------------------------------------------------------
# Étape 1 : Compilation du binaire Rust (mazzmuzik-server)
# ------------------------------------------------------------------------------
FROM rust:1.80-slim-bullseye AS builder

WORKDIR /usr/src/mazzmuzik

# Dépendances de build système
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copie des manifestes Cargo pour la mise en cache des dépendances
COPY Cargo.toml Cargo.lock ./
COPY crates/mazzmuzik-core/Cargo.toml crates/mazzmuzik-core/
COPY crates/mazzmuzik-db/Cargo.toml crates/mazzmuzik-db/
COPY crates/mazzmuzik-server/Cargo.toml crates/mazzmuzik-server/

# Création de stubs pour pré-compiler les crates externes
RUN mkdir -p crates/mazzmuzik-core/src crates/mazzmuzik-db/src crates/mazzmuzik-server/src \
    && echo "fn main() {}" > crates/mazzmuzik-server/src/main.rs \
    && echo "" > crates/mazzmuzik-core/src/lib.rs \
    && echo "" > crates/mazzmuzik-db/src/lib.rs

RUN cargo build --release -p mazzmuzik-server || true

# Copie des vraies sources du workspace
COPY crates/ crates/

# Compilation finale de l'exécutable
RUN cargo build --release -p mazzmuzik-server

# ------------------------------------------------------------------------------
# Étape 2 : Image d'exécution minimale
# ------------------------------------------------------------------------------
FROM debian:bullseye-slim AS runtime

LABEL maintainer="Mazz MuZik"
LABEL description="Mazz MuZik Home Server with PoToken bgutil support"

# Installation des dépendances d'exécution :
# - nodejs & npm : indispensables pour bgutil (génération PoToken YouTube)
# - python3 & pip : pour yt-dlp et bgutil provider
# - ffmpeg : pour le réencodage / extraction audio
# - ca-certificates & curl : pour requêtes HTTPS sécurisées
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    ffmpeg \
    python3 \
    python3-pip \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && pip3 install --no-cache-dir --upgrade pip yt-dlp bgutil-ytdlp-potoken-provider \
    && rm -rf /var/lib/apt/lists/*

# Création de l'utilisateur non-privilégié mazzmuzik
RUN groupadd -g 1000 mazzmuzik && \
    useradd -u 1000 -g mazzmuzik -m -s /bin/bash mazzmuzik

# Répertoires de travail et volumes
RUN mkdir -p /music /data /config /app \
    && chown -R mazzmuzik:mazzmuzik /music /data /config /app

WORKDIR /app

# Copie du binaire compilé
COPY --from=builder /usr/src/mazzmuzik/target/release/mazzmuzik-server /app/mazzmuzik-server
RUN chmod +x /app/mazzmuzik-server

USER mazzmuzik

# Variables d'environnement par défaut
ENV MAZZMUZIK_SERVER__HOST=0.0.0.0 \
    MAZZMUZIK_SERVER__PORT=4040 \
    MAZZMUZIK_DATABASE__URL=sqlite:///data/mazzmuzik.db \
    MAZZMUZIK_STORAGE__MUSIC_DIR=/music \
    MAZZMUZIK_STORAGE__DATA_DIR=/data \
    MAZZMUZIK_DOWNLOADER__USER_AGENT="MazzMuZik/0.1" \
    RUST_LOG=info

EXPOSE 4040

VOLUME ["/music", "/data", "/config"]

ENTRYPOINT ["/app/mazzmuzik-server"]
