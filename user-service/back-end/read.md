后端可以在 Docker 中直接跑，流程是：

docker compose build --no-cache backend   # 重新构建（Dockerfile 刚改过）
docker compose up -d postgres redis       # 先起依赖
docker compose run --rm seed              # 初始化测试数据
docker compose up -d backend frontend     # 启动前后端

如果想在本地跑（不用 Docker），也可以：

cd back-end
pip install -e .        # 安装依赖
python -m scripts.seed  # 初始化数据
uvicorn app.main:app --reload  # 启动服务