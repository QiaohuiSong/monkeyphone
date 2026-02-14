#!/bin/bash

# ============ 配置 ============
# 生产环境端口（默认5173，可通过环境变量 PORT 覆盖）
PROD_PORT=${PORT:-5173}

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

# 检查是否需要重新构建
# 比较 src 目录最新修改时间和 dist 目录
NEED_BUILD=false

if [ ! -f "$SCRIPT_DIR/dist/index.html" ]; then
    NEED_BUILD=true
    echo "📦 dist 目录不存在，需要构建..."
else
    # 获取 src 目录最新修改时间
    SRC_TIME=$(find "$SCRIPT_DIR/src" -type f -name "*.vue" -o -name "*.js" -o -name "*.ts" -o -name "*.css" 2>/dev/null | xargs stat -c %Y 2>/dev/null | sort -n | tail -1)
    # 获取 dist/index.html 的修改时间
    DIST_TIME=$(stat -c %Y "$SCRIPT_DIR/dist/index.html" 2>/dev/null)

    if [ -n "$SRC_TIME" ] && [ -n "$DIST_TIME" ]; then
        if [ "$SRC_TIME" -gt "$DIST_TIME" ]; then
            NEED_BUILD=true
            echo "📦 检测到源码更新，需要重新构建..."
        fi
    fi
fi

if [ "$NEED_BUILD" = true ]; then
    echo "📦 构建前端..."
    cd "$SCRIPT_DIR"
    # 先删除旧的 dist 目录
    rm -rf "$SCRIPT_DIR/dist"
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 前端构建失败"
        exit 1
    fi
    echo "✅ 前端构建完成"
else
    echo "✅ 前端已是最新（如需强制重新构建请先删除 dist 目录）"
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
echo "启动后端服务（端口: $PROD_PORT）..."
cd "$SCRIPT_DIR/server"
PORT=$PROD_PORT pm2 start index.js --name "monkeyphone-backend"

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
    echo "  🌐 访问地址: http://localhost:$PROD_PORT"
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
