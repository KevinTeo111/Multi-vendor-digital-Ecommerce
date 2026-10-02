/**
 * The text of every automatic e-mail, in Brazilian Portuguese (the marketplace's market).
 * Each template returns plain content; `render` turns it into the HTML and text bodies, so
 * escaping and layout live in one place.
 */

export interface MailContent {
  subject: string;
  name: string;
  lines: string[];
  /** Label / value rows (order items, amounts, reasons). */
  details?: [label: string, value: string][];
  action?: { label: string; url: string };
}

const money = (cents: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);

const dateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);

const licence = (type: 'REGULAR' | 'EXTENDED') =>
  type === 'EXTENDED' ? 'Licença estendida' : 'Licença regular';

export function passwordResetMail(name: string, resetUrl: string, expiresAt: Date): MailContent {
  return {
    subject: 'Redefinição de senha',
    name,
    lines: [
      'Recebemos um pedido para redefinir a senha da sua conta.',
      `O link vale até ${dateTime(expiresAt)} (horário de Brasília) e só pode ser usado uma vez.`,
      'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
    ],
    action: { label: 'Redefinir senha', url: resetUrl },
  };
}

export interface OrderMailData {
  orderNumber: string;
  currency: string;
  totalCents: number;
  discountCents: number;
  couponCode: string | null;
  items: {
    productTitle: string;
    priceCents: number;
    licenseType: 'REGULAR' | 'EXTENDED';
    purchaseCode: string | null;
  }[];
}

export function orderPaidMail(name: string, order: OrderMailData, libraryUrl: string): MailContent {
  const details: [string, string][] = order.items.map((i) => [
    `${i.productTitle} · ${licence(i.licenseType)}` +
      (i.purchaseCode ? ` · Código de compra: ${i.purchaseCode}` : ''),
    money(i.priceCents, order.currency),
  ]);
  if (order.discountCents > 0)
    details.push([
      order.couponCode ? `Cupom ${order.couponCode}` : 'Desconto',
      `− ${money(order.discountCents, order.currency)}`,
    ]);
  details.push(['Total pago', money(order.totalCents, order.currency)]);
  return {
    subject: `Pedido ${order.orderNumber} confirmado`,
    name,
    lines: ['Seu pagamento foi confirmado. Os arquivos já estão disponíveis para download.'],
    details,
    action: { label: 'Acessar meus downloads', url: libraryUrl },
  };
}

export function orderRefundedMail(
  name: string,
  order: OrderMailData,
  orderUrl: string,
): MailContent {
  return {
    subject: `Pedido ${order.orderNumber} reembolsado`,
    name,
    lines: [
      `O pedido ${order.orderNumber} foi reembolsado no valor de ${money(order.totalCents, order.currency)}.`,
      'O valor volta pelo mesmo meio de pagamento usado na compra; o prazo depende do meio de pagamento.',
      'O acesso aos arquivos e os códigos de compra deste pedido foram encerrados.',
    ],
    action: { label: 'Ver pedido', url: orderUrl },
  };
}

export type ProductMailStatus = 'APPROVED' | 'REJECTED' | 'BLOCKED';

export function productStatusMail(
  name: string,
  product: { title: string; status: ProductMailStatus; reason: string | null },
  url: string,
): MailContent {
  const reason: [string, string][] = product.reason ? [['Motivo', product.reason]] : [];
  switch (product.status) {
    case 'APPROVED':
      return {
        subject: `Produto aprovado: ${product.title}`,
        name,
        lines: [`Seu produto “${product.title}” foi aprovado e já está à venda no marketplace.`],
        action: { label: 'Ver produto', url },
      };
    case 'REJECTED':
      return {
        subject: `Produto não aprovado: ${product.title}`,
        name,
        lines: [
          `Seu produto “${product.title}” não foi aprovado na revisão.`,
          'Você pode corrigir o produto e enviá-lo para revisão novamente.',
        ],
        details: reason,
        action: { label: 'Editar produto', url },
      };
    case 'BLOCKED':
      return {
        subject: `Produto bloqueado: ${product.title}`,
        name,
        lines: [
          `Seu produto “${product.title}” foi bloqueado pela equipe e não está mais à venda.`,
        ],
        details: reason,
        action: { label: 'Ver produto no painel', url },
      };
  }
}

