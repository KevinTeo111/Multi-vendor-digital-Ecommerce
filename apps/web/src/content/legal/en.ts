import { operatorName, type LegalContext, type LegalDocument } from './types';

const UPDATED = '2026-10-06';

const holdText = (days: number) =>
  days === 0
    ? 'becomes available for withdrawal as soon as the payment is confirmed'
    : `becomes available for withdrawal ${days} day(s) after the payment is confirmed`;

export function terms(ctx: LegalContext): LegalDocument {
  const site = ctx.siteName;
  const operator = operatorName(ctx);
  const contact = ctx.contactEmail.trim();
  return {
    title: 'Terms of Service',
    updated: UPDATED,
    intro: [
      `These Terms govern access to and use of ${site}, a marketplace for digital products operated by ${operator} (the “Platform”, “we”). By creating an account, buying or selling on the Platform you agree to these Terms and to our Privacy Policy.`,
      'If you do not agree with any condition, do not use the Platform.',
    ],
    sections: [
      {
        heading: 'Definitions',
        bullets: [
          'Buyer: a person who purchases digital products on the Platform.',
          'Seller: an individual or company that opens a store on the Platform and offers digital products they created or hold the necessary rights to.',
          'Digital product: a file or set of files delivered by download, such as software, templates, courses, e-books, audio and video.',
          'Licence: the permission to use a digital product granted by the Seller to the Buyer, under the “Licences” section.',
          'Purchase code: the unique identifier of each purchased item, used to prove the licence to the Seller.',
        ],
      },
      {
        heading: 'Role of the Platform',
        paragraphs: [
          `${site} is an intermediary: it provides the infrastructure for Sellers to offer digital products and for Buyers to purchase them. Products are created, described and supplied by Sellers, who are solely responsible for their content, quality, the accuracy of descriptions and the rights to what they publish.`,
          'Every product is reviewed by our team before publication. The review checks compliance with these Terms; it does not guarantee that a product is fit for a particular purpose.',
          'Payments are processed by Mercado Pago. The Platform receives the sale amount, retains its commission and passes the remainder to the Seller as described under “Balance and withdrawals”.',
        ],
      },
      {
        heading: 'Registration and account',
        bullets: [
          'You must be at least 18 years old, or represented by a legal guardian, to create an account.',
          'You must provide accurate information and keep it up to date. The account is personal and non-transferable.',
          'You are responsible for keeping your password confidential and for all activity on your account. Tell us immediately about any unauthorised use.',
          'We may refuse, suspend or close accounts that breach these Terms or the law.',
        ],
      },
      {
        heading: 'Purchases, prices and payment',
        bullets: [
          'Prices are shown in Brazilian reais (BRL) and already include payment-processing fees. The amount shown in the cart is the amount charged, unless a discount coupon is applied.',
          'Coupons may carry conditions such as a minimum order value, a validity period, a number of uses and restriction to certain products or stores. An invalid or expired coupon is not applied.',
          'Payment is made through the methods offered by Mercado Pago (such as Pix, card and boleto). An order is confirmed only after the payment is approved. Orders whose payment is refused or not completed in time are cancelled.',
          'Card details are entered directly with Mercado Pago and are not stored by the Platform.',
        ],
      },
      {
        heading: 'Delivery and downloads',
        paragraphs: [
          'Once the payment is confirmed, the files become available immediately under “My downloads” in your account, together with the purchase code of each item. Download links are personal, temporary and tied to your purchase; downloads are logged.',
          'A Seller may publish new versions of a product. Access to updates is a courtesy of the Seller and may vary from product to product.',
        ],
      },
      {
        heading: 'Licences',
        paragraphs: [
          'When you buy a product you receive a licence to use it, granted by the Seller; you do not acquire ownership of the product. Unless the product page says otherwise, the following conditions apply.',
        ],
        bullets: [
          'Regular Licence: use in a single end project, your own or a client’s, including commercial use, provided end users are not charged for access to the product itself.',
          'Extended Licence: everything in the Regular Licence and, in addition, use in an end project where end users are charged for access, or in a larger number of projects, as described by the Seller.',
          'No licence allows reselling, redistributing, sub-licensing or making the product available, in whole or in part, in a way that lets third parties extract it and use it separately from your project.',
          'The purchase code proves your licence. Sellers may verify it on the Platform before providing support. A purchase code from a refunded order is no longer valid.',
        ],
      },
      {
        heading: 'Refunds and chargebacks',
        bullets: [
          'Because digital content is delivered immediately, please read the description, requirements and reviews before buying.',
          'You may request a refund within 7 (seven) calendar days of the purchase through our contact channel, quoting the order number. A refund is due when the product has a defect the Seller does not fix within a reasonable time, does not match its description, or under the right of withdrawal provided by the Brazilian Consumer Protection Code.',
          'Refunds are always for the full amount, to the payment method used for the purchase. How long the money takes to appear depends on the payment method and the financial institution.',
          'With a refund the licence is revoked: access to the files and the purchase code end, and any review of the item is removed.',
          'Refund requests that amount to abuse, such as repeated purchases refunded after download, may be refused.',
          'Disputes raised directly with the card issuer (chargebacks) follow Mercado Pago’s procedure. While a dispute is open the Platform may suspend access to the product.',
        ],
      },
      {
        heading: 'Sellers: store, plans and commission',
        bullets: [
          'To sell you must open a store and keep an active subscription to one of the plans offered. Each plan sets the Platform’s commission, the maximum number of published products and the number of withdrawal requests per week.',
          'Paid subscriptions renew automatically through Mercado Pago until cancelled. Cancellation takes effect at the end of the period already paid. If the subscription lapses or a payment fails, the store’s products go offline until it is regularised.',
          'The Seller sets the base price of each product and, optionally, the Extended Licence price. The price shown to Buyers includes processing fees, so the Seller receives the base price minus the plan’s commission.',
          'The commission and fee applied to each sale are recorded at the time of purchase and do not change with later plan changes.',
          'Sellers may create discount coupons for their own products. The discount of a Seller-created coupon is deducted from what the Seller receives for the sale.',
        ],
      },
      {
        heading: 'Balance and withdrawals',
        bullets: [
          `The net amount of each sale is credited to the Seller’s balance and ${holdText(ctx.pendingHoldDays)}.`,
          'A withdrawal can be requested once the available balance reaches the minimum shown in the dashboard, within the plan’s weekly limit, and requires payout details on file (Pix key or bank account). The amount is paid by transfer by our team and the payment reference is recorded in the Seller’s account.',
          'Refunds and chargebacks of sales already credited are debited from the balance, which may become negative. New withdrawals are released only once the balance is positive again.',
          'The Seller is solely responsible for the taxes on their sales and for issuing the tax documents required by law.',
        ],
      },
      {
        heading: 'Permitted content and intellectual property',
        bullets: [
          'The Seller declares that they are the author of the product or hold every licence needed to sell it, including fonts, images, code snippets and other third-party components.',
          'It is forbidden to publish content that infringes third-party rights, contains malware, or is illegal, misleading, discriminatory, pornographic or promotes violence.',
          'Rights holders who identify an infringement may notify us through the contact given at the end of these Terms, identifying the work and the product. We may take the product offline while we assess the notice.',
          `The ${site} brand, name, layout and software belong to ${operator} and may not be copied or used without permission.`,
        ],
      },
      {
        heading: 'Reviews',
        bullets: [
          'Only someone who bought and paid for a product can review it. A review must reflect genuine experience with the product and can be edited by its author.',
          'The Seller may reply publicly to each review.',
          'We may hide reviews that are offensive, false, contain personal data or are not about the product. Reviews of refunded orders are removed.',
        ],
      },
      {
        heading: 'Prohibited conduct',
        bullets: [
          'Sharing credentials, download links or purchased files with third parties.',
          'Circumventing download protection or attempting to access other users’ purchases.',
          'Using the Platform for money laundering, payment fraud, review manipulation or any illegal activity.',
          'Interfering with the operation of the Platform, including abusive automated access.',
        ],
      },
      {
        heading: 'Suspension and termination',
        paragraphs: [
          'We may suspend or close accounts, stores and products that breach these Terms, with or without prior notice depending on severity, and withhold amounts related to sales under investigation until it concludes. You may close your account at any time through our contact channel; purchases already made remain accessible for the term of the licence, unless these Terms were breached.',
        ],
      },
      {
        heading: 'Warranties and liability',
        paragraphs: [
          'The Platform is provided “as is”. We work to keep it available and secure but do not guarantee uninterrupted or error-free operation. We are not liable for digital products created by Sellers, for indirect damages or for loss of profits, without prejudice to the rights that consumer-protection law grants and that cannot be waived.',
        ],
      },
      {
        heading: 'Changes to these Terms',
        paragraphs: [
          'We may change these Terms to reflect changes in the Platform or in the law. The current version is always published on this page with the date of the last update. Material changes will be announced by e-mail or by a notice on the Platform. Continued use after a change means acceptance of the new version.',
        ],
      },
      {
        heading: 'Governing law and jurisdiction',
        paragraphs: [
          'These Terms are governed by the laws of the Federative Republic of Brazil. For consumer Buyers, the courts of the Buyer’s domicile have jurisdiction, as provided by the Consumer Protection Code. In all other cases, the courts of the district where the Platform operator has its registered office have jurisdiction.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          contact
            ? `Questions about these Terms can be sent to ${contact}.`
            : 'Questions about these Terms can be sent through the channels listed on the Contact page.',
          ...(ctx.cnpj.trim() || ctx.address.trim()
            ? [
                [operator, ctx.cnpj.trim() && `CNPJ ${ctx.cnpj.trim()}`, ctx.address.trim()]
                  .filter(Boolean)
                  .join(' · '),
              ]
            : []),
        ],
      },
    ],
  };
}

