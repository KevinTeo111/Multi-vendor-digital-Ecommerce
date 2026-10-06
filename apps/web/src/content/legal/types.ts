/** Facts about the operator that the legal texts are built from. Empty strings are omitted. */
export interface LegalContext {
  siteName: string;
  companyName: string;
  cnpj: string;
  address: string;
  contactEmail: string;
  /** Hold period before a seller's sale credit can be withdrawn. */
  pendingHoldDays: number;
}

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Paragraphs shown after the bullets. */
  after?: string[];
}

export interface LegalDocument {
  title: string;
  /** Last revision, ISO date (YYYY-MM-DD). Update it whenever the text changes. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

/** The operator's legal name, falling back to the site name until the admin fills it in. */
export const operatorName = (ctx: LegalContext) => ctx.companyName.trim() || ctx.siteName;
