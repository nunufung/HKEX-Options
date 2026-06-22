import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateDTE } from '../src/DecisionEngine';
import { DEFAULT_ALERT_SETTINGS } from '../src/types';

interface TrackedPosition {
  id: string;
  symbol: string;
  name?: string;
  type: 'Short Put' | 'Short Call' | 'Covered Call' | 'Long Put';
  strike: number;
  expiry: string; // YYYY-MM-DD
  contracts?: number;
  entryPrice?: number;
  margin?: number;
  notes?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'positions.json');

function main() {
  const positions: TrackedPosition[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

  if (positions.length === 0) {
    console.log('No positions on file. Add entries to automation/positions.json to track them here.');
    return;
  }

  const threshold = DEFAULT_ALERT_SETTINGS.dteThreshold;

  const withDte = positions
    .map(p => ({ ...p, dte: calculateDTE(p.expiry) }))
    .sort((a, b) => a.dte - b.dte);

  console.log(`Tracked positions: ${withDte.length} | DTE alert threshold: ${threshold} days`);
  console.log('');

  for (const p of withDte) {
    const label = `${p.symbol}${p.name ? ` (${p.name})` : ''} — ${p.type} ${p.strike} exp ${p.expiry}`;

    if (p.dte <= 0) {
      console.log(`ATTENTION: ${label} — expires today or already past expiry; close, roll, or remove from positions.json`);
    } else if (p.dte <= threshold) {
      console.log(`ATTENTION: ${label} — ${p.dte} DTE (within ${threshold}-day threshold)`);
    } else {
      console.log(`OK: ${label} — ${p.dte} DTE`);
    }

    if (p.entryPrice !== undefined) console.log(`  entry: ${p.entryPrice}${p.margin !== undefined ? ` | margin: ${p.margin}` : ''}${p.contracts !== undefined ? ` | contracts: ${p.contracts}` : ''}`);
    if (p.notes) console.log(`  notes: ${p.notes}`);
  }
}

main();
