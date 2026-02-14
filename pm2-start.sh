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

# 检查前端依赖（检查关键依赖包是否存在）
if [ ! -d "$SCRIPT_DIR/node_modules" ] || [ ! -d "$SCRIPT_DIR/node_modules/vue" ]; then
    echo "📦 安装前端依赖..."
    cd "$SCRIPT_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
    echo "✅ 前端依赖安装完成"
else
    echo "✅ 前端依赖已存在"
fi

# 检查后端依赖（检查关键依赖包是否存在）
if [ ! -d "$SCRIPT_DIR/server/node_modules" ] || [ ! -d "$SCRIPT_DIR/server/node_modules/express" ]; then
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

# ============ 构建前端 ============

echo "[构建前端]"

# 检查是否需要重新构建（检查 dist/index.html 是否存在）
if [ ! -f "$SCRIPT_DIR/dist/index.html" ]; then
    echo "📦 构建前端..."
    cd "$SCRIPT_DIR"
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 前端构建失败"
        exit 1
    fi
    echo "✅ 前端构建完成"
else
    echo "✅ 前端已构建（如需重新构建请先删除 dist 目录）"
fi

echo ""

# ============ 创建数据目录 ============

echo "[数据目录]"
if [ ! -d "$SCRIPT_DIR/server/data" ]; then
    mkdir -p "$SCRIPT_DIR/server/data"
    echo "✅ 创建 server/data 目录"
else
    echo "✅ server/data 目录已存在"
fi

echo ""

# ============ 启动服务 ============

echo "[启动服务]"

# 停止可能存在的旧进程
pm2 delete monkeyphone-backend 2>/dev/null

# 启动后端服务（同时托管前端静态文件）
echo "启动后端服务..."
cd "$SCRIPT_DIR/server"
pm2 start index.js --name "monkeyphone-backend"

if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    echo "请查看日志: pm2 logs monkeyphone-backend"
    exit 1
fi

# 保存 PM2 配置
pm2 save

# 等待服务启动
sleep 2

# 检查服务是否正常运行
if pm2 list | grep -q "monkeyphone-backend.*online"; then
    echo ""
    echo "================================"
    echo "  🎉 服务启动成功！"
    echo "================================"
    echo ""
    echo "  🌐 访问地址: http://localhost:5173"
    echo ""
    echo "  📋 PM2 常用命令:"
    echo "     查看状态: pm2 status"
    echo "     查看日志: pm2 logs monkeyphone-backend"
    echo "     监控面板: pm2 monit"
    echo ""
    echo "  🛑 停止服务: ./pm2-stop.sh"
    echo "  🔄 重新构建: rm -rf dist && ./pm2-start.sh"
    echo ""
else
    echo ""
    echo "⚠️  服务可能启动失败，请检查日志:"
    echo "    pm2 logs monkeyphone-backend --lines 50"
    echo ""
fi

# 显示当前状态
pm2 status
