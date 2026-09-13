import Link from 'next/link';
import {
  ArrowRight,
  FileSearch,
  ListChecks,
  Users,
  CalendarCheck,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { StructuredData } from '@/components/structured-data';
import { pageMetadata, productStructuredData } from '@/lib/seo';
import styles from './page.module.css';

export const metadata = pageMetadata({
  title: 'AI Contract & Supplier Operations | ContractLedger AI',
  description:
    'See how ContractLedger AI connects document extraction, human review, supplier records and obligation tracking. Explore Selina Armstrong’s portfolio demo.',
  path: '/about',
});

const features = [
  {
    icon: FileSearch,
    title: 'Review with the source in view',
    body: 'AI proposes structured contract fields with a page and quote. A reviewer verifies material values before they become official records.',
    href: '/?view=new-contract-review',
    cta: 'Explore contract review',
  },
  {
    icon: ListChecks,
    title: 'Make approvals explicit',
    body: 'Deterministic rules route approvals and exceptions. Mandatory approvals must be complete before an executed contract enters the register.',
    href: '/?view=approvals',
    cta: 'Explore approvals',
  },
  {
    icon: Users,
    title: 'Keep suppliers connected',
    body: 'Connect supplier records to contracts, qualification documents and explainable risk factors, while preserving human-maintained master data.',
    href: '/?view=suppliers',
    cta: 'Explore supplier records',
  },
  {
    icon: CalendarCheck,
    title: 'Turn dates into accountable work',
    body: 'Assign obligations, track renewal dates and record completion evidence. Overdue status follows the due date, rather than a manually chosen label.',
    href: '/?view=obligations',
    cta: 'Explore obligations',
  },
  {
    icon: GitBranch,
    title: 'Follow the contract lifecycle',
    body: 'Preserve original terms, amendment changes and effective values. Keep the relationship between documents, versions and operational records visible.',
    href: '/?view=contracts',
    cta: 'Explore the contract register',
  },
  {
    icon: ShieldCheck,
    title: 'Evaluate the AI, too',
    body: 'Inspect field accuracy, source coverage and unsupported values using fictional evaluation fixtures. Seeded demo reports are labeled separately from live model runs.',
    href: '/?view=ai-validation',
    cta: 'Explore AI validation',
  },
];
const questions = [
  [
    'What is ContractLedger AI?',
    'An AI-assisted contract and supplier operations workbench built by Selina Armstrong as a portfolio project. It demonstrates how source evidence, human review, approval rules and audit history can support reliable operational records.',
  ],
  [
    'Who is this project for?',
    'Contract administrators, legal operations teams, procurement specialists and hiring teams evaluating practical work in contract operations and vendor governance.',
  ],
  [
    'Does AI make the final decision?',
    'AI proposes extractions and summaries. Deterministic rules control workflow requirements, and people confirm material values and decisions. The project does not offer autonomous legal advice.',
  ],
  [
    'Is this a full contract lifecycle management platform?',
    'Its focus is contract administration: review, registration, amendments, suppliers and obligations. Negotiation, e-signature, enterprise identity and multi-tenant operations are outside the current scope.',
  ],
  [
    'Can I explore the demo?',
    'The public deployment supports guest browsing when enabled. Sign-in and write capabilities depend on the configured role. All contracts, organisations, people and policies in the demo are fictional.',
  ],
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <StructuredData data={productStructuredData()} />
      <a href="#overview" className={styles.skip}>
        Skip to product overview
      </a>
      <header className={styles.header}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="ContractLedger AI workspace"
        >
          <BrandMark />
          <span>
            ContractLedger <b>AI</b>
          </span>
        </Link>
        <nav aria-label="Product navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#questions">FAQ</a>
          <Link className={styles.navCta} href="/">
            Open demo <ArrowRight size={16} />
          </Link>
        </nav>
      </header>

      <section className={styles.hero} id="overview">
        <div>
          <p className={styles.eyebrow}>
            AI-assisted contract &amp; supplier operations
          </p>
          <h1>
            From contracts
            <br />
            to accountable
            <br />
            <em>records.</em>
          </h1>
          <p className={styles.intro}>
            Turn unstructured agreements into source-traceable records. Connect
            human review, rule-driven approvals and the work that follows a
            signature.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/">
              Explore the live demo <ArrowRight size={18} />
            </Link>
            <Link className={styles.secondary} href="/?view=case-study">
              Read the case study <ArrowRight size={18} />
            </Link>
          </div>
          <p className={styles.note}>
            A portfolio project by Selina Armstrong. Fictional data throughout.
          </p>
        </div>
        <div className={styles.recordWrap}>
          <div className={styles.record}>
            <div className={styles.recordHeading}>
              <BrandMark className="size-8" />
              <span>The accountable record</span>
            </div>
            {[
              [
                '01',
                'Source',
                'A page. A quote.',
                'Know where each proposed value came from.',
              ],
              [
                '02',
                'Review',
                'A human decision.',
                'Keep verification and exceptions explicit.',
              ],
              [
                '03',
                'Register',
                'A traceable record.',
                'Preserve the source, reviewer and history.',
              ],
            ].map(([number, label, title, detail]) => (
              <div className={styles.recordRow} key={number}>
                <span>
                  {number} / {label}
                </span>
                <h2>{title}</h2>
                <p>{detail}</p>
              </div>
            ))}
            <div className={styles.recordFoot}>
              <ShieldCheck size={19} /> Evidence is part of the record.
            </div>
          </div>
          <p className={styles.diagramCaption}>
            The review workflow, illustrated.
          </p>
        </div>
      </section>

      <section className={styles.principles} aria-label="Design principles">
        <p>Source-traceable.</p>
        <p>Human-verified.</p>
        <p>Rule-driven.</p>
      </section>
      <section className={styles.section} id="capabilities">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>The work beyond extraction</p>
          <h2>
            One connected record.
            <br />
            Every step accounted for.
          </h2>
          <p>
            Contract data becomes useful when you can explain it, approve it and
            act on it. This workbench brings those steps together.
          </p>
        </div>
        <div className={styles.features}>
          {features.map(({ icon: Icon, title, body, href, cta }) => (
            <article key={title}>
              <Icon size={25} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
              <Link href={href}>
                {cta} <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.thesis}>
        <p className={styles.eyebrow}>The product principle</p>
        <h2>
          AI proposes.
          <br />
          Rules guide.
          <br />
          <span>People confirm.</span>
        </h2>
        <div>
          <p>
            A confident extraction is still a proposal. An executed record needs
            supporting evidence, the right approvals and a reviewer who can
            stand behind the decision.
          </p>
          <Link href="/?view=case-study">
            See the product decisions <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className={styles.section} id="questions">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Before you explore</p>
          <h2>
            A clear scope.
            <br />
            An honest demonstration.
          </h2>
        </div>
        <div className={styles.faq}>
          {questions.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={styles.closing}>
        <BrandMark className="size-14" />
        <h2>
          Follow a contract.
          <br />
          See the controls behind it.
        </h2>
        <Link className={styles.primary} href="/">
          Open ContractLedger AI <ArrowRight size={18} />
        </Link>
      </section>
      <footer className={styles.footer}>
        <p>
          ContractLedger AI · Built by Selina Armstrong
          <br />
          <span>
            Portfolio demonstration. Fictional data. Not legal advice.
          </span>
        </p>
        <div>
          <a href="https://www.linkedin.com/in/selinaarmstrong/">LinkedIn</a>
          <a href="/brand/wordmark.svg" download>
            Brand wordmark
          </a>
          <a href="/social/contractledger-og.png" download>
            Share image
          </a>
        </div>
      </footer>
    </main>
  );
}
