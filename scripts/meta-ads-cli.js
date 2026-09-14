/**
 * Local CLI for the Christian Security Services Meta ad set.
 *
 * Usage:
 *   npm run ads:status
 *   npm run ads:pause
 *   npm run ads:resume
 *   npm run ads:budget -- 1
 *
 * Reads META_ADS_ACCESS_TOKEN from `.env`. Never prints the token.
 */
import 'dotenv/config';
import {
  getAdSetSnapshot,
  parseAdsCommand,
  updateAdSetDailyBudget,
  updateAdSetStatus,
} from '../server/lib/metaAds.js';

function printSnapshot(result) {
  if (!result.ok) {
    console.error('Ads command failed:', result.reason, result.status || '');
    process.exitCode = 1;
    return;
  }

  const { adSet, insights } = result;
  console.log(`Ad set: ${adSet.name} (${adSet.id})`);
  console.log(`Status: ${adSet.effectiveStatus || adSet.status}`);
  console.log(`Daily budget: $${adSet.dailyBudgetDollars}`);
  console.log(
    `Lifetime: $${insights.spend} spend, ${insights.impressions} impressions, ${insights.clicks} clicks, $${insights.cpc} CPC`
  );
}

const parsed = parseAdsCommand(process.argv.slice(2));

if (parsed.action === 'status') {
  printSnapshot(await getAdSetSnapshot());
} else if (parsed.action === 'pause') {
  const updated = await updateAdSetStatus('PAUSED');
  if (!updated.ok) {
    console.error('Pause failed:', updated.reason, updated.status || '');
    process.exitCode = 1;
  } else {
    printSnapshot(await getAdSetSnapshot());
  }
} else if (parsed.action === 'resume') {
  const updated = await updateAdSetStatus('ACTIVE');
  if (!updated.ok) {
    console.error('Resume failed:', updated.reason, updated.status || '');
    process.exitCode = 1;
  } else {
    printSnapshot(await getAdSetSnapshot());
  }
} else if (parsed.action === 'budget') {
  const updated = await updateAdSetDailyBudget(parsed.dollars);
  if (!updated.ok) {
    console.error('Budget update failed:', updated.reason, updated.status || '');
    process.exitCode = 1;
  } else {
    printSnapshot(await getAdSetSnapshot());
  }
} else {
  console.error('Usage: npm run ads:status | ads:pause | ads:resume | ads:budget -- <dollars>');
  process.exitCode = 1;
}
