#!/bin/bash
# ═══════════════════════════════════════════════════
# 一键停止脚本
# ═══════════════════════════════════════════════════

echo "🛑 正在停止考评分支机构管理系统..."
if docker compose version &> /dev/null; then
    docker compose --env-file .env -f docker/docker-compose.yml down
else
    docker-compose --env-file .env -f docker/docker-compose.yml down
fi
echo "✅ 系统已停止"
