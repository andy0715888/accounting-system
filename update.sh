#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/andy0715888/accounting-system.git"
INSTALL_DIR="accounting-system"
DB_FILE="data/accounting.db"
UPLOADS_DIR="uploads"
IMAGES_DIR="public/images"
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}=========================================="
echo "  记账系统 - 一键更新"
echo "==========================================${NC}"
echo ""

# 检查是否在项目目录
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    if [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
    else
        echo -e "${RED}❌ 未找到项目目录，请先运行 install.sh 安装${NC}"
        exit 1
    fi
fi

PROJECT_DIR=$(pwd)
echo -e "${BLUE}📂 项目目录: $PROJECT_DIR${NC}"

# 1. 停止当前服务
echo -e "${YELLOW}➜ 检查并停止当前服务...${NC}"
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" 2>/dev/null || true
        sleep 2
        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID" 2>/dev/null || true
            sleep 1
        fi
        echo -e "${GREEN}✅ 服务已停止 (PID: $PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  PID $PID 未运行${NC}"
    fi
    rm -f server.pid
else
    # 尝试通过进程名查找并停止
    NODE_PID=$(pgrep -f "node server/index.js" || true)
    if [ -n "$NODE_PID" ]; then
        kill "$NODE_PID" 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✅ 服务已停止 (PID: $NODE_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  未检测到运行中的服务${NC}"
    fi
fi

# 2. 备份数据
echo -e "${YELLOW}➜ 备份数据...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 数据库已备份: $BACKUP_DIR/$(basename $DB_FILE)${NC}"
else
    echo -e "${YELLOW}⚠️  未找到数据库文件${NC}"
fi

if [ -d "$UPLOADS_DIR" ]; then
    cp -r "$UPLOADS_DIR" "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 上传文件已备份${NC}"
fi

if [ -d "$IMAGES_DIR" ]; then
    cp -r "$IMAGES_DIR" "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 图片文件已备份${NC}"
fi

# 3. 拉取最新代码
echo -e "${YELLOW}➜ 拉取最新代码...${NC}"

if [ -d ".git" ]; then
    # 使用 git 更新
    git fetch origin
    git reset --hard origin/main
    echo -e "${GREEN}✅ 代码已更新 (git)${NC}"
elif command -v git &> /dev/null; then
    # 没有 .git 但有 git，重新克隆
    cd ..
    mv "$INSTALL_DIR" "${INSTALL_DIR}_old"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    echo -e "${GREEN}✅ 代码已重新克隆${NC}"
else
    # 使用 curl 下载最新代码
    cd ..
    mv "$INSTALL_DIR" "${INSTALL_DIR}_old"
    TAR_URL="https://github.com/andy0715888/accounting-system/archive/main.tar.gz"
    curl -L -o temp.tar.gz "$TAR_URL"
    tar -xzf temp.tar.gz
    mv accounting-system-main "$INSTALL_DIR"
    rm temp.tar.gz
    cd "$INSTALL_DIR"
    echo -e "${GREEN}✅ 代码已下载更新${NC}"
fi

# 4. 恢复数据
echo -e "${YELLOW}➜ 恢复数据...${NC}"

if [ -f "$BACKUP_DIR/$(basename $DB_FILE)" ]; then
    mkdir -p "$(dirname $DB_FILE)"
    cp "$BACKUP_DIR/$(basename $DB_FILE)" "$DB_FILE"
    echo -e "${GREEN}✅ 数据库已恢复${NC}"
fi

if [ -d "$BACKUP_DIR/$UPLOADS_DIR" ]; then
    cp -r "$BACKUP_DIR/$UPLOADS_DIR" .
    echo -e "${GREEN}✅ 上传文件已恢复${NC}"
fi

if [ -d "$BACKUP_DIR/$(basename $IMAGES_DIR)" ]; then
    mkdir -p "$(dirname $IMAGES_DIR)"
    cp -r "$BACKUP_DIR/$(basename $IMAGES_DIR)" "$(dirname $IMAGES_DIR)/"
    echo -e "${GREEN}✅ 图片文件已恢复${NC}"
fi

# 5. 安装依赖
echo -e "${YELLOW}➜ 安装/更新依赖...${NC}"
npm install --registry=https://registry.npmmirror.com
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 依赖安装完成${NC}"

# 6. 清理旧目录
if [ -d "${PROJECT_DIR}_old" ] || [ -d "../${INSTALL_DIR}_old" ]; then
    rm -rf "${PROJECT_DIR}_old" "../${INSTALL_DIR}_old" 2>/dev/null || true
    echo -e "${GREEN}✅ 旧目录已清理${NC}"
fi

# 7. 启动服务
echo -e "${YELLOW}➜ 启动服务...${NC}"
nohup npm start > server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > server.pid
sleep 2

if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✅ 服务已启动 (PID: $SERVER_PID)${NC}"
else
    echo -e "${RED}❌ 服务启动失败，请查看 server.log${NC}"
    exit 1
fi

IP_ADDR=$(hostname -I | awk '{print $1}')
[ -z "$IP_ADDR" ] && IP_ADDR="localhost"

echo ""
echo -e "${GREEN}=========================================="
echo "  🎉 更新完成！"
echo "==========================================${NC}"
echo ""
echo -e "🌐 访问地址: http://${IP_ADDR}:3000"
echo -e "📂 项目目录: $(pwd)"
echo -e "📄 服务日志: $(pwd)/server.log"
echo -e "💾 数据备份: $(pwd)/$BACKUP_DIR"
echo ""
echo -e "${YELLOW}⚠️  更新前数据已自动备份，如有问题可手动恢复${NC}"
echo ""
echo -e "🔧 常用命令："
echo "   停止服务: kill \$(cat server.pid)"
echo "   查看日志: tail -f server.log"
echo "   手动恢复: cp $BACKUP_DIR/accounting.db data/"
echo ""
echo -e "${GREEN}==========================================${NC}"
