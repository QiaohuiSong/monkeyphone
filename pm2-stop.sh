#!/bin/bash

echo "================================"
echo "  MonkeyPhone PM2 停止脚本"
echo "================================"
echo ""

# 检查 pm2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ 未找到 PM2"
    exit 1
fi

echo "正在停止服务..."

# 停止并删除进程
pm2 delete monkeyphone-backend 2>/dev/null
pm2 delete monkeyphone-frontend 2>/dev/null

# 保存配置
pm2 save

echo ""
echo "✅ 服务已停止"
echo ""

# 显示当前状态
pm2 status
