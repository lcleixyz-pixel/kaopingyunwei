#!/bin/bash
# ═══════════════════════════════════════════════════
# 一键备份脚本
# ═══════════════════════════════════════════════════

set -e

echo "🔄 开始备份..."

BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
DB_FILE="./data/exam.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
    echo "❌ 数据库文件不存在: $DB_FILE"
    exit 1
fi

# 复制数据库
cp "$DB_FILE" "$BACKUP_DIR/${BACKUP_NAME}.db"

# 备份上传的文件
if [ -d "./data/files" ]; then
    tar -czf "$BACKUP_DIR/${BACKUP_NAME}_files.tar.gz" -C ./data/files .
fi

# 备份配置
cp .env "$BACKUP_DIR/${BACKUP_NAME}.env" 2>/dev/null || true

echo "✅ 备份完成！"
echo "   数据库: $BACKUP_DIR/${BACKUP_NAME}.db"
echo "   文件:   $BACKUP_DIR/${BACKUP_NAME}_files.tar.gz"
