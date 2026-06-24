cat > ~/accounting-system/update.sh <<'EOF'
#!/bin/bash

set -e

REPO_URL="https://github.com/andy0715888/accounting-system.git"
INSTALL_DIR="accounting-system"
DB_FILE="data/accounting.db"
UPLOADS_DIR="uploads"
IMAGES_DIR="public/images"
PORT="3000"
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "  记账系统 - 一键更新"
echo "=========================================="
echo ""

if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    if [ -d "$HOME/$INSTALL_DIR" ]; then
        cd "$HOME/$INSTALL_DIR"
    elif [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
    else
        echo "❌ 未找到项目目录，请先进入 accounting-system 目录"
        exit 1
    fi
fi

PROJECT_DIR=$(pwd)
echo "📂 项目目录: $PROJECT_DIR"

stop_service() {
    echo "➜ 检查并停止当前服务..."

    if [ -f "server.pid" ]; then
        PID=$(cat server.pid)
        if ps -p "$PID" > /dev/null 2>&1; then
            kill "$PID" 2>/dev/null || true
            sleep 2

            if ps -p "$PID" > /dev/null 2>&1; then
                kill -9 "$PID" 2>/dev/null || true
                sleep 1
            fi

            echo "✅ 已按 server.pid 停止服务: $PID"
        else
            echo "⚠️ server.pid 里的进程未运行: $PID"
        fi

        rm -f server.pid
    else
        echo "⚠️ 未找到 server.pid"
    fi

    NODE_PIDS=$(pgrep -f "node server/index.js" || true)
    if [ -n "$NODE_PIDS" ]; then
        echo "➜ 发现 node server/index.js 进程，正在停止..."
        echo "$NODE_PIDS" | xargs -r kill 2>/dev/null || true
        sleep 2

        NODE_PIDS_LEFT=$(pgrep -f "node server/index.js" || true)
        if [ -n "$NODE_PIDS_LEFT" ]; then
            echo "$NODE_PIDS_LEFT" | xargs -r kill -9 2>/dev/null || true
            sleep 1
        fi

        echo "✅ Node 服务进程已清理"
    fi

    if command -v fuser >/dev/null 2>&1; then
        PORT_PIDS=$(fuser "$PORT/tcp" 2>/dev/null || true)
        if [ -n "$PORT_PIDS" ]; then
            echo "➜ 发现端口 $PORT 被占用，正在释放..."
            fuser -k "$PORT/tcp" 2>/dev/null || true
            sleep 2
            echo "✅ 端口 $PORT 已释放"
        fi
    elif command -v lsof >/dev/null 2>&1; then
        PORT_PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
        if [ -n "$PORT_PIDS" ]; then
            echo "➜ 发现端口 $PORT 被占用，正在释放..."
            echo "$PORT_PIDS" | xargs -r kill -9 2>/dev/null || true
            sleep 2
            echo "✅ 端口 $PORT 已释放"
        fi
    else
        echo "⚠️ 系统没有 fuser/lsof，无法自动检查端口占用"
    fi
}

backup_data() {
    echo "➜ 备份数据..."
    mkdir -p "$BACKUP_DIR"

    if [ -f "$DB_FILE" ]; then
        cp "$DB_FILE" "$BACKUP_DIR/accounting.db"
        echo "✅ 数据库已备份: $BACKUP_DIR/accounting.db"
    else
        echo "⚠️ 未找到数据库文件: $DB_FILE"
    fi

    if [ -d "$UPLOADS_DIR" ]; then
        cp -r "$UPLOADS_DIR" "$BACKUP_DIR/uploads"
        echo "✅ 上传文件已备份"
    fi

    if [ -d "$IMAGES_DIR" ]; then
        mkdir -p "$BACKUP_DIR/public"
        cp -r "$IMAGES_DIR" "$BACKUP_DIR/public/images"
        echo "✅ 图片文件已备份"
    fi
}

update_code() {
    echo "➜ 拉取最新代码..."

    if [ -d ".git" ]; then
        git fetch origin
        git reset --hard origin/main
        echo "✅ 代码已更新"
    else
        echo "❌ 当前目录不是 git 项目，无法直接 git 更新"
        echo "请确认你当前目录是 /root/accounting-system"
        exit 1
    fi
}

restore_data() {
    echo "➜ 恢复数据..."

    if [ -f "$BACKUP_DIR/accounting.db" ]; then
        mkdir -p "data"
        cp "$BACKUP_DIR/accounting.db" "$DB_FILE"
        echo "✅ 数据库已恢复"
    fi

    if [ -d "$BACKUP_DIR/uploads" ]; then
        rm -rf "$UPLOADS_DIR"
        cp -r "$BACKUP_DIR/uploads" "$UPLOADS_DIR"
        echo "✅ 上传文件已恢复"
    fi

    if [ -d "$BACKUP_DIR/public/images" ]; then
        mkdir -p "public"
        rm -rf "$IMAGES_DIR"
        cp -r "$BACKUP_DIR/public/images" "$IMAGES_DIR"
        echo "✅ 图片文件已恢复"
    fi
}

install_deps() {
    echo "➜ 安装/更新依赖..."
    npm install --registry=https://registry.npmmirror.com
    echo "✅ 依赖安装完成"
}

start_service() {
    echo "➜ 启动服务..."

    if command -v fuser >/dev/null 2>&1; then
        PORT_PIDS=$(fuser "$PORT/tcp" 2>/dev/null || true)
        if [ -n "$PORT_PIDS" ]; then
            echo "⚠️ 启动前发现端口 $PORT 仍被占用，再次释放..."
            fuser -k "$PORT/tcp" 2>/dev/null || true
            sleep 2
        fi
    elif command -v lsof >/dev/null 2>&1; then
        PORT_PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
        if [ -n "$PORT_PIDS" ]; then
            echo "⚠️ 启动前发现端口 $PORT 仍被占用，再次释放..."
            echo "$PORT_PIDS" | xargs -r kill -9 2>/dev/null || true
            sleep 2
        fi
    fi

    nohup npm start > server.log 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" > server.pid

    sleep 3

    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo "✅ 服务已启动，PID: $SERVER_PID"
    else
        echo "❌ 服务启动失败，请查看日志："
        echo "------------------------------------------"
        tail -n 80 server.log || true
        echo "------------------------------------------"
        exit 1
    fi
}

stop_service
backup_data
update_code
restore_data
install_deps
start_service

IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP_ADDR" ] && IP_ADDR="localhost"

echo ""
echo "=========================================="
echo "  🎉 更新完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://${IP_ADDR}:${PORT}"
echo "📂 项目目录: $(pwd)"
echo "📄 服务日志: $(pwd)/server.log"
echo "💾 数据备份: $(pwd)/$BACKUP_DIR"
echo ""
echo "常用命令："
echo "  查看日志: tail -f server.log"
echo "  停止服务: kill \$(cat server.pid)"
echo "  查看端口: ss -ltnp | grep :${PORT}"
echo ""
EOF

chmod +x ~/accounting-system/update.sh