export function privacy(ctx: LegalContext): LegalDocument {
  const site = ctx.siteName;
  const operator = operatorName(ctx);
  const contact = ctx.contactEmail.trim();
  return {
    title: 'Privacy Policy',
    updated: UPDATED,
    intro: [
      `This Policy explains which personal data ${site} collects, why, with whom it is shared and what your rights are, in accordance with the Brazilian General Data Protection Law (Law 13.709/2018, “LGPD”).`,
      `The data controller is ${operator}${ctx.cnpj.trim() ? `, CNPJ ${ctx.cnpj.trim()}` : ''}${ctx.address.trim() ? `, with registered office at ${ctx.address.trim()}` : ''}.`,
    ],
    sections: [
      {
        heading: 'Data we collect',
        bullets: [
          'Registration: name, e-mail and password (stored only in hashed form). Sellers also provide a store name, a description and payout details (Pix key or bank account).',
          'Purchases: items bought, licence chosen, amounts, coupons used, payment method and transaction identifiers provided by Mercado Pago. We never receive or store the full card number.',
          'Use of the Platform: access logs (IP address, date and time, browser), downloads made, reviews published and actions taken in the dashboard.',
          'Communication: messages you send us through the contact channels.',
        ],
      },
      {
        heading: 'Why we use the data and on what legal basis',
        bullets: [
          'To perform our contract with you: create and maintain the account, process purchases and subscriptions, deliver downloads, issue purchase codes, pay withdrawals to Sellers and provide support (art. 7, V, LGPD).',
          'To comply with legal and regulatory obligations, such as keeping access and transaction records (art. 7, II).',
          'To prevent fraud, keep the Platform secure and protect the rights of users and rights holders (art. 7, IX, legitimate interest, and art. 7, VI).',
          'To send transactional e-mails such as order confirmations, password resets and notices about products, withdrawals and reviews. These e-mails are part of the service, not advertising.',
          'We do not sell personal data and do not send third-party advertising.',
        ],
      },
      {
        heading: 'Sharing',
        bullets: [
          'Mercado Pago: processing of payments, subscriptions and refunds. Mercado Pago handles your data under its own privacy policy.',
          'Brevo: delivery of transactional e-mails.',
          'Cloud infrastructure providers (application hosting, database and file storage), acting as processors under our instructions.',
          'Sellers: when you buy, the Buyer’s name and e-mail are shown to the product’s Seller for support, licence verification and tax obligations. The author’s first name appears publicly on reviews.',
          'Public authorities, when required by law or court order.',
        ],
      },
      {
        heading: 'International transfers',
        paragraphs: [
          'Some of our infrastructure and e-mail providers keep servers outside Brazil, notably in the United States and the European Union. In those cases the transfer relies on contractual clauses and the other safeguards provided in art. 33 of the LGPD.',
        ],
      },
      {
        heading: 'Cookies and local storage',
        paragraphs: [
          'We use only what is strictly necessary for the Platform to work: a cookie that stores the chosen language and the browser’s local storage to keep your session signed in. We use no advertising or cross-site tracking cookies. You can clear this data in your browser settings; you will need to sign in again.',
        ],
      },
      {
        heading: 'Retention',
        bullets: [
          'Account data: for as long as the account exists. After closure it is deleted or anonymised, except what we must keep by legal obligation.',
          'Records of purchases, payments, withdrawals and balance adjustments: for the periods required by tax and consumer law, at least 5 years.',
          'Access logs: at least 6 months, as required by the Brazilian Internet Civil Framework (Marco Civil).',
          'Audit logs of administrative actions: for as long as needed for security and accountability.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'We apply technical and organisational measures to protect data, such as encryption in transit (HTTPS), hashed passwords, temporary signed download links, role-based access control, request limits and logging of administrative actions. No system is entirely secure; in the event of an incident that may pose a relevant risk to you, we will notify the National Data Protection Authority (ANPD) and the affected data subjects as required by law.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: ['Under art. 18 of the LGPD you may at any time request:'],
        bullets: [
          'confirmation that your data is processed, and access to it;',
          'correction of incomplete, inaccurate or outdated data;',
          'anonymisation, blocking or deletion of unnecessary or excessive data;',
          'portability of your data to another provider;',
          'information about whom we share your data with;',
          'deletion of data processed on the basis of your consent, and withdrawal of consent;',
          'objection to processing carried out in breach of the law.',
        ],
        after: [
          `To exercise these rights, write to ${contact || 'the channel listed on the Contact page'}. We will answer within the legal deadline. You can edit your name and password directly in your account. You may also lodge a complaint with the ANPD.`,
        ],
      },
      {
        heading: 'Minors',
        paragraphs: [
          'The Platform is intended for people aged 18 or over. We do not knowingly collect data from children and adolescents; if we learn of such a registration made without a guardian’s authorisation, it will be deleted.',
        ],
      },
      {
        heading: 'Changes to this Policy',
        paragraphs: [
          'We may update this Policy. The current version is published on this page with the date of the last update, and material changes will be announced by e-mail or by a notice on the Platform.',
        ],
      },
      {
        heading: 'Data protection officer and contact',
        paragraphs: [
          contact
            ? `The data protection officer (DPO) can be reached at ${contact}.`
            : 'The data protection officer’s (DPO) contact is available on the Contact page.',
        ],
      },
    ],
  };
}

export function contact(ctx: LegalContext): LegalDocument {
  const email = ctx.contactEmail.trim();
  return {
    title: 'Contact',
    updated: UPDATED,
    intro: [
      email
        ? `Reach the ${ctx.siteName} team at ${email}. We answer on business days, as quickly as we can.`
        : `The ${ctx.siteName} support channel is being set up. The contact e-mail will appear on this page shortly.`,
      'To speed things up, include your account e-mail and, where relevant, the order number (it starts with ORD-).',
    ],
    sections: [
      {
        heading: 'Buyers',
        bullets: [
          'Downloads: your files and purchase codes are under “My downloads” in your account as soon as the payment is confirmed.',
          'Pending payment: Pix and boleto can take a few minutes to be confirmed. If the order is still pending after that, send us the order number.',
          'Refunds: can be requested within 7 days of the purchase, under the Terms of Service. Send the order number and the reason.',
          'Product support: questions about using a product are handled by the Seller, who may ask for your purchase code to confirm the licence.',
        ],
      },
      {
        heading: 'Sellers',
        bullets: [
          'Product review: you receive an e-mail when a product is approved or rejected, with the reason in case of rejection.',
          'Withdrawals: progress and the payment reference are under Finance in your dashboard. For questions about a withdrawal, include its date and amount.',
          'Licence verification: use “Verify a purchase code” in the dashboard before supporting a customer.',
        ],
      },
      {
        heading: 'Privacy and copyright',
        bullets: [
          'Requests about your personal data (access, correction, deletion) go to the same e-mail, under the Privacy Policy.',
          'To report a product that infringes copyright, send the product link, the identification of the original work and proof of ownership.',
        ],
      },
    ],
  };
}
