import { BrevoMailer } from './brevo.mailer';
import { orderPaidMail, productStatusMail, render, withdrawalStatusMail } from './templates';

describe('mail templates', () => {
  it('lists items, coupon and total of a paid order in both bodies', () => {
    const mail = render(
      orderPaidMail(
        'Ana Souza',
        {
          orderNumber: 'ORD-1',
          currency: 'BRL',
          totalCents: 9474,
          discountCents: 1053,
          couponCode: 'SAVE10',
          items: [
            {
              productTitle: 'UI Kit',
              priceCents: 10527,
              licenseType: 'EXTENDED',
              purchaseCode: 'A1B2-C3D4-E5F6-7890',
            },
          ],
        },
        'https://site.test/library',
      ),
      'DigiMarket',
    );
    expect(mail.subject).toBe('Pedido ORD-1 confirmado');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('Olá, Ana!');
      expect(body).toContain('Licença estendida');
      expect(body).toContain('A1B2-C3D4-E5F6-7890');
      expect(body).toContain('Cupom SAVE10');
      expect(body).toMatch(/R\$\s105,27/);
      expect(body).toMatch(/R\$\s94,74/);
      expect(body).toContain('https://site.test/library');
    }
  });

  it('escapes user-written text in the HTML body', () => {
    const mail = render(
      productStatusMail(
        '<b>Seller</b>',
        { title: 'Pack <script>', status: 'REJECTED', reason: 'Missing "preview" & files' },
        'https://site.test/vendor/products/p1',
      ),
      'DigiMarket',
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Pack &lt;script&gt;');
    expect(mail.html).toContain('Missing &quot;preview&quot; &amp; files');
    expect(mail.text).toContain('Motivo: Missing "preview" & files');
  });

  it('shows the payment reference of a paid withdrawal', () => {
    const mail = render(
      withdrawalStatusMail(
        'Creative Studio',
        { status: 'PAID', amountCents: 26080, reason: null, paymentReference: 'E123PIX' },
        'https://site.test/vendor/finance',
      ),
      'DigiMarket',
    );
    expect(mail.subject).toMatch(/^Saque de R\$\s260,80 pago$/);
    expect(mail.text).toContain('Referência do pagamento: E123PIX');
  });
});

describe('BrevoMailer', () => {
  const mailer = new BrevoMailer({
    apiKey: 'test-key',
    fromEmail: 'no-reply@site.test',
    fromName: 'DigiMarket',
  });
  const message = {
    to: { email: 'ana@example.com', name: 'Ana' },
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
    tag: 'order-paid',
  };
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  beforeAll(() => (global.fetch = fetchMock as never));
  afterAll(() => (global.fetch = realFetch));
  beforeEach(() => fetchMock.mockReset());

  it('posts the message to the transactional endpoint with the API key', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messageId: '<1@brevo>' }), { status: 201 }),
    );
    await mailer.send(message);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'no-reply@site.test', name: 'DigiMarket' },
      to: [{ email: 'ana@example.com', name: 'Ana' }],
      subject: 'Hello',
      htmlContent: '<p>Hello</p>',
      textContent: 'Hello',
      tags: ['order-paid'],
    });
  });

  it('rejects with the provider reason when the message is refused', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), {
        status: 401,
      }),
    );
    await expect(mailer.send(message)).rejects.toThrow(
      'Brevo refused the message (HTTP 401, unauthorized): Key not found',
    );
  });
});
