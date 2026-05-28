@echo off
title Server DompetKu
echo ==============================================
echo Menjalankan Server DompetKu dan Telegram Bot...
echo ==============================================
cd /d "%~dp0"
node server/server.js
pause
