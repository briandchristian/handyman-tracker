/**
 * Unit tests for the local Meta Marketing API helper.
 *
 * This module lets us read spend and change budget/status on the Christian
 * Security Services ad account without Adspirer. It is an operator tool, not
 * a customer-facing route: a missing token must no-op, a bad budget must be
 * rejected locally, and the access token must never appear in a request URL.
 *
 * Daily budgets are authored in dollars and converted to Meta's cent units.
 * A hard ceiling matches the account spending limit so a typo cannot reopen
 * the $15/day surprise.
 */

import {
  DEFAULT_META_ADS_ACCOUNT_ID,
  DEFAULT_META_AD_SET_ID,
  DEFAULT_META_CAMPAIGN_ID,
  MAX_DAILY_BUDGET_DOLLARS,
  MIN_DAILY_BUDGET_DOLLARS,
  dollarsToBudgetCents,
  getAdSetSnapshot,
  getMetaAdsConfig,
  parseAdsCommand,
  updateAdSetDailyBudget,
  updateAdSetStatus,
} from '../lib/metaAds.js';

const TOKEN = 'test-ads-token';
const envWithToken = {
  META_ADS_ACCESS_TOKEN: TOKEN,
  META_ADS_ACCOUNT_ID: '1115051401100007',
  META_ADS_AD_SET_ID: '120251033936370638',
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('getMetaAdsConfig', () => {
  test('is disabled when the access token is missing', () => {
    const config = getMetaAdsConfig({});
    expect(config.enabled).toBe(false);
    expect(config.accessToken).toBe('');
  });

  test('is disabled when the access token is blank whitespace', () => {
    expect(getMetaAdsConfig({ META_ADS_ACCESS_TOKEN: '   ' }).enabled).toBe(
      false
    );
  });

  test('is enabled when an access token is present', () => {
    const config = getMetaAdsConfig({ META_ADS_ACCESS_TOKEN: TOKEN });
    expect(config.enabled).toBe(true);
    expect(config.accessToken).toBe(TOKEN);
  });

  test('falls back to the Christian Security Services ad account and ad set', () => {
    const config = getMetaAdsConfig({ META_ADS_ACCESS_TOKEN: TOKEN });
    expect(config.accountId).toBe(DEFAULT_META_ADS_ACCOUNT_ID);
    expect(config.adSetId).toBe(DEFAULT_META_AD_SET_ID);
    expect(config.campaignId).toBe(DEFAULT_META_CAMPAIGN_ID);
    expect(DEFAULT_META_ADS_ACCOUNT_ID).toBe('1115051401100007');
    expect(DEFAULT_META_AD_SET_ID).toBe('120251033936370638');
    expect(DEFAULT_META_CAMPAIGN_ID).toBe('120251033936190638');
  });

  test('prefers explicit env overrides and trims them', () => {
    const config = getMetaAdsConfig({
      META_ADS_ACCESS_TOKEN: `  ${TOKEN}  `,
      META_ADS_ACCOUNT_ID: '  act_999  ',
      META_ADS_AD_SET_ID: '  123  ',
      META_ADS_CAMPAIGN_ID: '  456  ',
    });
    expect(config.accessToken).toBe(TOKEN);
    expect(config.accountId).toBe('999');
    expect(config.adSetId).toBe('123');
    expect(config.campaignId).toBe('456');
  });
});

describe('dollarsToBudgetCents', () => {
  test('converts whole dollars to Meta cent units', () => {
    expect(dollarsToBudgetCents(1)).toBe(100);
    expect(dollarsToBudgetCents(15)).toBe(1500);
  });

  test('rejects values below the one-dollar floor', () => {
    expect(dollarsToBudgetCents(0)).toBeNull();
    expect(dollarsToBudgetCents(0.5)).toBeNull();
    expect(dollarsToBudgetCents(-1)).toBeNull();
  });

  test('rejects values above the account-limit safety ceiling', () => {
    expect(MAX_DAILY_BUDGET_DOLLARS).toBe(50);
    expect(MIN_DAILY_BUDGET_DOLLARS).toBe(1);
    expect(dollarsToBudgetCents(50)).toBe(5000);
    expect(dollarsToBudgetCents(51)).toBeNull();
  });

  test('rejects non-numeric input', () => {
    expect(dollarsToBudgetCents('abc')).toBeNull();
    expect(dollarsToBudgetCents(undefined)).toBeNull();
  });
});

describe('parseAdsCommand', () => {
  test('parses status, pause, and resume', () => {
    expect(parseAdsCommand(['status'])).toEqual({ action: 'status' });
    expect(parseAdsCommand(['pause'])).toEqual({ action: 'pause' });
    expect(parseAdsCommand(['resume'])).toEqual({ action: 'resume' });
  });

  test('parses a budget amount', () => {
    expect(parseAdsCommand(['budget', '1'])).toEqual({
      action: 'budget',
      dollars: 1,
    });
  });

  test('returns unknown for an empty or unrecognized command', () => {
    expect(parseAdsCommand([])).toEqual({ action: 'unknown' });
    expect(parseAdsCommand(['explode'])).toEqual({
      action: 'unknown',
      command: 'explode',
    });
  });
});

describe('getAdSetSnapshot', () => {
  test('no-ops without calling the network when the token is missing', async () => {
    const fetchImpl = jest.fn();
    const result = await getAdSetSnapshot({ env: {}, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  test('reads ad set fields and lifetime insights', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: '120251033936370638',
          name: 'Leoma radius',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          daily_budget: '100',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              spend: '66.34',
              impressions: '6003',
              clicks: '161',
              cpc: '0.41',
              reach: '4100',
            },
          ],
        })
      );

    const result = await getAdSetSnapshot({
      env: envWithToken,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.adSet.name).toBe('Leoma radius');
    expect(result.adSet.dailyBudgetDollars).toBe(1);
    expect(result.insights.spend).toBe(66.34);
    expect(result.insights.impressions).toBe(6003);
    expect(result.insights.clicks).toBe(161);

    const adSetUrl = fetchImpl.mock.calls[0][0];
    const insightsUrl = fetchImpl.mock.calls[1][0];
    expect(adSetUrl).toContain('120251033936370638');
    expect(adSetUrl).not.toContain(TOKEN);
    expect(insightsUrl).toContain('/insights');
    expect(insightsUrl).not.toContain(TOKEN);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${TOKEN}`
    );
  });

  test('reports an http error without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth' } }),
      text: async () => 'Invalid OAuth',
    });

    const result = await getAdSetSnapshot({ env: envWithToken, fetchImpl });
    expect(result).toEqual({
      ok: false,
      reason: 'http-error',
      status: 401,
    });
  });

  test('reports a thrown fetch as an exception without rejecting', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const result = await getAdSetSnapshot({ env: envWithToken, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'exception' });
  });
});

describe('updateAdSetDailyBudget', () => {
  test('no-ops when disabled', async () => {
    const fetchImpl = jest.fn();
    const result = await updateAdSetDailyBudget(1, { env: {}, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  test('rejects an out-of-range budget before touching the network', async () => {
    const fetchImpl = jest.fn();
    const result = await updateAdSetDailyBudget(75, {
      env: envWithToken,
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'budget-out-of-range' });
  });

  test('posts daily_budget in cent units', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ success: true }));

    const result = await updateAdSetDailyBudget(1, {
      env: envWithToken,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.dailyBudgetDollars).toBe(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('120251033936370638');
    expect(url).not.toContain(TOKEN);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.daily_budget).toBe('100');
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });
});

describe('updateAdSetStatus', () => {
  test('posts PAUSED and ACTIVE', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ success: true }));

    await expect(
      updateAdSetStatus('PAUSED', { env: envWithToken, fetchImpl })
    ).resolves.toEqual({ ok: true, status: 'PAUSED' });
    await expect(
      updateAdSetStatus('ACTIVE', { env: envWithToken, fetchImpl })
    ).resolves.toEqual({ ok: true, status: 'ACTIVE' });

    const pausedBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const activeBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(pausedBody.status).toBe('PAUSED');
    expect(activeBody.status).toBe('ACTIVE');
  });

  test('rejects an invalid status without calling the network', async () => {
    const fetchImpl = jest.fn();
    const result = await updateAdSetStatus('DELETED', {
      env: envWithToken,
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'invalid-status' });
  });
});
