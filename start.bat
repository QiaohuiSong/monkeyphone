@echo off
chcp 65001 >nul
echo ================================
echo   MonkeyPhone 启动脚本
echo ================================
echo.

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ============ 环境检查 ============

echo [环境检查]

:: 检查 node 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo X 未找到 Node.js
    echo.
    echo 请先安装 Node.js ^(推荐 v18+^):
    echo   下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo √ Node.js: %NODE_VERSION%

:: 检查 npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo X 未找到 npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo √ npm: v%NPM_VERSION%

echo.

:: ============ 依赖安装 ============

echo [依赖检查]

:: 检查前端依赖
if not exist "%SCRIPT_DIR%node_modules" (
    echo 安装前端依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo X 前端依赖安装失败
        pause
        exit /b 1
    )
    echo √ 前端依赖安装完成
) else (
    echo √ 前端依赖已存在
)

:: 检查后端依赖
if not exist "%SCRIPT_DIR%server\node_modules" (
    echo 安装后端依赖...
    cd /d "%SCRIPT_DIR%server"
    call npm install
    if %errorlevel% neq 0 (
        echo X 后端依赖安装失败
        pause
        exit /b 1
    )
    cd /d "%SCRIPT_DIR%"
    echo √ 后端依赖安装完成
) else (
    echo √ 后端依赖已存在
)

echo.

:: ============ 启动服务 ============

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
echo   服务启动成功！
echo ================================
echo.
echo   前端: http://localhost:5173
echo   后端: http://localhost:3000
echo.
echo   停止服务: 关闭对应的命令行窗口
echo.
echo 按任意键关闭此窗口（服务会继续运行）
pause >nul
