#!/bin/bash
# ═══════════════════════════════════════════════════
# 一键启动脚本 — 考评分支机构管理系统
# 
# 使用方法：
#   chmod +x scripts/start.sh
#   ./scripts/start.sh
# 
# 或直接在项目根目录执行：
#   docker-compose -f docker/docker-compose.yml up -d
# ═══════════════════════════════════════════════════

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  考评分支机构管理系统  启动脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   安装指南: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    echo "   安装指南: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "⚠️  .env 文件不存在，正在从 .env.example 创建..."
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请根据需要修改配置"
    else
        echo "❌ .env 和 .env.example 都不存在"
        exit 1
    fi
fi

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data/files data/backups data/temp

# 构建并启动
echo "🐳 构建并启动 Docker 容器..."
docker-compose -f docker/docker-compose.yml up -d --build

# 等待服务启动
echo "⏳ 等待服务启动（约30秒）..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
if docker ps | grep -q exam-backend; then
    echo "✅ 后端服务已启动"
else
    echo "❌ 后端服务启动失败，请检查日志: docker logs exam-backend"
    exit 1
fi

if docker ps | grep -q exam-frontend; then
    echo "✅ 前端服务已启动"
else
    echo "❌ 前端服务启动失败，请检查日志: docker logs exam-frontend"
    exit 1
fi

echo ""
echo "🎉 系统启动成功！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  访问地址: http://localhost"
echo "  API地址: http://localhost/api"
echo "  默认账号: admin / admin123"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "常用命令："
echo "  查看日志:    docker logs exam-backend"
echo "  停止服务:    docker-compose -f docker/docker-compose.yml down"
echo "  重启服务:    docker-compose -f docker/docker-compose.yml restart"
echo "  备份数据:    docker exec exam-backend npx tsx src/scripts/backup.ts"
echo ""
