# 時事預測所

針對時事開題、依 Claude 上網蒐集的資料計算賠率下注，並記錄自己思路的預測帳本。

**網址：https://wwadehong.github.io/hexacalc/forecast/**

## 第一次使用（每台裝置設定一次）

1. 打開網站，按「連結 GitHub」。
2. 到 [GitHub 建立權杖頁面](https://github.com/settings/personal-access-tokens/new) 建立 Fine-grained token：
   - Token name：時事預測所；Expiration：1 年或 No expiration
   - Repository access：Only select repositories → `hexacalc`
   - Permissions → Repository permissions → **Contents：Read and write**
3. 把權杖貼回網站，再設定一組加密密碼（至少 6 個字，請記好）。
4. 手機：在電腦版「設定」掃 QR code，就會自動完成設定。

## 規則

- 起始 100 點，之後每天台灣時間 00:00 自動 +10 點（沒開網站也會累積）。
- Claude 估計每個答案成真的機率 p，**賠率 = 2 − p**（1.02～1.98）。
- 按「我要下注」時，網頁即時抓 Claude 最新的評估算出賠率並鎖定 10 分鐘，注單永遠用下注當下的賠率結算。
- **猜對**拿回「押注 × 賠率」；**猜錯**拿回「押注 × (賠率 − 1)」，只損失「押注 × p」；**作廢**全額退回。
- 以 Claude 的機率來算每注期望值都是 0，只有比 Claude 準，點數才會長期成長。

## 運作方式

| 位置 | 內容 | 誰寫入 |
| --- | --- | --- |
| `main` 分支 `forecast/index.html` | 網站本體（單一檔案） | Claude（依你的要求修改） |
| `forecast-data` 分支 `board.json` | 題目、「請 Claude 更新」請求 | 網站 |
| `forecast-data` 分支 `claude.json` | Claude 蒐集的資料、機率、公布結果 | Claude 排程 |
| `forecast-data` 分支 `vault.json` | 你的注單與思路筆記（AES-256-GCM 加密） | 網站 |

- Claude 排程約每 2 小時上網檢查一次（依 [`WORKER.md`](WORKER.md)）：更新各題資料與機率，過了預計公布時間的題目會查證結果並自動結算。
- 點數、命中率、盈虧都由注單與結果即時計算，不另外存。
- repo 是公開的：題目與 Claude 的資料任何人都看得到；注單和筆記只有輸入密碼才看得到。

## 想修改？

直接跟 Claude 說要改什麼（例如「把每日點數改成 20」「新增排行榜」），Claude 會修改 `forecast/index.html` 並推上來，GitHub Pages 約一分鐘後更新。常用設定集中在 `index.html` 開頭的 `CFG`。
