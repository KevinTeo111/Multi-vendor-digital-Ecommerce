import { operatorName, type LegalContext, type LegalDocument } from './types';

const UPDATED = '2026-10-06';

const holdText = (days: number) =>
  days === 0
    ? 'fica disponível para saque assim que o pagamento é confirmado'
    : `fica disponível para saque ${days} dia(s) após a confirmação do pagamento`;

export function terms(ctx: LegalContext): LegalDocument {
  const site = ctx.siteName;
  const operator = operatorName(ctx);
  const contact = ctx.contactEmail.trim();
  return {
    title: 'Termos de Uso',
    updated: UPDATED,
    intro: [
      `Estes Termos de Uso regulam o acesso e a utilização do ${site}, um marketplace de produtos digitais operado por ${operator} (“Plataforma”, “nós”). Ao criar uma conta, comprar ou vender na Plataforma, você concorda com estes Termos e com a nossa Política de Privacidade.`,
      'Se você não concorda com alguma condição, não utilize a Plataforma.',
    ],
    sections: [
      {
        heading: 'Definições',
        bullets: [
          'Comprador: pessoa que adquire produtos digitais na Plataforma.',
          'Vendedor: pessoa física ou jurídica que abre uma loja na Plataforma e oferece produtos digitais de sua autoria ou sobre os quais detém os direitos necessários.',
          'Produto digital: arquivo ou conjunto de arquivos entregues por download, como software, templates, cursos, e-books, áudio e vídeo.',
          'Licença: autorização de uso de um produto digital concedida pelo Vendedor ao Comprador, nos termos da seção “Licenças”.',
          'Código de compra: identificador único de cada item comprado, usado para comprovar a licença junto ao Vendedor.',
        ],
      },
      {
        heading: 'Papel da Plataforma',
        paragraphs: [
          `O ${site} é um intermediário: disponibiliza a infraestrutura para que Vendedores ofereçam produtos digitais e Compradores os adquiram. Os produtos são criados, descritos e fornecidos pelos Vendedores, que são os únicos responsáveis pelo conteúdo, pela qualidade, pela veracidade das descrições e pelos direitos sobre o que publicam.`,
          'Todo produto passa por uma revisão da nossa equipe antes de ser publicado. Essa revisão verifica o cumprimento destes Termos, mas não garante a adequação do produto a uma finalidade específica.',
          'Os pagamentos são processados pelo Mercado Pago. A Plataforma recebe o valor da venda, retém a comissão devida e repassa o restante ao Vendedor conforme a seção “Saldo e saques”.',
        ],
      },
      {
        heading: 'Cadastro e conta',
        bullets: [
          'É necessário ter 18 anos completos, ou ser representado por responsável legal, para criar uma conta.',
          'Você deve fornecer dados verdadeiros e mantê-los atualizados. A conta é pessoal e intransferível.',
          'Você é responsável pela confidencialidade da sua senha e por toda atividade realizada na sua conta. Em caso de uso não autorizado, avise-nos imediatamente.',
          'Podemos recusar, suspender ou encerrar contas que violem estes Termos ou a lei.',
        ],
      },
      {
        heading: 'Compras, preços e pagamento',
        bullets: [
          'Os preços são exibidos em reais (BRL) e já incluem as taxas de processamento do pagamento. O valor exibido no carrinho é o valor cobrado, salvo aplicação de cupom de desconto.',
          'Cupons podem ter condições como valor mínimo do pedido, período de validade, número de usos e restrição a determinados produtos ou lojas. Um cupom inválido ou expirado não é aplicado.',
          'O pagamento é feito pelos meios oferecidos pelo Mercado Pago (como Pix, cartão e boleto). O pedido só é confirmado após a aprovação do pagamento. Pedidos com pagamento recusado ou não concluído no prazo são cancelados.',
          'Os dados do seu cartão são informados diretamente ao Mercado Pago e não são armazenados pela Plataforma.',
        ],
      },
      {
        heading: 'Entrega e downloads',
        paragraphs: [
          'Após a confirmação do pagamento, os arquivos ficam disponíveis imediatamente em “Meus downloads”, na sua conta, junto com o código de compra de cada item. Os links de download são pessoais, temporários e vinculados à sua compra; os downloads são registrados.',
          'O Vendedor pode publicar novas versões de um produto. O acesso a atualizações é uma cortesia do Vendedor e pode variar de produto para produto.',
        ],
      },
      {
        heading: 'Licenças',
        paragraphs: [
          'Ao comprar um produto, você recebe uma licença de uso concedida pelo Vendedor, não a propriedade do produto. Salvo indicação diferente na página do produto, aplicam-se as condições abaixo.',
        ],
        bullets: [
          'Licença Regular: uso em um único projeto final, seu ou de um cliente, inclusive comercial, sem cobrança dos usuários finais pelo acesso ao produto em si.',
          'Licença Estendida: inclui tudo da Licença Regular e, adicionalmente, permite usar o produto em um projeto final cujo acesso seja cobrado dos usuários finais, ou em uma quantidade maior de projetos, conforme descrito pelo Vendedor.',
          'Em nenhuma licença é permitido revender, redistribuir, sublicenciar ou disponibilizar o produto, no todo ou em parte, de forma que terceiros possam extraí-lo e usá-lo separadamente do seu projeto.',
          'O código de compra comprova a sua licença. Vendedores podem verificá-lo na Plataforma antes de prestar suporte. Um código de compra de um pedido reembolsado deixa de ser válido.',
        ],
      },
      {
        heading: 'Reembolsos e estornos',
        bullets: [
          'Por se tratar de conteúdo digital de entrega imediata, pedimos que leia a descrição, os requisitos e as avaliações antes de comprar.',
          'Você pode solicitar reembolso em até 7 (sete) dias corridos após a compra, por meio do nosso contato, informando o número do pedido. O reembolso é devido quando o produto apresenta defeito que o Vendedor não corrige em prazo razoável, não corresponde à descrição, ou no exercício do direito de arrependimento previsto no Código de Defesa do Consumidor.',
          'O reembolso é sempre integral, feito pelo mesmo meio de pagamento usado na compra. O prazo para o valor aparecer depende do meio de pagamento e da instituição financeira.',
          'Com o reembolso, a licença é revogada: o acesso aos arquivos e o código de compra são encerrados e qualquer avaliação do item é removida.',
          'Pedidos de reembolso que configurem abuso, como compras repetidas seguidas de reembolso após o download, podem ser recusados.',
          'Contestações feitas diretamente junto à administradora do cartão (chargeback) seguem o procedimento do Mercado Pago. Enquanto a disputa estiver aberta, a Plataforma pode suspender o acesso ao produto.',
        ],
      },
      {
        heading: 'Vendedores: loja, planos e comissão',
        bullets: [
          'Para vender é preciso abrir uma loja e manter uma assinatura ativa de um dos planos oferecidos. Cada plano define a comissão da Plataforma, o número máximo de produtos publicados e o número de pedidos de saque por semana.',
          'As assinaturas pagas são renovadas automaticamente pelo Mercado Pago até o cancelamento. O cancelamento vale ao fim do período já pago. Se a assinatura expirar ou o pagamento falhar, os produtos da loja saem do ar até a regularização.',
          'O Vendedor define o preço base de cada produto e, opcionalmente, o preço da Licença Estendida. O preço exibido ao Comprador inclui as taxas de processamento, de modo que o Vendedor recebe o seu preço base menos a comissão do plano.',
          'A comissão e a taxa aplicadas a cada venda são registradas no momento da compra e não mudam com alterações posteriores de plano.',
          'Vendedores podem criar cupons de desconto para seus próprios produtos. O desconto de um cupom criado pelo Vendedor é deduzido do valor que ele recebe pela venda.',
        ],
      },
      {
        heading: 'Saldo e saques',
        bullets: [
          `O valor líquido de cada venda é creditado no saldo do Vendedor e ${holdText(ctx.pendingHoldDays)}.`,
          'O saque pode ser solicitado quando o saldo disponível atinge o valor mínimo informado no painel, dentro do limite semanal do plano, e exige dados de pagamento cadastrados (chave Pix ou conta bancária). O valor é pago por transferência pela nossa equipe e a referência do pagamento fica registrada na conta do Vendedor.',
          'Reembolsos e estornos de vendas já creditadas são debitados do saldo, que pode ficar negativo. Novos saques só são liberados quando o saldo volta a ser positivo.',
          'O Vendedor é o único responsável pelos tributos incidentes sobre as suas vendas e pela emissão dos documentos fiscais exigidos por lei.',
        ],
      },
      {
        heading: 'Conteúdo permitido e propriedade intelectual',
        bullets: [
          'O Vendedor declara que é o autor do produto ou que detém todas as licenças necessárias para comercializá-lo, incluindo fontes, imagens, trechos de código e demais componentes de terceiros.',
          'É proibido publicar conteúdo que infrinja direitos de terceiros, contenha malware, seja ilegal, enganoso, discriminatório, pornográfico ou que promova violência.',
          'Titulares de direitos que identifiquem uma violação podem nos notificar pelo contato indicado ao final destes Termos, com a identificação da obra e do produto. Podemos retirar o produto do ar enquanto apuramos a notificação.',
          `A marca, o nome, o layout e o software do ${site} pertencem a ${operator} e não podem ser copiados ou usados sem autorização.`,
        ],
      },
      {
        heading: 'Avaliações',
        bullets: [
          'Somente quem comprou e pagou por um produto pode avaliá-lo. A avaliação deve refletir a experiência real com o produto e pode ser editada pelo autor.',
          'O Vendedor pode responder publicamente a cada avaliação.',
          'Podemos ocultar avaliações ofensivas, falsas, que contenham dados pessoais ou que não tratem do produto. Avaliações de pedidos reembolsados são removidas.',
        ],
      },
      {
        heading: 'Condutas proibidas',
        bullets: [
          'Compartilhar credenciais, links de download ou arquivos adquiridos com terceiros.',
          'Contornar as medidas de proteção dos downloads ou tentar acessar compras de outros usuários.',
          'Usar a Plataforma para lavagem de dinheiro, fraude de pagamento, manipulação de avaliações ou qualquer atividade ilegal.',
          'Interferir no funcionamento da Plataforma, inclusive por acesso automatizado abusivo.',
        ],
      },
      {
        heading: 'Suspensão e encerramento',
        paragraphs: [
          'Podemos suspender ou encerrar contas, lojas e produtos que violem estes Termos, com ou sem aviso prévio conforme a gravidade, e reter valores relacionados a vendas sob investigação até a conclusão da apuração. Você pode encerrar a sua conta a qualquer momento pelo nosso contato; compras já realizadas continuam acessíveis pelo prazo da licença, salvo violação destes Termos.',
        ],
      },
      {
        heading: 'Garantias e responsabilidade',
        paragraphs: [
          'A Plataforma é fornecida “como está”. Trabalhamos para mantê-la disponível e segura, mas não garantimos funcionamento ininterrupto ou livre de erros. Não respondemos por produtos digitais criados pelos Vendedores, por danos indiretos ou por lucros cessantes, respeitados os direitos que a legislação de defesa do consumidor assegura e que não podem ser afastados.',
        ],
      },
      {
        heading: 'Alterações destes Termos',
        paragraphs: [
          'Podemos alterar estes Termos para refletir mudanças na Plataforma ou na legislação. A versão vigente fica sempre publicada nesta página, com a data da última atualização. Mudanças relevantes serão comunicadas por e-mail ou aviso na Plataforma. O uso continuado após a alteração significa concordância com a nova versão.',
        ],
      },
      {
        heading: 'Lei aplicável e foro',
        paragraphs: [
          'Estes Termos são regidos pelas leis da República Federativa do Brasil. Para Compradores consumidores, fica eleito o foro do seu domicílio, conforme o Código de Defesa do Consumidor. Nos demais casos, fica eleito o foro da comarca da sede da operadora da Plataforma.',
        ],
      },
      {
        heading: 'Contato',
        paragraphs: [
          contact
            ? `Dúvidas sobre estes Termos podem ser enviadas para ${contact}.`
            : 'Dúvidas sobre estes Termos podem ser enviadas pelos canais indicados na página de Contato.',
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
    title: 'Política de Privacidade',
    updated: UPDATED,
    intro: [
      `Esta Política explica quais dados pessoais o ${site} coleta, por que os coleta, com quem os compartilha e quais são os seus direitos, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018, “LGPD”).`,
      `O controlador dos dados é ${operator}${ctx.cnpj.trim() ? `, CNPJ ${ctx.cnpj.trim()}` : ''}${ctx.address.trim() ? `, com sede em ${ctx.address.trim()}` : ''}.`,
    ],
    sections: [
      {
        heading: 'Dados que coletamos',
        bullets: [
          'Cadastro: nome, e-mail e senha (armazenada apenas de forma criptografada). Vendedores informam também o nome da loja, uma descrição e os dados para recebimento (chave Pix ou dados bancários).',
          'Compras: itens comprados, licença escolhida, valores, cupons usados, meio de pagamento e identificadores da transação fornecidos pelo Mercado Pago. Não recebemos nem armazenamos o número completo do cartão.',
          'Uso da Plataforma: registros de acesso (endereço IP, data e hora, navegador), downloads realizados, avaliações publicadas e ações feitas no painel.',
          'Comunicação: mensagens que você nos envia pelos canais de contato.',
        ],
      },
      {
        heading: 'Para que usamos os dados e com que base legal',
        bullets: [
          'Executar o contrato com você: criar e manter a conta, processar compras e assinaturas, entregar downloads, emitir códigos de compra, pagar saques aos Vendedores e prestar suporte (art. 7º, V, LGPD).',
          'Cumprir obrigações legais e regulatórias, como guarda de registros de acesso e de transações (art. 7º, II).',
          'Prevenir fraudes, garantir a segurança da Plataforma e proteger direitos de usuários e titulares de obras (art. 7º, IX, legítimo interesse, e art. 7º, VI).',
          'Enviar e-mails transacionais, como confirmação de pedido, redefinição de senha e avisos sobre produtos, saques e avaliações. Esses e-mails fazem parte do serviço e não são publicidade.',
          'Não vendemos dados pessoais nem enviamos publicidade de terceiros.',
        ],
      },
      {
        heading: 'Compartilhamento',
        bullets: [
          'Mercado Pago: processamento de pagamentos, assinaturas e reembolsos. O Mercado Pago trata seus dados conforme a própria política de privacidade.',
          'Brevo: envio dos e-mails transacionais.',
          'Provedores de infraestrutura em nuvem (hospedagem da aplicação, banco de dados e armazenamento de arquivos), que atuam como operadores sob nossas instruções.',
          'Vendedores: ao comprar, o nome e o e-mail do Comprador são exibidos ao Vendedor do produto, para suporte, verificação da licença e cumprimento de obrigações fiscais. O primeiro nome do autor aparece publicamente nas avaliações.',
          'Autoridades públicas, quando exigido por lei ou ordem judicial.',
        ],
      },
      {
        heading: 'Transferência internacional',
        paragraphs: [
          'Parte dos nossos provedores de infraestrutura e de e-mail mantém servidores fora do Brasil, especialmente nos Estados Unidos e na União Europeia. Nesses casos, a transferência é feita com base em cláusulas contratuais e nas demais garantias previstas no art. 33 da LGPD.',
        ],
      },
      {
        heading: 'Cookies e armazenamento local',
        paragraphs: [
          'Usamos apenas o estritamente necessário para o funcionamento da Plataforma: um cookie que guarda o idioma escolhido e o armazenamento local do navegador para manter a sua sessão autenticada. Não usamos cookies de publicidade nem de rastreamento entre sites. Você pode apagar esses dados nas configurações do navegador; será necessário entrar novamente.',
        ],
      },
      {
        heading: 'Retenção',
        bullets: [
          'Dados da conta: enquanto a conta existir. Após o encerramento, são excluídos ou anonimizados, exceto o que precisamos guardar por obrigação legal.',
          'Registros de compras, pagamentos, saques e ajustes de saldo: pelos prazos exigidos pela legislação fiscal e de defesa do consumidor, por no mínimo 5 anos.',
          'Registros de acesso: por no mínimo 6 meses, conforme o Marco Civil da Internet.',
          'Logs de auditoria de ações administrativas: enquanto forem necessários para segurança e prestação de contas.',
        ],
      },
      {
        heading: 'Segurança',
        paragraphs: [
          'Adotamos medidas técnicas e organizacionais para proteger os dados, como criptografia em trânsito (HTTPS), senhas armazenadas com hash, links de download temporários e assinados, controle de acesso por perfil, limites de requisições e registro de ações administrativas. Nenhum sistema é totalmente seguro; em caso de incidente que possa causar risco relevante a você, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados conforme a lei.',
        ],
      },
      {
        heading: 'Seus direitos',
        paragraphs: ['Nos termos do art. 18 da LGPD, você pode solicitar a qualquer momento:'],
        bullets: [
          'confirmação da existência de tratamento e acesso aos seus dados;',
          'correção de dados incompletos, inexatos ou desatualizados;',
          'anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;',
          'portabilidade dos dados a outro fornecedor;',
          'informação sobre com quem compartilhamos os seus dados;',
          'eliminação dos dados tratados com base no seu consentimento e revogação do consentimento;',
          'oposição a tratamento realizado em desacordo com a lei.',
        ],
        after: [
          `Para exercer esses direitos, escreva para ${contact || 'o canal indicado na página de Contato'}. Responderemos no prazo legal. Você pode editar nome e senha diretamente na sua conta. Você também pode apresentar reclamação à ANPD.`,
        ],
      },
      {
        heading: 'Menores de idade',
        paragraphs: [
          'A Plataforma destina-se a maiores de 18 anos. Não coletamos intencionalmente dados de crianças e adolescentes; se tomarmos conhecimento de um cadastro nessas condições sem autorização do responsável, ele será excluído.',
        ],
      },
      {
        heading: 'Alterações desta Política',
        paragraphs: [
          'Podemos atualizar esta Política. A versão vigente fica publicada nesta página com a data da última atualização, e mudanças relevantes serão comunicadas por e-mail ou aviso na Plataforma.',
        ],
      },
      {
        heading: 'Encarregado e contato',
        paragraphs: [
          contact
            ? `O encarregado pelo tratamento de dados pessoais (DPO) pode ser contatado pelo e-mail ${contact}.`
            : 'O contato do encarregado pelo tratamento de dados pessoais (DPO) está disponível na página de Contato.',
        ],
      },
    ],
  };
}

export function contact(ctx: LegalContext): LegalDocument {
  const email = ctx.contactEmail.trim();
  return {
    title: 'Contato',
    updated: UPDATED,
    intro: [
      email
        ? `Fale com a equipe do ${ctx.siteName} pelo e-mail ${email}. Respondemos em dias úteis, o mais rápido possível.`
        : `O canal de atendimento do ${ctx.siteName} está sendo configurado. Em breve o e-mail de contato aparecerá nesta página.`,
      'Para agilizar, informe o e-mail da sua conta e, quando for o caso, o número do pedido (começa com ORD-).',
    ],
    sections: [
      {
        heading: 'Compradores',
        bullets: [
          'Downloads: seus arquivos e códigos de compra ficam em “Meus downloads”, na sua conta, logo após a confirmação do pagamento.',
          'Pagamento pendente: Pix e boleto podem levar alguns minutos para serem confirmados. Se o pedido continuar pendente após esse tempo, envie o número do pedido.',
          'Reembolso: pode ser solicitado em até 7 dias após a compra, conforme os Termos de Uso. Envie o número do pedido e o motivo.',
          'Suporte do produto: dúvidas sobre o uso de um produto são atendidas pelo Vendedor, que pode pedir o seu código de compra para confirmar a licença.',
        ],
      },
      {
        heading: 'Vendedores',
        bullets: [
          'Revisão de produtos: você recebe um e-mail quando um produto é aprovado ou recusado, com o motivo em caso de recusa.',
          'Saques: o andamento e a referência de pagamento ficam em Financeiro, no seu painel. Para dúvidas sobre um saque, informe a data e o valor.',
          'Verificação de licença: use “Verificar código de compra” no painel antes de prestar suporte a um cliente.',
        ],
      },
      {
        heading: 'Privacidade e direitos autorais',
        bullets: [
          'Pedidos relacionados aos seus dados pessoais (acesso, correção, exclusão) são atendidos pelo mesmo e-mail, conforme a Política de Privacidade.',
          'Para denunciar um produto que viole direitos autorais, envie o link do produto, a identificação da obra original e a comprovação de titularidade.',
        ],
      },
    ],
  };
}
