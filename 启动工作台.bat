@echo off
chcp 65001 >nul
title 医药代表工作助手

set PROJECT_DIR=D:\MyDrivers\workbuddy\2026-08-26-13-44-15\rep-workbench
set PORT=3000
set URL=http://localhost:%PORT%

echo ============================================
echo   医药代表工作助手  一键启动
echo ============================================
echo.

REM Check if already running
curl -s -o nul -w "%%{http_code}" http://localhost:%PORT%/ 2>nul | findstr /b "2" >nul
if errorlevel 1 (
  echo [1/3] 正在启动服务（首次启动约 2-3 秒）...
  cd /d "%PROJECT_DIR%"
  start "rep-workbench-server" /min cmd /c "node server.js"
  echo 等待服务就绪...
  :wait_loop
  curl -s -o nul -w "%%{http_code}" http://localhost:%PORT%/ 2>nul | findstr /b "2" >nul
  if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
  )
  echo [2/3] 服务已就绪
) else (
  echo [1/3] 服务已在运行
  echo [2/3] 跳过启动步骤
)

echo [3/3] 正在打开浏览器...
start "" "%URL%"

echo.
echo ============================================
echo   完成！
echo   工作台地址：%URL%
echo   关闭此窗口不会停止服务（服务在后台运行）
echo   如需停止服务：在任务栏右键 rep-workbench-server 图标 → 关闭
echo ============================================
echo.
timeout /t 5 /nobreak >nul
exit
