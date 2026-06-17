#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "  记账系统 - 一键安装"
echo "==========================================${NC}"
echo ""

echo -e "${YELLOW}➜ 检查系统环境...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}➜ 未检测到 Node.js，正在尝试自动安装...${NC}"
    if [ ! -d "$HOME/.nvm" ]; then
        echo -e "${YELLOW}➜ 安装 nvm...${NC}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    else
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    nvm install 18
    nvm use 18
    nvm alias default 18
    echo -e "${GREEN}✅ Node.js 安装成功: $(node -v)${NC}"
else
    echo -e "${GREEN}✅ Node.js 版本: $(node -v)${NC}"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  git 未安装，使用 curl 下载源码包${NC}"
    USE_GIT=false
else
    USE_GIT=true
    echo -e "${GREEN}✅ git 已安装${NC}"
fi

REPO_URL="https://github.com/andy0715888/accounting-system.git"
INSTALL_DIR="accounting-system"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  目录 '$INSTALL_DIR' 已存在${NC}"
    read -p "是否覆盖重新安装？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo -e "${RED}安装已取消${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}➜ 获取源码...${NC}"
if [ "$USE_GIT" = true ]; then
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
else
    TAR_URL="https://github.com/andy0715888/accounting-system/archive/main.tar.gz"
    curl -L -o temp.tar.gz "$TAR_URL"
    tar -xzf temp.tar.gz
    mv accounting-system-main "$INSTALL_DIR"
    rm temp.tar.gz
    cd "$INSTALL_DIR"
fi
echo -e "${GREEN}✅ 源码下载完成${NC}"

echo -e "${YELLOW}➜ 安装 Node.js 依赖...${NC}"
npm install --registry=https://registry.npmmirror.com
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 依赖安装完成${NC}"

mkdir -p data uploads public/images
echo -e "${GREEN}✅ 目录创建完成${NC}"

if [ ! -f "public/images/default-bg.jpg" ]; then
    echo -e "${YELLOW}➜ 创建默认背景图占位...${NC}"
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" | base64 -d > public/images/default-bg.jpg
    echo -e "${GREEN}✅ 默认背景图已创建${NC}"
fi

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
echo "  🎉 安装完成！"
echo "==========================================${NC}"
echo ""
echo -e "🌐 访问地址: http://${IP_ADDR}:3000"
echo -e "📝 默认账号: ${GREEN}admin${NC} / ${GREEN}admin123${NC}"
echo ""
echo -e "${YELLOW}⚠️  首次登录后请及时修改密码！${NC}"
echo ""
echo -e "📂 安装目录: $(pwd)"
echo -e "📄 服务日志: $(pwd)/server.log"
echo ""
echo -e "🔧 管理命令："
echo "   停止服务: kill \$(cat server.pid)"
echo "   重启服务: kill \$(cat server.pid) && npm start"
echo "   查看日志: tail -f server.log"
echo ""
echo -e "${GREEN}==========================================${NC}"
