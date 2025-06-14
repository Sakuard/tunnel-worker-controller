# 項目自動化部署計劃

## 🚀 Helm Chart OCI 發布計劃

### Step 5: 實施 Helm Chart OCI 發布 ✅
- [x] 建立獨立的 `.github/workflows/helm-publish.yml`
- [x] 配置 Chart.yaml 版本變更偵測邏輯
- [x] 設定 GHCR.io OCI registry 發布流程
- [x] 建立 helm-v* git tag 命名規則
- [x] 添加 Chart 驗證機制 (helm lint + template)
- **Status**: done

### Step 6: 測試 Helm Chart 版本控制
- [x] 驗證版本提取邏輯 (當前: v0.1.0)
- [x] 確認 git tag 檢查機制 (helm-v0.1.0 不存在)
- [x] **修正**: 調整 helm-publish.yml 觸發條件包含 workflow 檔案變更
- [x] **修正**: 設置 Docker workflow paths-ignore 避免衝突
- [ ] 測試手動修改 Chart.yaml 版本觸發發布
- [ ] 驗證 OCI chart 成功推送到 GHCR
- [ ] 確認 git tag 正確建立 (helm-v0.1.1)
- [ ] 測試 helm install 從 OCI registry
- **Status**: in_progress

---

## 📋 版本控制策略總覽

### Docker Images (自動化) 🐳
- **觸發**: 每次推送到 main branch (排除 chart/、*.md 檔案)
- **版本來源**: package.json (目前 v0.2.1)
- **發布位置**: `ghcr.io/sakuard/tunnel-worker-controller/job-manager:v0.2.1`
- **管理方式**: commit message 控制版本遞增類型
- **Workflow**: `.github/workflows/docker-build.yml`

### Helm Charts (手動控制) ⚓
- **觸發**: `chart/` 目錄變更時 OR helm-publish.yml 變更時
- **版本來源**: Chart.yaml version 字段 (目前 v0.1.0)
- **發布位置**: `oci://ghcr.io/sakuard/tunnel-worker-controller`
- **管理方式**: 手動修改 Chart.yaml → 推送 → 自動 OCI 發布
- **Workflow**: `.github/workflows/helm-publish.yml`

### 工作流程
```
Docker 版本更新:
commit (排除 chart/, *.md) → auto version bump → docker build → push images

Helm Chart 版本更新:
手動修改 Chart.yaml → push → 偵測版本變更 → helm package → OCI push → git tag
```

### 優勢
- ✅ Docker 和 Helm 版本獨立管理
- ✅ 只在相關檔案變更時觸發對應 pipeline
- ✅ Helm Chart 結構變更不受應用版本影響
- ✅ 統一使用 GHCR.io registry
- ✅ 版本歷史完整追蹤 (docker tags + helm tags)
- ✅ PR 時進行 Chart 驗證
- ✅ 避免 workflow 互相干擾

---

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

### 自動化部分 (每次推送到 main，排除 chart/ 和 *.md)
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
- ✅ Helm Chart 和 Docker 版本控制隔離