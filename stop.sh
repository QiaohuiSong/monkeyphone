#!/bin/bash

echo "================================"
echo "  MonkeyPhone 停止脚本"
echo "================================"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "正在停止服务..."

# 通过 PID 文件停止进程
if [ -f "$SCRIPT_DIR/.pids/backend.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/.pids/backend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        echo "  后端服务已停止 (PID: $PID)"
    fi
    rm -f "$SCRIPT_DIR/.pids/backend.pid"
fi

if [ -f "$SCRIPT_DIR/.pids/frontend.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/.pids/frontend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        echo "  前端服务已停止 (PID: $PID)"
    fi
    rm -f "$SCRIPT_DIR/.pids/frontend.pid"
fi

# 备用方案：通过端口查找并停止
if command -v lsof &> /dev/null; then
    # 停止占用 3000 端口的进程
    PID_3000=$(lsof -ti:3000 2>/dev/null)
    if [ -n "$PID_3000" ]; then
        kill $PID_3000 2>/dev/null
        echo "  已停止端口 3000 上的进程"
    fi

    # 停止占用 5173 端口的进程
    PID_5173=$(lsof -ti:5173 2>/dev/null)
    if [ -n "$PID_5173" ]; then
        kill $PID_5173 2>/dev/null
        echo "  已停止端口 5173 上的进程"
    fi
fi

echo ""
echo "================================"
echo "  服务已停止！"
echo "================================"
