/**
 * Pure withdrawal eligibility rules. No I/O so they can be unit-tested exhaustively.
 * The service gathers the inputs and calls `evaluateWithdrawal`.
 */

export interface WithdrawalRuleInput {
  vendorActive: boolean;
  hasEntitlingSubscription: boolean;
  hasPayoutDetails: boolean;
  availableCents: number;
  minWithdrawalCents: number;
  /** Withdrawals requested in the last 7 days that were not rejected/failed. */
  requestsInLastWeek: number;
  withdrawalsPerWeek: number;
  hasOpenWithdrawal: boolean;
  /** Amount asked by the vendor; undefined means "everything available". */
  requestedCents?: number;
}

export type WithdrawalRuleResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: string; code: WithdrawalDenialCode };

export type WithdrawalDenialCode =
  | 'VENDOR_INACTIVE'
  | 'NO_SUBSCRIPTION'
  | 'NO_PAYOUT_DETAILS'
  | 'OPEN_WITHDRAWAL'
  | 'WEEKLY_LIMIT'
  | 'BELOW_MINIMUM'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_AMOUNT';

export function evaluateWithdrawal(input: WithdrawalRuleInput): WithdrawalRuleResult {
  if (!input.vendorActive) {
    return { ok: false, code: 'VENDOR_INACTIVE', reason: 'Vendor account is not active' };
  }
  if (!input.hasEntitlingSubscription) {
    return { ok: false, code: 'NO_SUBSCRIPTION', reason: 'An active plan subscription is required to withdraw' };
  }
  if (!input.hasPayoutDetails) {
    return { ok: false, code: 'NO_PAYOUT_DETAILS', reason: 'Add your payout details before requesting a withdrawal' };
  }
  if (input.hasOpenWithdrawal) {
    return { ok: false, code: 'OPEN_WITHDRAWAL', reason: 'You already have a withdrawal awaiting processing' };
  }
  if (input.requestsInLastWeek >= input.withdrawalsPerWeek) {
    return {
      ok: false,
      code: 'WEEKLY_LIMIT',
      reason: `Your plan allows ${input.withdrawalsPerWeek} withdrawal request(s) per week`,
    };
  }

  const amount = input.requestedCents ?? input.availableCents;
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', reason: 'Withdrawal amount must be a positive whole number of cents' };
  }
  if (amount > input.availableCents) {
    return { ok: false, code: 'INSUFFICIENT_BALANCE', reason: 'Requested amount exceeds your available balance' };
  }
  if (amount < input.minWithdrawalCents) {
    return {
      ok: false,
      code: 'BELOW_MINIMUM',
      reason: `Minimum withdrawal is ${input.minWithdrawalCents} cents`,
    };
  }
  return { ok: true, amountCents: amount };
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
