import { evaluateWithdrawal, WithdrawalRuleInput } from './withdrawal-rules';

const base: WithdrawalRuleInput = {
  vendorActive: true,
  hasEntitlingSubscription: true,
  hasPayoutDetails: true,
  availableCents: 50_000,
  minWithdrawalCents: 10_000,
  requestsInLastWeek: 0,
  withdrawalsPerWeek: 1,
  hasOpenWithdrawal: false,
};

describe('evaluateWithdrawal', () => {
  it('allows a full-balance withdrawal when every rule passes', () => {
    expect(evaluateWithdrawal(base)).toEqual({ ok: true, amountCents: 50_000 });
  });

  it('allows a partial amount at or above the minimum', () => {
    expect(evaluateWithdrawal({ ...base, requestedCents: 10_000 })).toEqual({ ok: true, amountCents: 10_000 });
    expect(evaluateWithdrawal({ ...base, requestedCents: 25_000 })).toEqual({ ok: true, amountCents: 25_000 });
  });

  it('enforces one request per week by default', () => {
    const r = evaluateWithdrawal({ ...base, requestsInLastWeek: 1 });
    expect(r).toMatchObject({ ok: false, code: 'WEEKLY_LIMIT' });
  });

  it('respects a plan that allows more requests per week', () => {
    expect(evaluateWithdrawal({ ...base, requestsInLastWeek: 1, withdrawalsPerWeek: 2 })).toMatchObject({ ok: true });
    expect(evaluateWithdrawal({ ...base, requestsInLastWeek: 2, withdrawalsPerWeek: 2 })).toMatchObject({
      ok: false,
      code: 'WEEKLY_LIMIT',
    });
  });

  it('blocks when the available balance is below the configured minimum', () => {
    expect(evaluateWithdrawal({ ...base, availableCents: 9_999 })).toMatchObject({ ok: false, code: 'BELOW_MINIMUM' });
    expect(evaluateWithdrawal({ ...base, availableCents: 10_000 })).toEqual({ ok: true, amountCents: 10_000 });
  });

  it('does not cap the amount above the minimum', () => {
    expect(evaluateWithdrawal({ ...base, availableCents: 123_456_789 })).toEqual({ ok: true, amountCents: 123_456_789 });
  });

  it('rejects amounts above the available balance or non-positive', () => {
    expect(evaluateWithdrawal({ ...base, requestedCents: 50_001 })).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(evaluateWithdrawal({ ...base, requestedCents: 0 })).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(evaluateWithdrawal({ ...base, requestedCents: 10.5 })).toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('blocks while another withdrawal is still open', () => {
    expect(evaluateWithdrawal({ ...base, hasOpenWithdrawal: true })).toMatchObject({ code: 'OPEN_WITHDRAWAL' });
  });

  it('requires an active vendor, a subscription and payout details, in that order', () => {
    expect(evaluateWithdrawal({ ...base, vendorActive: false })).toMatchObject({ code: 'VENDOR_INACTIVE' });
    expect(evaluateWithdrawal({ ...base, hasEntitlingSubscription: false })).toMatchObject({ code: 'NO_SUBSCRIPTION' });
    expect(evaluateWithdrawal({ ...base, hasPayoutDetails: false })).toMatchObject({ code: 'NO_PAYOUT_DETAILS' });
  });
});
