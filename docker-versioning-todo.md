# Docker Image 版本管控實施計劃

## Step 1: 修改 GitHub Actions Workflow ✅
- [x] 編輯 `.github/workflows/docker-build.yml`
- [x] 移除 tags 觸發條件，改為只在 main branch 推送時觸發
- [x] 添加兩階段 workflow：version → build
- **Status**: done

## Step 2: ~~創建版本發布腳本~~ (已廢棄) ❌
- ~~創建 `scripts/` 目錄~~
- ~~新增 `scripts/release.sh` 腳本~~
- **Status**: obsolete (改用自動化方案)

## Step 3: 實施基於 package.json 的自動版本控制 ✅
- [x] 添加 `phips28/gh-action-bump-version` action
- [x] 配置自動遞增 patch 版本
- [x] 設定 version job 輸出新版本號給 build job
- [x] 修改 Docker tags 使用動態版本號
- [x] 確保只在非 PR 時執行版本遞增和構建
- **Status**: done

## Step 4: 驗證 Image Hash 一致性
- [ ] 推送測試 commit 觸發自動版本遞增
- [ ] 確認 package.json 版本正確更新 (0.1.0 → 0.1.1)
- [ ] 驗證 git tag 正確創建 (v0.1.1)
- [ ] 檢查 Docker images 成功構建
- [ ] 拉取並比較 v0.1.1 和 latest tags 的 digest hash
- **Status**: pending

---

## 當前版本控制流程

### 自動化部分 (每次推送到 main)
1. GitHub Actions 自動讀取 package.json 當前版本
2. 自動遞增 patch 版本 (0.1.0 → 0.1.1)
3. 更新 package.json 並提交到 repo
4. 創建對應的 git tag (v0.1.1)
5. 構建 Docker images 並推送兩個 tags：
   - `ghcr.io/sakuard/tunnel-worker-controller/job-manager:v0.1.1`
   - `ghcr.io/sakuard/tunnel-worker-controller/job-manager:latest`

### 手動控制部分 (你的責任)
- 當需要 minor 或 major 版本更新時，手動修改 package.json：
  ```json
  {
    "version": "0.2.0"  // 或 "1.0.0" for major
  }
  ```
- 然後推送到 main，系統會自動處理後續的 patch 版本

### 優勢
- ✅ 自動化 patch 版本管理
- ✅ 基於 package.json 統一版本來源
- ✅ 每次推送都有版本追蹤
- ✅ Docker images 版本與代碼版本一致
- ✅ 歷史版本完整保留