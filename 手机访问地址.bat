@echo off
chcp 65001 >nul
title 手机访问地址

set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "T=%%a"
  set "T=%T: =%"
  if not "%T%"=="127.0.0.1" set "IP=%T%"
)

echo ============================================
echo   手机 / 平板 访问地址
echo ============================================
echo.
echo   手机请打开：  http://%IP%:3000
echo   电脑请打开：  http://localhost:3000
echo.
echo   注意：
echo   1. 手机必须连【同一个 WiFi】
echo   2. 首次用手机访问，电脑会弹"Windows 防火墙"
echo      提示，请点【允许访问】(允许 node / rep-workbench)
echo   3. 两台设备访问的是同一个数据库，数据自动同步
echo.
echo   若手机打不开，先确认电脑端"启动工作台.bat"已运行。
echo ============================================
echo.
pause
