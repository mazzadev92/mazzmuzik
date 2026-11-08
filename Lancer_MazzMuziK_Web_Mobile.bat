@echo off
title MazzMuziK - Serveur Web & Mobile PWA
color 0A
cd /d "D:\Mazz MuZik\apps\mazzmuzik-desktop"

echo ==============================================================
echo       MAZZMUZIK - SERVEUR LOCAL WEB & MOBILE (PWA)
echo ==============================================================
echo.
echo L'application est accessible pour vous et vos amis sur votre Wi-Fi:
echo.
echo   -> Sur votre PC :     http://localhost:3000
echo   -> Sur vos iPhone :   http://192.168.1.17:3000
echo.
echo Instruction iPhone (Safari):
echo   1. Ouvrir http://192.168.1.17:3000 dans Safari
echo   2. Appuyer sur Partager (carre avec fleche)
echo   3. Appuyer sur "Sur l'ecran d'accueil"
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur.
echo ==============================================================
echo.

npx vite preview --host 0.0.0.0 --port 3000
pause
