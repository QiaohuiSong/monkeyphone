#!/bin/bash

echo "================================"
echo "  MonkeyPhone 启动脚本"
echo "================================"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建 PID 文件目录
mkdir -p "$SCRIPT_DIR/.pids"

# 启动后端服务
echo "[1/2] 启动后端服务..."
cd "$SCRIPT_DIR/server"
nohup node index.js > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/.pids/backend.pid"

# 等待后端启动
sleep 2

# 启动前端服务
echo "[2/2] 启动前端服务..."
cd "$SCRIPT_DIR"
nohup npm run dev > "$SCRIPT_DIR/.pids/frontend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/.pids/frontend.pid"

echo ""
echo "================================"
echo "  服务已启动！"
echo "  后端: http://localhost:3000"
echo "  前端: http://localhost:5173"
echo "================================"
echo ""
echo "查看日志:"
echo "  后端: tail -f .pids/backend.log"
echo "  前端: tail -f .pids/frontend.log"
echo ""
echo "停止服务: ./stop.sh"
