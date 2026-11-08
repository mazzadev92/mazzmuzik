@echo off
title MazzMuziK Mobile - Expo Go
cd /d "D:\Mazz MuZik\apps\mazzmuzik-mobile"
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.17
echo ========================================================
echo    MAZZ MUZIK - SERVEUR MOBILE (EXPO GO IPHONE 12)
echo ========================================================
echo.
echo IP detectee : 192.168.1.17
echo.
echo 1. Verifie que ton iPhone 12 est sur le meme Wi-Fi.
echo 2. Ouvre l'Appareil Photo de ton iPhone 12.
echo 3. Scanne le QR Code ci-dessous.
echo.
npx expo start --lan
pause
