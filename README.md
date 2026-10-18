# Focus Matrix - 艾森豪威尔四象限时间管理工作台

专为高效人士打造的四象限法则（重要-紧急）极简任务管理记事本，支持跨设备云端实时同步、按天完成趋势图表、到期自动流转象限与深色模式。

## 🌟 核心特性
- **极简四象限设计**：浅色优雅卡片设计，清晰划分 4 个象限。
- **用户名/密码体系**：支持多用户独立注册登录，数据云端隔离，跨电脑/跨手机无缝漫游。
- **临期自动升象限**：支持为任务标记截止时间，若距离截止日 $\le$ 2 天，自动升级为“紧急”象限！
- **完成趋势统计图表**：内置每日完成任务柱状图，点击任意日期查看当天办结清单。
- **零成本云部署**：支持一键部署到 Render / 阿里云 / 任意服务器。

## 🚀 本地开发与运行
```bash
# 1. 安装依赖
npm install

# 2. 启动服务 (同时运行后端 API 与 Vite 前端)
npm run dev
```
打开浏览器访问 `http://localhost:3000` 即可使用。

## 📦 部署到 Render 平台 (免备案 / 终身免费 / 自带 HTTPS)
1. 注册并登录 [Render.com](https://render.com)（使用 GitHub 账号登录）。
2. 点击 **New** -> **Web Service**，选择此 GitHub 仓库。
3. 配置参数：
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. 点击 **Create Web Service**，等待 2 分钟即可获得专属在线网址（如 `https://focus-matrix.onrender.com`）。
