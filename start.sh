#!/bin/bash

echo "================================"
echo "  MonkeyPhone 启动脚本"
echo "================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============ 环境检查 ============

echo "[环境检查]"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js"
    echo ""
    echo "请先安装 Node.js (推荐 v18+):"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    echo "  macOS:         brew install node"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到 npm"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "✅ npm: v$NPM_VERSION"

echo ""

# ============ 依赖安装 ============

echo "[依赖检查]"

# 检查前端依赖
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
    echo "✅ 前端依赖安装完成"
else
    echo "✅ 前端依赖已存在"
fi

# 检查后端依赖
if [ ! -d "$SCRIPT_DIR/server/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd "$SCRIPT_DIR/server"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 后端依赖安装失败"
        exit 1
    fi
    cd "$SCRIPT_DIR"
    echo "✅ 后端依赖安装完成"
else
    echo "✅ 后端依赖已存在"
fi

echo ""

# ============ 启动服务 ============

# 创建 PID 文件目录
mkdir -p "$SCRIPT_DIR/.pids"

# 停止可能存在的旧进程
if [ -f "$SCRIPT_DIR/.pids/backend.pid" ]; then
    OLD_PID=$(cat "$SCRIPT_DIR/.pids/backend.pid")
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "停止旧的后端进程..."
        kill $OLD_PID 2>/dev/null
    fi
fi

if [ -f "$SCRIPT_DIR/.pids/frontend.pid" ]; then
    OLD_PID=$(cat "$SCRIPT_DIR/.pids/frontend.pid")
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "停止旧的前端进程..."
        kill $OLD_PID 2>/dev/null
    fi
fi

sleep 1

# 启动后端服务
echo "[1/2] 启动后端服务..."
cd "$SCRIPT_DIR/server"
nohup node index.js > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/.pids/backend.pid"

# 等待后端启动
sleep 2

# 检查后端是否启动成功
if ! ps -p $(cat "$SCRIPT_DIR/.pids/backend.pid") > /dev/null 2>&1; then
    echo "❌ 后端启动失败，查看日志: cat .pids/backend.log"
    exit 1
fi
echo "✅ 后端已启动 (PID: $(cat "$SCRIPT_DIR/.pids/backend.pid"))"

# 启动前端服务
echo "[2/2] 启动前端服务..."
cd "$SCRIPT_DIR"
nohup npm run dev > "$SCRIPT_DIR/.pids/frontend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/.pids/frontend.pid"

sleep 3

# 检查前端是否启动成功
if ! ps -p $(cat "$SCRIPT_DIR/.pids/frontend.pid") > /dev/null 2>&1; then
    echo "❌ 前端启动失败，查看日志: cat .pids/frontend.log"
    exit 1
fi
echo "✅ 前端已启动 (PID: $(cat "$SCRIPT_DIR/.pids/frontend.pid"))"

echo ""
echo "================================"
echo "  🎉 服务启动成功！"
echo "================================"
echo ""
echo "  🌐 前端: http://localhost:5173"
echo "  🔧 后端: http://localhost:3000"
echo ""
echo "  📋 查看日志:"
echo "     后端: tail -f .pids/backend.log"
echo "     前端: tail -f .pids/frontend.log"
echo ""
echo "  🛑 停止服务: ./stop.sh"
echo ""
