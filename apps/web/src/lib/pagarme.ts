/**
 * Client-side card tokenization for Pagar.me v5. Card data goes straight from the
 * browser to Pagar.me; our API only ever sees the resulting token.
 * Set NEXT_PUBLIC_PAGARME_PUBLIC_KEY (pk_test_... / pk_...) to enable it.
 */
export const PAGARME_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY ?? '';

export interface CardInput {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export async function tokenizeCard(card: CardInput): Promise<string> {
  if (!PAGARME_PUBLIC_KEY) throw new Error('Card payments are not configured');
  const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: card.number.replace(/\s/g, ''),
        holder_name: card.holderName,
        exp_month: Number(card.expMonth),
        exp_year: Number(card.expYear.length === 2 ? `20${card.expYear}` : card.expYear),
        cvv: card.cvv,
      },
    }),
  });
  const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok || !json?.id) throw new Error(json?.message ?? 'Card could not be validated');
  return json.id;
}
