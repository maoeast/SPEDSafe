@echo off
chcp 65001 >nul
title 生成正式激活码
echo.
echo ========================================
echo   生成正式激活码
echo ========================================
echo.
set /p machineId=请输入机器码: 
set /p days=请输入有效天数 (输入0表示永久): 
echo.

if "%days%"=="0" (
    node generate-license.js --machine %machineId% --permanent
) else (
    node generate-license.js --machine %machineId% --days %days%
)

echo.
pause
