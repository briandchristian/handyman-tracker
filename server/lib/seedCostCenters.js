/**
 * Upsert the seeded light-ledger cost centers without overwriting custom names.
 */

import { COST_CENTERS } from './costCenters.js';

export async function ensureCostCenters(CostCenter, seeds = COST_CENTERS) {
  for (const seed of seeds) {
    await CostCenter.updateOne(
      { code: seed.code },
      {
        $setOnInsert: {
          code: seed.code,
          name: seed.name,
          defaultClass: seed.defaultClass || 'indirect',
          active: true,
        },
      },
      { upsert: true }
    );
  }
  return CostCenter.find({ active: { $ne: false } }).sort({ code: 1 }).lean();
}
