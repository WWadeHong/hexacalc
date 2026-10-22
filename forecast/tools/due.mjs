#!/usr/bin/env node
// 列出這次需要 Claude 處理的題目。
// 用法：node forecast/tools/due.mjs <forecast-data 分支的資料夾>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.';
const read = (f, fallback) => {
  try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return fallback; }
};
const board = read('board.json', { questions: [], requests: [] });
const claude = read('claude.json', { worker: {}, research: {}, results: {} });

const now = Date.now();
const HOUR = 3600e3;
const ms = s => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };

// 尚未處理的「請 Claude 更新」請求
const handled = ms(claude.worker?.handledRequestsUpTo);
const pending = (board.requests || []).filter(r => ms(r.at) > handled);
const wantAll = pending.some(r => !r.qid);
const wantQ = new Set(pending.filter(r => r.qid).map(r => r.qid));
const latestReq = pending.reduce((m, r) => Math.max(m, ms(r.at)), 0);

const items = [];
for (const q of board.questions || []) {
  if (!q || !q.id || q.voided || q.manualResult) continue;
  if (claude.results?.[q.id]?.optionId) continue;
  const deadline = ms(q.deadline);
  const resolveAt = ms(q.resolveAt) || deadline;
  const r = claude.research?.[q.id];
  const ageH = r?.updatedAt ? (now - ms(r.updatedAt)) / HOUR : Infinity;
  const optionsChanged = q.optionsRev && ms(q.optionsRev) > ms(r?.updatedAt);
  // 截止前 48 小時內每 6 小時更新一次，其他時候每 12 小時
  const refreshH = deadline - now < 48 * HOUR ? 6 : 12;
  let action = null, reason = '';
  if (now >= resolveAt) { action = 'resolve'; reason = '已過預計公布時間，查證結果'; }
  else if (!r) { action = 'research'; reason = '新題目，尚未評估'; }
  else if (optionsChanged) { action = 'research'; reason = '選項已修改，需重新評估'; }
  else if (wantAll || wantQ.has(q.id)) { action = 'research'; reason = '使用者要求更新'; }
  else if (now < deadline && ageH >= refreshH) { action = 'research'; reason = `資料已 ${Math.floor(ageH)} 小時未更新`; }
  if (action) items.push({ qid: q.id, action, reason, title: q.title, options: q.options });
}

console.log(JSON.stringify({
  now: new Date(now).toISOString(),
  pendingRequests: pending.length,
  handledRequestsUpTo: latestReq ? new Date(latestReq).toISOString() : (claude.worker?.handledRequestsUpTo ?? null),
  items,
}, null, 2));
