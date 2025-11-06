#!/bin/bash
# 转账交易监控脚本

echo "=== 转账交易监控已启动 ==="
echo "时间: $(date)"
echo ""
echo "请在前端执行转账操作..."
echo ""

# 监控 nodejs 容器日志
echo "监控 nodejs 容器日志（转账相关）..."
docker-compose logs -f --tail 0 nodejs 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -qiE "transfer|转账|POST.*transfer|error|失败|timeout|waiting|pending|卡住|hang|sendTransaction|walletClient"; then
        echo "[$(date '+%H:%M:%S')] $line"
    fi
done

