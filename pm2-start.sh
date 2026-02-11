#!/bin/bash

echo "================================"
echo "  MonkeyPhone PM2 启动脚本"
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

# 检查 pm2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  未找到 PM2，正在全局安装..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo "❌ PM2 安装失败，请手动执行: npm install -g pm2"
        exit 1
    fi
fi
PM2_VERSION=$(pm2 -v)
echo "✅ PM2: v$PM2_VERSION"

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

echo "[启动服务]"

# 停止可能存在的旧进程
pm2 delete monkeyphone-backend 2>/dev/null
pm2 delete monkeyphone-frontend 2>/dev/null

# 启动后端服务
echo "启动后端服务..."
pm2 start "$SCRIPT_DIR/server/index.js" --name "monkeyphone-backend" --cwd "$SCRIPT_DIR/server"

# 等待后端启动
sleep 2

# 启动前端服务
echo "启动前端服务..."
pm2 start npm --name "monkeyphone-frontend" --cwd "$SCRIPT_DIR" -- run dev

# 保存 PM2 配置
pm2 save

echo ""
echo "================================"
echo "  🎉 服务启动成功！"
echo "================================"
echo ""
echo "  🌐 前端: http://localhost:5173"
echo "  🔧 后端: http://localhost:3000"
echo ""
echo "  📋 PM2 常用命令:"
echo "     查看状态: pm2 status"
echo "     查看日志: pm2 logs"
echo "     后端日志: pm2 logs monkeyphone-backend"
echo "     前端日志: pm2 logs monkeyphone-frontend"
echo "     监控面板: pm2 monit"
echo ""
echo "  🛑 停止服务: ./pm2-stop.sh"
echo ""

# 显示当前状态
pm2 status
