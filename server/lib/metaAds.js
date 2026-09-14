/**
 * Meta Marketing API — local operator helper for Christian Security Services.
 *
 * Reads ad-set status/spend and updates daily budget or pause/resume. This is
 * not wired into the public Express app and must not be given to Vercel: a
 * token with ads_management can change spend, so it stays in a local `.env`
 * and is used only from `npm run ads:*` scripts.
 *
 * The access token is sent as a Bearer header, never as a query parameter, so
 * it cannot leak into URLs echoed by logs. Every exported async function
 * resolves to a result object and never throws.
 *
 * Configuration:
 *   META_ADS_ACCESS_TOKEN  — required to enable. System User token.
 *   META_ADS_ACCOUNT_ID    — optional; defaults to the security ad account.
 *   META_ADS_AD_SET_ID     — optional; defaults to the live Leoma ad set.
 *   META_ADS_CAMPAIGN_ID   — optional; defaults to the live campaign.
 */

import { META_GRAPH_API_VERSION } from './metaCapi.js';

export const DEFAULT_META_ADS_ACCOUNT_ID = '1115051401100007';
export const DEFAULT_META_AD_SET_ID = '120251033936370638';
export const DEFAULT_META_CAMPAIGN_ID = '120251033936190638';

/** Matches the Meta account spending limit we asked Brian to set. */
export const MAX_DAILY_BUDGET_DOLLARS = 50;
export const MIN_DAILY_BUDGET_DOLLARS = 1;

const ALLOWED_AD_SET_STATUSES = new Set(['ACTIVE', 'PAUSED']);

function stripActPrefix(accountId) {
  return String(accountId || '').replace(/^act_/i, '');
}

export function getMetaAdsConfig(env = process.env) {
  const accessToken = String(env.META_ADS_ACCESS_TOKEN || '').trim();
  const accountId =
    stripActPrefix(String(env.META_ADS_ACCOUNT_ID || '').trim()) ||
    DEFAULT_META_ADS_ACCOUNT_ID;
  const adSetId =
    String(env.META_ADS_AD_SET_ID || '').trim() || DEFAULT_META_AD_SET_ID;
  const campaignId =
    String(env.META_ADS_CAMPAIGN_ID || '').trim() || DEFAULT_META_CAMPAIGN_ID;

  return {
    accessToken,
    accountId,
    adSetId,
    campaignId,
    enabled: Boolean(accessToken),
  };
}

export function dollarsToBudgetCents(dollars) {
  const value = Number(dollars);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_DAILY_BUDGET_DOLLARS || value > MAX_DAILY_BUDGET_DOLLARS) {
    return null;
  }
  if (!Number.isInteger(value)) return null;
  return value * 100;
}

export function parseAdsCommand(argv = []) {
  const [command, ...rest] = argv;
  if (command === 'status') return { action: 'status' };
  if (command === 'pause') return { action: 'pause' };
  if (command === 'resume') return { action: 'resume' };
  if (command === 'budget') {
    return { action: 'budget', dollars: Number(rest[0]) };
  }
  return command
    ? { action: 'unknown', command }
    : { action: 'unknown' };
}

async function graphRequest(path, { method = 'GET', body, env, fetchImpl } = {}) {
  const config = getMetaAdsConfig(env);
  if (!config.enabled) {
    return { ok: false, reason: 'disabled' };
  }
  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'no-fetch' };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${path.replace(/^\//, '')}`;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
  };
  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetchImpl(url, options);
  if (!response || !response.ok) {
    return {
      ok: false,
      reason: 'http-error',
      status: response?.status,
    };
  }

  const data =
    response && typeof response.json === 'function'
      ? await response.json()
      : {};
  return { ok: true, data };
}

export async function getAdSetSnapshot(options = {}) {
  try {
    const { env = process.env, fetchImpl = globalThis.fetch } = options;
    const config = getMetaAdsConfig(env);
    const fields =
      'id,name,status,effective_status,daily_budget';
    const adSetResult = await graphRequest(
      `${config.adSetId}?fields=${fields}`,
      { env, fetchImpl }
    );
    if (!adSetResult.ok) return adSetResult;

    const insightsResult = await graphRequest(
      `${config.adSetId}/insights?fields=spend,impressions,clicks,cpc,reach&date_preset=maximum`,
      { env, fetchImpl }
    );
    if (!insightsResult.ok) return insightsResult;

    const adSet = adSetResult.data || {};
    const insightRow = insightsResult.data?.data?.[0] || {};
    const dailyBudgetCents = Number.parseInt(adSet.daily_budget, 10);

    return {
      ok: true,
      adSet: {
        id: adSet.id,
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effective_status,
        dailyBudgetDollars: Number.isFinite(dailyBudgetCents)
          ? dailyBudgetCents / 100
          : null,
      },
      insights: {
        spend: Number.parseFloat(insightRow.spend || '0') || 0,
        impressions: Number.parseInt(insightRow.impressions || '0', 10) || 0,
        clicks: Number.parseInt(insightRow.clicks || '0', 10) || 0,
        cpc: Number.parseFloat(insightRow.cpc || '0') || 0,
        reach: Number.parseInt(insightRow.reach || '0', 10) || 0,
      },
    };
  } catch (err) {
    console.error('Meta Ads snapshot failed:', err?.message || err);
    return { ok: false, reason: 'exception' };
  }
}

export async function updateAdSetDailyBudget(dollars, options = {}) {
  try {
    const { env = process.env, fetchImpl = globalThis.fetch } = options;
    const cents = dollarsToBudgetCents(dollars);
    if (cents === null) {
      return { ok: false, reason: 'budget-out-of-range' };
    }

    const config = getMetaAdsConfig(env);
    const result = await graphRequest(config.adSetId, {
      method: 'POST',
      body: { daily_budget: String(cents) },
      env,
      fetchImpl,
    });
    if (!result.ok) return result;
    return { ok: true, dailyBudgetDollars: Number(dollars) };
  } catch (err) {
    console.error('Meta Ads budget update failed:', err?.message || err);
    return { ok: false, reason: 'exception' };
  }
}

export async function updateAdSetStatus(status, options = {}) {
  try {
    if (!ALLOWED_AD_SET_STATUSES.has(status)) {
      return { ok: false, reason: 'invalid-status' };
    }

    const { env = process.env, fetchImpl = globalThis.fetch } = options;
    const config = getMetaAdsConfig(env);
    const result = await graphRequest(config.adSetId, {
      method: 'POST',
      body: { status },
      env,
      fetchImpl,
    });
    if (!result.ok) return result;
    return { ok: true, status };
  } catch (err) {
    console.error('Meta Ads status update failed:', err?.message || err);
    return { ok: false, reason: 'exception' };
  }
}
