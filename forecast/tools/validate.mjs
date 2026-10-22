#!/usr/bin/env node
// 檢查並整理 claude.json：機率正規化、欄位型別、選項與網址。
// 用法：node forecast/tools/validate.mjs <forecast-data 分支的資料夾>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.';
const file = join(dir, 'claude.json');
let board, claude;
try { board = JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')); }
catch (e) { console.error('讀不到 board.json：' + e.message); process.exit(1); }
try { claude = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error('claude.json 不是合法 JSON：' + e.message); process.exit(1); }

const errors = [], warnings = [];
const qs = new Map((board.questions || []).map(q => [q.id, q]));
const isIso = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const goodUrl = u => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };
const cleanSources = (list, where) => {
  if (!Array.isArray(list)) return [];
  return list.filter(s => {
    const ok = s && goodUrl(s.url);
    if (!ok) warnings.push(`${where}: 移除無效來源 ${JSON.stringify(s)}`);
    return ok;
  }).map(s => ({ title: String(s.title || '').slice(0, 200), url: s.url }));
};

claude.version = 1;
claude.worker = claude.worker && typeof claude.worker === 'object' ? claude.worker : {};
claude.research = claude.research && typeof claude.research === 'object' ? claude.research : {};
claude.results = claude.results && typeof claude.results === 'object' ? claude.results : {};

for (const [qid, r] of Object.entries(claude.research)) {
  const q = qs.get(qid);
  if (!q) { warnings.push(`research.${qid}: board.json 沒有這題（保留不動）`); continue; }
  if (!isIso(r.updatedAt)) errors.push(`research.${qid}.updatedAt 必須是 ISO 時間`);
  if (r.probs && typeof r.probs === 'object') {
    const ids = q.options.map(o => o.id);
    const extra = Object.keys(r.probs).filter(k => !ids.includes(k));
    if (extra.length) errors.push(`research.${qid}.probs 有不存在的選項：${extra.join(', ')}`);
    const missing = ids.filter(k => !(Number(r.probs[k]) >= 0));
    if (missing.length) errors.push(`research.${qid}.probs 缺少選項：${missing.join(', ')}`);
    if (!extra.length && !missing.length) {
      // 正規化：每個至少 0.02，加總為 1，四捨五入到 0.01
      let p = ids.map(k => Math.max(0.02, Number(r.probs[k])));
      const sum = p.reduce((a, b) => a + b, 0);
      p = p.map(x => Math.round((x / sum) * 100) / 100);
      const diff = Math.round((1 - p.reduce((a, b) => a + b, 0)) * 100) / 100;
      if (diff) { const i = p.indexOf(Math.max(...p)); p[i] = Math.round((p[i] + diff) * 100) / 100; }
      r.probs = Object.fromEntries(ids.map((k, i) => [k, p[i]]));
    }
  } else errors.push(`research.${qid}.probs 必須是物件`);
  r.sources = cleanSources(r.sources, `research.${qid}`);
  if (r.facts && !Array.isArray(r.facts)) errors.push(`research.${qid}.facts 必須是陣列`);
  if (r.confidence && !['low', 'medium', 'high'].includes(r.confidence)) warnings.push(`research.${qid}.confidence 應為 low/medium/high`);
}

for (const [qid, r] of Object.entries(claude.results)) {
  const q = qs.get(qid);
  if (!q) { warnings.push(`results.${qid}: board.json 沒有這題（保留不動）`); continue; }
  if (r.optionId !== 'void' && !q.options.some(o => o.id === r.optionId)) errors.push(`results.${qid}.optionId「${r.optionId}」不是這題的選項`);
  if (!isIso(r.decidedAt)) errors.push(`results.${qid}.decidedAt 必須是 ISO 時間`);
  r.sources = cleanSources(r.sources, `results.${qid}`);
}

for (const w of warnings) console.warn('注意：' + w);
if (errors.length) { for (const e of errors) console.error('錯誤：' + e); process.exit(1); }
writeFileSync(file, JSON.stringify(claude, null, 2) + '\n');
console.log(`claude.json 檢查通過（${Object.keys(claude.research).length} 題資料、${Object.keys(claude.results).length} 題結果）`);
