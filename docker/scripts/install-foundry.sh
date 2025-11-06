#!/bin/sh
set -e

echo "正在安装 Foundry..."

# 检查是否已安装
if [ -f "/root/.foundry/bin/anvil" ]; then
    echo "Foundry 已安装，跳过安装步骤"
    export PATH="$PATH:/root/.foundry/bin"
    exit 0
fi

# 检测系统类型并安装依赖
if [ -f /etc/alpine-release ]; then
    # Alpine Linux - 配置镜像源
    echo "检测到 Alpine Linux，配置镜像源（使用阿里云）..."
    sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories 2>/dev/null || true
    if ! grep -q "mirrors.aliyun.com" /etc/apk/repositories 2>/dev/null; then
        echo "https://mirrors.aliyun.com/alpine/v$(cat /etc/alpine-release | cut -d. -f1,2)/main" > /etc/apk/repositories
        echo "https://mirrors.aliyun.com/alpine/v$(cat /etc/alpine-release | cut -d. -f1,2)/community" >> /etc/apk/repositories
    fi
    echo "安装系统依赖（Alpine）..."
    apk update
    apk add --no-cache bash curl git make gcc g++ musl-dev rust cargo gcompat
elif [ -f /etc/debian_version ]; then
    # Debian/Ubuntu - 配置镜像源
    echo "检测到 Debian/Ubuntu，配置镜像源（使用阿里云）..."
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true
    sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true
    sed -i 's/security.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true
    echo "安装系统依赖（Debian/Ubuntu）..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq bash curl git make gcc g++ build-essential
fi

# 配置 Rust/Cargo 使用国内镜像（加速 Rust 工具链下载）
echo "配置 Rust 国内镜像..."
mkdir -p /root/.cargo
cat > /root/.cargo/config.toml << 'EOF'
[source.crates-io]
replace-with = 'rsproxy'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
EOF

# 安装 Foundry
echo "安装 Foundry 安装脚本..."
# 使用官方源（foundryup 会处理下载）
FOUNDRY_INSTALL_URL="${FOUNDRY_INSTALL_URL:-https://foundry.paradigm.xyz}"

# 如果设置了代理环境变量，curl 会自动使用
echo "使用代理下载 Foundry 安装脚本..."
if [ -n "$HTTP_PROXY" ] || [ -n "$http_proxy" ]; then
    echo "检测到代理配置: ${HTTP_PROXY:-${http_proxy}}"
fi

# 下载并执行 Foundry 安装脚本
echo "下载 Foundry 安装脚本..."
INSTALL_SCRIPT=$(curl -L "$FOUNDRY_INSTALL_URL" 2>&1)
if [ $? -ne 0 ]; then
    echo "Foundry 安装脚本下载失败"
    exit 1
fi

echo "执行 Foundry 安装脚本..."
# 执行安装脚本，即使有警告也继续
echo "$INSTALL_SCRIPT" | bash 2>&1 | while IFS= read -r line; do
    echo "$line"
    # 如果看到 shell 检测警告，忽略它（这是正常的）
    if echo "$line" | grep -q "could not detect shell"; then
        echo "警告：shell 检测失败，这是正常的，继续安装..."
    fi
done

# 手动设置 PATH（无论脚本是否成功）
export PATH="$PATH:/root/.foundry/bin"

# 检查 foundryup 是否存在
if [ ! -f "/root/.foundry/bin/foundryup" ]; then
    echo "❌ foundryup 不存在，安装失败"
    exit 1
fi

echo "✅ foundryup 已安装，继续..."

# 初始化 Foundry（使用环境变量加速下载）
export PATH="$PATH:/root/.foundry/bin"

# 配置 GitHub 镜像（如果可用，可以加速 foundryup 下载）
# 可以通过环境变量 GITHUB_PROXY 或 GITHUB_MIRROR 设置
if [ -n "$GITHUB_PROXY" ]; then
    export GITHUB_PROXY="$GITHUB_PROXY"
    echo "使用 GitHub 代理: $GITHUB_PROXY"
elif [ -n "$GITHUB_MIRROR" ]; then
    export GITHUB_MIRROR="$GITHUB_MIRROR"
    echo "使用 GitHub 镜像: $GITHUB_MIRROR"
fi

# 注意：foundryup 会从 GitHub Releases 下载二进制文件
# 如果网络较慢，可能需要等待较长时间
echo "正在下载 Foundry 工具链（这可能需要几分钟，请耐心等待）..."

# 配置代理（优先使用环境变量中的代理设置）
if [ -n "$HTTP_PROXY" ] || [ -n "$http_proxy" ]; then
    PROXY_URL="${HTTP_PROXY:-${http_proxy}}"
    echo "检测到代理环境变量: $PROXY_URL"
    # 确保所有相关环境变量都设置
    export HTTP_PROXY="${HTTP_PROXY:-$PROXY_URL}"
    export HTTPS_PROXY="${HTTPS_PROXY:-$PROXY_URL}"
    export http_proxy="${http_proxy:-$PROXY_URL}"
    export https_proxy="${https_proxy:-$PROXY_URL}"
    # 配置 git 使用代理
    git config --global http.proxy "$PROXY_URL" 2>/dev/null || true
    git config --global https.proxy "$PROXY_URL" 2>/dev/null || true
    git config --global http.https://github.com.proxy "$PROXY_URL" 2>/dev/null || true
    git config --global https.https://github.com.proxy "$PROXY_URL" 2>/dev/null || true
    echo "已配置使用代理: $PROXY_URL"
elif [ -n "$GITHUB_PROXY" ]; then
    echo "配置使用 GitHub 代理: $GITHUB_PROXY"
    # 配置 git 使用代理
    git config --global http.https://github.com.proxy "$GITHUB_PROXY" 2>/dev/null || true
    git config --global https.https://github.com.proxy "$GITHUB_PROXY" 2>/dev/null || true
    # 配置 curl 代理（通过环境变量）
    export HTTP_PROXY="$GITHUB_PROXY"
    export HTTPS_PROXY="$GITHUB_PROXY"
    export http_proxy="$GITHUB_PROXY"
    export https_proxy="$GITHUB_PROXY"
fi

# 运行 foundryup
/root/.foundry/bin/foundryup || {
    echo "❌ Foundry 初始化失败"
    echo "提示：如果下载失败，可能是网络问题，可以尝试："
    echo "  1. 在 docker-compose.yml 中设置 GITHUB_PROXY 环境变量"
    echo "     例如：GITHUB_PROXY=https://ghproxy.com"
    echo "  2. 或者等待网络恢复后重试"
    echo "  3. 或者手动下载并安装 Foundry"
    exit 1
}

# 验证安装
if [ -f "/root/.foundry/bin/anvil" ]; then
    echo "✅ Foundry 安装完成"
    echo "Anvil 路径: /root/.foundry/bin/anvil"
    /root/.foundry/bin/anvil --version
else
    echo "❌ Foundry 安装失败：anvil 可执行文件不存在"
    exit 1
fi

