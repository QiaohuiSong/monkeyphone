@echo off
chcp 65001 >nul
echo ================================
echo   MonkeyPhone 停止脚本
echo ================================

echo 正在停止服务...

:: 通过窗口标题关闭进程
taskkill /FI "WINDOWTITLE eq MonkeyPhone-Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq MonkeyPhone-Frontend*" /F >nul 2>nul

:: 关闭占用 3000 和 5173 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo.
echo ================================
echo   服务已停止！
echo ================================
echo.
pause
