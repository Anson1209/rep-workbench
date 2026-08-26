@echo off
chcp 65001 >nul
title 关闭 医药代表工作助手

echo 正在关闭工作台服务...
taskkill /FI "WINDOWTITLE eq rep-workbench-server*" /T /F >nul 2>&1
echo 完成。
timeout /t 2 /nobreak >nul
exit
