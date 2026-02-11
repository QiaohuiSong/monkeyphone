@echo off
chcp 65001 >nul
echo ================================
echo   MonkeyPhone 启动脚本
echo ================================

:: 检查 node 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 启动后端服务
echo [1/2] 启动后端服务...
start "MonkeyPhone-Backend" cmd /c "cd /d %SCRIPT_DIR%server && node index.js"

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 启动前端服务
echo [2/2] 启动前端服务...
start "MonkeyPhone-Frontend" cmd /c "cd /d %SCRIPT_DIR% && npm run dev"

echo.
echo ================================
echo   服务已启动！
echo   后端: http://localhost:3000
echo   前端: http://localhost:5173
echo ================================
echo.
echo 按任意键关闭此窗口（服务会继续运行）
pause >nul
