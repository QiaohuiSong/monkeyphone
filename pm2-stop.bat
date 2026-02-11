@echo off
chcp 65001 >nul
echo ================================
echo   MonkeyPhone PM2 停止脚本
echo ================================
echo.

:: 检查 pm2 是否安装
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo X 未找到 PM2
    pause
    exit /b 1
)

echo 正在停止服务...

:: 停止并删除进程
pm2 delete monkeyphone-backend 2>nul
pm2 delete monkeyphone-frontend 2>nul

:: 保存配置
pm2 save

echo.
echo √ 服务已停止
echo.

:: 显示当前状态
pm2 status

pause
