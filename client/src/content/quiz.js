// Investor Readiness Quiz. Each answer adds points to one or more profiles.
// Highest total wins. Educational guidance, not financial advice.

// CONTRACT: option ORDER within each question is a server-side contract.
// server/scoring.js (qualBand + dfySignal) reads option indexes as financial
// meaning. Append new options at the END; never insert or reorder without
// updating qualBand in the same change.
export const QUIZ = [
  {
    id: 'capital',
    q: 'How much cash could you put toward your first deal today?',
    options: [
      { label: 'Under $10,000', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: '$10,000 to $25,000', pts: { steady: 1, builder: 2, accelerator: 0 } },
      { label: '$25,000 to $60,000', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'Over $60,000', pts: { steady: 0, builder: 1, accelerator: 2 } },
    ],
  },
  {
    id: 'monthly',
    q: 'How much can you add to your investing fund each month?',
    options: [
      { label: 'Almost nothing right now', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: 'A few hundred dollars', pts: { steady: 1, builder: 1, accelerator: 0 } },
      { label: '$1,000 to $3,000', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'More than $3,000', pts: { steady: 0, builder: 1, accelerator: 2 } },
    ],
  },
  {
    id: 'time',
    q: 'How many hours a week can you realistically give this?',
    options: [
      { label: '1 to 2 hours', pts: { steady: 2, builder: 0, accelerator: 1 } },
      { label: '3 to 5 hours', pts: { steady: 1, builder: 2, accelerator: 0 } },
      { label: '6 to 10 hours', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'This is my main focus', pts: { steady: 0, builder: 1, accelerator: 2 } },
    ],
  },
  {
    id: 'rehab',
    q: 'A property needs a $25,000 renovation before it rents. How does that feel?',
    options: [
      { label: 'Terrifying. I want move-in ready.', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: 'Nervous, but I would try with guidance', pts: { steady: 1, builder: 2, accelerator: 0 } },
      { label: 'Fine, if the numbers work', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'That is where the profit lives', pts: { steady: 0, builder: 1, accelerator: 2 } },
    ],
  },
  {
    id: 'income',
    q: 'How stable is your current income?',
    options: [
      { label: 'Unpredictable month to month', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: 'Stable but tight', pts: { steady: 1, builder: 1, accelerator: 0 } },
      { label: 'Stable with room to save', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'High and secure', pts: { steady: 0, builder: 1, accelerator: 2 } },
    ],
  },
  {
    id: 'drawdown',
    q: 'Your first deal hits a surprise: the rehab runs $8,000 over. What happens?',
    options: [
      { label: 'I could not cover it', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: 'Painful, but my reserves absorb it', pts: { steady: 0, builder: 2, accelerator: 0 } },
      { label: 'Annoying line item, nothing more', pts: { steady: 0, builder: 1, accelerator: 2 } },
      { label: 'I budget a contingency for exactly this', pts: { steady: 0, builder: 2, accelerator: 1 } },
    ],
  },
  {
    id: 'goal',
    q: 'What are you actually after?',
    options: [
      { label: 'A safety net beside my job', pts: { steady: 2, builder: 1, accelerator: 0 } },
      { label: 'Replace my income in 5 to 10 years', pts: { steady: 0, builder: 2, accelerator: 1 } },
      { label: 'Full portfolio, 20+ doors, fast as sensible', pts: { steady: 0, builder: 1, accelerator: 2 } },
      { label: 'Wealth for my kids, long horizon', pts: { steady: 1, builder: 2, accelerator: 0 } },
    ],
  },
  {
    id: 'style',
    q: 'How hands-on do you want to be?',
    options: [
      { label: 'Very. I want to learn every step myself.', pts: { steady: 1, builder: 2, accelerator: 0 } },
      { label: 'Involved in decisions, out of the weeds', pts: { steady: 1, builder: 1, accelerator: 1 } },
      { label: 'I would rather pay experts and review results', pts: { steady: 0, builder: 0, accelerator: 2 } },
      { label: 'Not sure yet', pts: { steady: 1, builder: 1, accelerator: 0 } },
    ],
  },
  {
    id: 'experience',
    q: 'Where are you today with real estate?',
    options: [
      { label: 'Never bought anything, still learning', pts: { steady: 2, builder: 0, accelerator: 0 } },
      { label: 'Been researching a while, ready to act', pts: { steady: 0, builder: 2, accelerator: 0 } },
      { label: 'Own 1 to 3 properties', pts: { steady: 0, builder: 1, accelerator: 1 } },
      { label: 'Own 4 or more, here to scale', pts: { steady: 0, builder: 0, accelerator: 2 } },
    ],
  },
];

export const PROFILES = {
  steady: {
    name: 'Steady Starter',
    icon: '🌱',
    color: 'brand',
    headline: 'Build the base first, then buy with confidence.',
    desc: 'You are closer than you think, but your best move is a deliberate one: keep stacking capital, learn the model cold, and make your first deal a simple turnkey purchase where the housing authority check does the heavy lifting. One clean win changes everything.',
    plan: [
      'Work through Foundation and First Deal levels of the course',
      'Set a target: your first deal fund number and a monthly auto-transfer',
      'Run practice deals in the Deal Calculator weekly until the numbers feel boring',
    ],
    links: [
      { to: '/course', label: 'Start the course' },
      { to: '/calculators', label: 'Practice in the Deal Calculator' },
    ],
  },
  builder: {
    name: 'Builder',
    icon: '🧱',
    color: 'brand',
    headline: 'You are ready for your first deal. Maybe your first BRRRR.',
    desc: 'You have the capital, the stability, and the stomach for a real deal. Your questions are now practical: which market, which financing, which property. The BRRRR path can recycle your capital so deal one funds deal two.',
    plan: [
      'Define your buy box this week, on paper',
      'Run the Goal Planner to compare Turnkey vs BRRRR timelines for your goal',
      'Pick one market and go deep with the Market & Buy Box Kit',
    ],
    links: [
      { to: '/plan', label: 'Open the Goal Planner' },
      { to: '/vault', label: 'Open the Toolkit' },
    ],
  },
  accelerator: {
    name: 'Accelerator',
    icon: '🚀',
    color: 'brand',
    headline: 'Your bottleneck is not capital. It is deal flow and time.',
    desc: 'You can move faster than a course. With your resources the question is how many good deals you can get into per year without it becoming a second job. That is a systems and team problem, and it is exactly what we help members solve directly.',
    plan: [
      'Run the Path to 50 Doors calculator with your real numbers',
      'Skim First Deal level for the Section 8 specifics, fast-track the checkpoints',
      'Talk to our team about done-with-you or done-for-you support',
    ],
    links: [
      { to: '/fifty-doors', label: 'Open Path to 50 Doors' },
      { to: '/get-help', label: 'See how we work together' },
    ],
  },
};

export function scoreQuiz(answers) {
  // answers: { [questionId]: optionIndex }
  const totals = { steady: 0, builder: 0, accelerator: 0 };
  for (const q of QUIZ) {
    const idx = answers[q.id];
    if (idx == null) continue;
    const pts = q.options[idx]?.pts || {};
    for (const k of Object.keys(totals)) totals[k] += pts[k] || 0;
  }
  const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
  return { totals, winner };
}
