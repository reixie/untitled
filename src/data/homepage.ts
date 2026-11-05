import taskBoard from '../assets/images/selected-work-task-board-original.png';
import companyTable from '../assets/images/selected-work-company-table-original.png';
import vocabularyApp from '../assets/images/selected-work-vocabulary-app-original.png';

// Null destinations are deliberate: real case routes are still pending.
export interface PendingDestination {
  href: null;
  status: 'pending';
}

const pending: PendingDestination = { href: null, status: 'pending' };

export const profile = {
  name: 'Alex L.',
  role: 'Design Engineer',
  introduction:
    'I’m a product designer based in Lithuania. I’ve designed B2B SaaS products, mobile apps, and websites.',
  expertise:
    'I make complex workflows easier to use, build design systems, and prototype in React with AI tools. I’m open to product design roles.',
  // Hyperlink values read from Figma 1:32, not inferred from the labels.
  contacts: {
    linkedin: 'https://www.linkedin.com/in/alex-lohinov-b503683b4',
    github: 'https://github.com/reixie',
    x: 'https://x.com/reixxiie',
    email: 'mailto:alex@lohinov.com',
  },
};

export const keeps = {
  title: 'Keeps',
  subtitle: 'Visual library for macOS',
  description:
    'Organize images, videos, GIFs, and links into collections that stay on your Mac.',
  destination: {
    href: 'https://github.com/reixie/keeps',
    status: 'ready',
  },
};

// Source order: 42:382, 42:378 (initial center), 42:393. IDs identify slots, not projects.
export const selectedWork = [
  {
    sourceNode: '42:382',
    title: 'Pascal — Markdown notes for macOS',
    image: taskBoard,
    alt: 'Desktop notes interface with a Research Brief, research links, an evidence table, and tasks on a blue desktop background.',
    destination: { href: '/work/pascal/', status: 'ready' },
  },
  {
    sourceNode: '42:378',
    title: 'Accord — a CRM for small teams',
    image: companyTable,
    alt: 'Desktop company directory with a sidebar and a table of companies, domains, category tags, employees, revenue, and addresses.',
    destination: { href: '/work/accord/', status: 'ready' },
  },
  {
    sourceNode: '42:393',
    image: vocabularyApp,
    alt: 'Three phone screens showing a Spanish vocabulary flashcard for trabajo, its English translation work, and language learning settings.',
    destination: pending,
  },
];

export const experience = [
  // Owner-approved editorial correction: Figma says “Koncepta Agency”. Roles are unchanged.
  {
    company: 'Konexta Agency',
    role: 'Product Designer',
    href: 'https://www.konexta.agency/',
  },
  {
    company: 'Valorx',
    role: 'Product Designer',
    href: 'https://www.valorx.com/',
  },
  { company: 'Roxfit', role: 'UI/UX Designer', href: 'https://roxfit.app/' },
  {
    company: 'OptiHint',
    role: 'UI/UX Designer',
    href: 'https://optihint.com/',
  },
];
