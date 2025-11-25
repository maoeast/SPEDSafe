@echo off
chcp 65001 >nul
title 生成试用激活码
echo.
echo ========================================
echo   生成试用激活码 (7天有效期)
echo ========================================
echo.
node generate-license.js --trial
echo.
pause