export type WithdrawalMailStatus = 'APPROVED' | 'PAID' | 'REJECTED' | 'FAILED';

export function withdrawalStatusMail(
  name: string,
  w: {
    status: WithdrawalMailStatus;
    amountCents: number;
    reason: string | null;
    paymentReference: string | null;
  },
  financeUrl: string,
): MailContent {
  const amount = money(w.amountCents);
  const base = { name, action: { label: 'Ver financeiro', url: financeUrl } };
  const reason: [string, string][] = w.reason ? [['Motivo', w.reason]] : [];
  switch (w.status) {
    case 'APPROVED':
      return {
        ...base,
        subject: `Saque de ${amount} aprovado`,
        lines: [`Seu saque de ${amount} foi aprovado e será pago em breve.`],
      };
    case 'PAID':
      return {
        ...base,
        subject: `Saque de ${amount} pago`,
        lines: [`Seu saque de ${amount} foi pago.`],
        details: w.paymentReference ? [['Referência do pagamento', w.paymentReference]] : [],
      };
    case 'REJECTED':
      return {
        ...base,
        subject: `Saque de ${amount} recusado`,
        lines: [`Seu saque de ${amount} foi recusado. O valor voltou para o seu saldo disponível.`],
        details: reason,
      };
    case 'FAILED':
      return {
        ...base,
        subject: `Falha no pagamento do saque de ${amount}`,
        lines: [
          `O pagamento do seu saque de ${amount} falhou. O valor voltou para o seu saldo disponível.`,
        ],
        details: reason,
      };
  }
}

// ---- Rendering --------------------------------------------------------------

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Builds the two bodies of a message. `brand` is the sender name shown in the header and footer. */
export function render(content: MailContent, brand: string) {
  const firstName = content.name.trim().split(/\s+/)[0] || content.name;
  const details = content.details ?? [];

  const text = [
    `Olá, ${firstName}!`,
    ...content.lines,
    ...(details.length ? [details.map(([label, value]) => `${label}: ${value}`).join('\n')] : []),
    ...(content.action ? [`${content.action.label}: ${content.action.url}`] : []),
    `${brand}\nEste é um e-mail automático, não responda.`,
  ].join('\n\n');

  const e = escapeHtml;
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;border-top:1px solid #e2e8f0;color:#475569">${e(label)}</td>` +
        `<td align="right" style="padding:8px 0 8px 16px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:600;white-space:nowrap">${e(value)}</td></tr>`,
    )
    .join('');
  const html =
    `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#334155">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">` +
    `<tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;font-size:18px;font-weight:700;color:#0f172a">${e(brand)}</td></tr>` +
    `<tr><td style="padding:24px 28px">` +
    `<p style="margin:0 0 12px;font-weight:700;color:#0f172a">Olá, ${e(firstName)}!</p>` +
    content.lines.map((line) => `<p style="margin:0 0 12px">${e(line)}</p>`).join('') +
    (rows
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;font-size:14px">${rows}</table>`
      : '') +
    (content.action
      ? `<p style="margin:20px 0 8px"><a href="${e(content.action.url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#2563eb;color:#ffffff;font-weight:700;text-decoration:none">${e(content.action.label)}</a></p>` +
        `<p style="margin:0;font-size:12px;color:#64748b;word-break:break-all">Se o botão não funcionar, copie este endereço: ${e(content.action.url)}</p>`
      : '') +
    `</td></tr>` +
    `<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${e(brand)} · Este é um e-mail automático, não responda.</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject: content.subject, html, text };
}
