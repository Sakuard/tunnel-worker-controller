# Version Control Rules

## 自動版本遞增規則

這個項目使用 `phips28/gh-action-bump-version` 根據 commit message 自動遞增版本號。

### 📈 Major 版本遞增 (0.1.0 → 1.0.0)

Commit message 包含以下關鍵字時觸發：

- `BREAKING CHANGE`
- `major`
- 使用 `!` 語法表示破壞性變更

**觸發範例：**
```
BREAKING CHANGE: remove deprecated API
refactor!: drop support for Node 6
chore: major version bump
```

### 🔄 Minor 版本遞增 (0.1.0 → 0.2.0)

Commit message **以下列字詞開頭**時觸發：

- `feat`
- 包含 `minor` 關鍵字

**觸發範例：**
```
feat: add new authentication system
feat(auth): implement OAuth login
feature: new user dashboard
chore: minor version update
```

### 🔧 Patch 版本遞增 (0.1.0 → 0.1.1) - 預設

**所有其他 commit message** 都會觸發 patch 版本遞增：

**觸發範例：**
```
fix: resolve login bug
chore: update dependencies
docs: update README
style: fix code formatting
refactor: clean up user service
test: add unit tests
ci: update GitHub Actions
perf: optimize database queries
build: update webpack config
```

### 🧪 Pre-release 版本遞增 (0.1.0 → 0.1.1-rc.1)

Commit message 包含以下關鍵字時觸發：

- `pre-alpha`
- `pre-beta` 
- `pre-rc`

**觸發範例：**
```
chore: pre-alpha testing
feat: pre-beta new feature
fix: pre-rc bug fixes
```

---

## 當前設定

```yaml
# .github/workflows/docker-build.yml
- name: Automated Version Bump
  uses: phips28/gh-action-bump-version@master
  with:
    tag-prefix: 'v'
    default: 'patch'
```

## 版本控制策略

### 🎯 你的控制範圍
- **Major/Minor 版本**: 手動修改 `package.json` 中的版本號
- **或者**: 使用對應的 commit message 觸發自動遞增

### 🤖 自動化範圍  
- **Patch 版本**: 每次推送到 main branch 時自動遞增
- **Docker Tags**: 自動生成 `v1.2.3` 和 `latest` 標籤

## 建議的 Commit Message 格式

為了避免意外的版本遞增，建議使用以下格式：

```bash
# Patch 版本 (推薦日常使用)
fix: 修復登入問題
chore: 更新依賴套件
docs: 更新文檔
refactor: 重構代碼

# Minor 版本 (新功能)
feat: 新增用戶認證功能

# Major 版本 (破壞性變更)
feat!: 移除舊版 API
BREAKING CHANGE: 更改資料庫架構
```