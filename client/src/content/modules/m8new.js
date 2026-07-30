export default {
  lessons: [
    {
      id: 'm8l2',
      title: 'Build your 50 door plan',
      minutes: 7,
      description: 'Map your exact timeline to 50 doors and find the one number that speeds it up or slows it down.',
      resources: [
        { label: 'Capital Recycling Playbook', to: '/vault/capital-recycling-playbook', kind: 'Playbook' },
        { label: '50 Doors Roadmap', to: '/vault/50-doors-roadmap', kind: 'Roadmap' }
      ],
      body: [
        { p: 'The most common thing I hear from members at this stage is some version of: I do not earn enough to ever reach 50 doors. I understand the math you are running in your head. Save 20 thousand dollars a year, one door per year, 50 years. That math is wrong, and this lesson shows you why.' },
        { h: 'Your salary is not the throttle' },
        { p: 'Your timeline to 50 doors is set by deal quality, not by your paycheck. When you refinance a BRRRR, most of your capital comes back out and goes into the next deal. The one number that matters most is the cash left stuck in each deal after the refinance. Our average BRRRR leaves 10 to 17 thousand dollars in the deal. That stuck cash is the real cost of each door, and it is what your savings actually have to cover.' },
        { p: 'One student result, not a typical outcome: Giorgio went from 0 to 9 properties using the BRRRR method, managing all of it from Mexico. He did not do that on a giant salary. He did it by keeping the cash stuck in each deal low and recycling the same capital again and again.' },
        { h: 'Run your own numbers' },
        { steps: [
          'Open the Path to 50 Doors calculator and enter your starting cash, the amount you can deploy today.',
          'Set your monthly savings, whatever you can reliably add from income each month.',
          'Enter your cash per deal, the total you need to close and rehab one property before the refinance.',
          'Enter your cash stuck per deal. If you do not know yours yet, start with 13,500 dollars, the middle of our 10 to 17 thousand average.',
          'Add your expected cash flow per door, then watch the timeline build out month by month to door 50.'
        ] },
        { link: { to: '/fifty-doors', label: 'Open the Path to 50 Doors calculator' } },
        { h: 'The experiment that will change how you plan' },
        { p: 'Once your baseline is in, try this. Drag your monthly savings all the way to zero. The finish line barely moves, usually by months. Now put savings back and cut your cash stuck per deal in half. The finish line jumps years closer. That is the whole lesson in one interaction: a better negotiated deal, a tighter rehab, a stronger appraisal, each of those beats a raise at work. Deal quality compounds. Savings just add.' },
        { tip: 'This week, run the calculator with your real numbers, screenshot the timeline, and write down your target cash stuck per deal. Every deal you underwrite from now on gets measured against that number, not against your salary.' }
      ]
    },
    {
      id: 'm8l4',
      title: 'Deal flow at scale: your acquisition machine',
      minutes: 6,
      description: 'Why deal flow, not money, becomes the constraint at scale, and how to build a pipeline that outpaces your buying speed.',
      resources: [
        { label: 'Buy Box Worksheet', to: '/vault/buy-box-worksheet', kind: 'Worksheet' }
      ],
      body: [
        { p: 'Early on, I worried about running out of money. Around door 5 to 10, I learned the real problem: I was running out of deals. When your capital recycles through refinances, money stops being the bottleneck. Deal flow becomes the bottleneck, and most investors never build a system for it.' },
        { h: 'The bottleneck flips' },
        { p: 'At scale, the rule is simple: you need more qualified deals crossing your desk than you can buy. If you can close one deal a month, you need three or four real candidates hitting your inbox every week. When you only see one decent deal a month, you either overpay for it or you sit idle. Both outcomes wreck the timeline you built in the 50 door plan.' },
        { h: 'The manual machine' },
        { list: [
          'Investor-friendly agents: 2 to 3 agents who know your criteria and send you listings before they hit your saved searches.',
          'Wholesalers: get on 5 to 10 local lists, respond fast, and give feedback on every deal so they keep sending.',
          'Direct mail: 500 to 1,000 letters per month to absentee owners in your target zip codes, expecting a 1 to 2 percent response.'
        ] },
        { p: 'This works. I built my first portfolio on it. But it has a ceiling, and the ceiling is your hours. Every channel above is paid for in phone calls, follow ups, and screening time. Past a certain point you are spending 10 or more hours a week just filtering noise, and that is time you are not spending closing, refinancing, or managing.' },
        { h: 'How our members automate the top of the funnel' },
        { p: 'This is exactly why we built DealFinder AI. It scans active listings against Section 8 rents, the FMR data for each county, and against your buy box: price range, bedroom count, target markets, minimum cash flow. Every day it surfaces the candidates that actually pencil, so your hours go into the last mile, walking properties and making offers, instead of the first mile of filtering.' },
        { p: 'It comes with a 7-day free trial, then it is $49 a month, and you can cancel anytime — Cashflow 2.0 Academy students get 35% off for life. It does not replace your agents or wholesalers. It sits on top of them and makes sure nothing cash-flowing in your markets slips past you.' },
        { link: { to: '/finder', label: 'See how DealFinder AI works' } },
        { tip: 'Before you add any channel, manual or automated, write down your buy box using the worksheet: markets, price range, beds, condition, minimum cash flow per door. A machine can only feed you good deals if you have defined what a good deal is.' }
      ]
    }
  ]
};
