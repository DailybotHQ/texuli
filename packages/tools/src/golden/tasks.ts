import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import type { GoldenTask } from './types.ts';

/**
 * The agent golden set: 30 pre-registered interface tasks. Each has a brief a
 * model receives, the components the interface needs, the guidance it baits
 * (`traps`), and a reference tree that passes every scorer check. Changing a
 * task changes what a model is measured against, so tasks are append-only:
 * add `g31-…` rather than editing a brief.
 *
 * All content is fictional (Harbor, Pebble and friends; `example.com` hosts).
 */

const NAVIGATION = 'Application navigation, account controls or mutations.';
const CHROME = 'App chrome shells (sidebar, top-nav, dialogs)';

type Props = Record<string, unknown>;
type Node = CatalogTreeInput;

const node = (id: string, props: Props = {}, children: Node[] = []): Node =>
  children.length ? { id, props, children } : { id, props };

const page = (title: string, description: string, children: Node[]): Node =>
  node('layout-page', { title, description }, children);
const doc = (title: string, children: Node[]): Node => node('layout-doc', { title }, children);
const deck = (title: string, children: Node[]): Node => node('layout-deck', { title }, children);
const card = (title: string, children: Node[]): Node => node('layout-card', { title }, children);
const grid = (columns: number, children: Node[]): Node =>
  node('layout-grid', { columns }, children);

const block = (value: Props): Node => node('blocks-text', { block: value });
const heading = (level: 1 | 2 | 3 | 4, text: string): Node =>
  block({ type: 'heading', level, text });
const text = (markdown: string): Node => block({ type: 'text', markdown });
const list = (items: string[], ordered = false): Node =>
  block({ type: 'list', ordered, items: items.map((item) => ({ text: item })) });
const quote = (value: string, cite?: string): Node =>
  block(cite ? { type: 'quote', quote: value, cite } : { type: 'quote', quote: value });
const callout = (tone: string, title: string, body: string): Node =>
  block({ type: 'callout', tone, title, body });

const data = (value: Props): Node => node('blocks-data', { block: value });
const kpis = (items: [string, string, string?][]): Node =>
  data({
    type: 'kpi',
    items: items.map(([label, value, delta]) =>
      delta ? { label, value, delta } : { label, value }
    ),
  });
const stats = (items: [string, string][]): Node =>
  data({ type: 'stat', items: items.map(([label, value]) => ({ label, value })) });
const table = (caption: string, columns: [string, string][], rows: Props[]): Node =>
  data({ type: 'table', caption, columns: columns.map(([id, label]) => ({ id, label })), rows });

const points = (labels: string[], values: number[]) =>
  labels.map((x, index) => ({ x, y: values[index] ?? null }));
const series = (id: string, label: string, labels: string[], values: number[]) => ({
  id,
  label,
  points: points(labels, values),
});
const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const cartesian = (id: string, title: string, description: string, s: Props[]): Node =>
  node(id, { title, description, series: s });
const parts = (pairs: [string, number][]) =>
  pairs.map(([label, value]) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    value,
  }));
const PART_LABELS = { table: 'Data table', category: 'Category', value: 'Value' };
const partWhole = (
  id: string,
  title: string,
  description: string,
  pairs: [string, number][]
): Node => node(id, { title, description, data: parts(pairs), labels: PART_LABELS });

const image = (src: string, alt: string): Node =>
  node('media-image', { src, alt, width: 640, height: 360 });

export const GOLDEN_TASKS: readonly GoldenTask[] = Object.freeze([
  {
    id: 'g01-weekly-support-digest',
    title: 'Weekly support digest',
    brief:
      'Build a weekly support digest for the Harbor help desk: three headline KPIs (open tickets, median first reply, satisfaction), a line chart of tickets opened per week for six weeks, and a table of the five busiest queues.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'blocks-data', 'charts-line'],
    traps: [],
    reference: page('Weekly support digest', 'Harbor help desk, week 24', [
      kpis([
        ['Open tickets', '142', '-8%'],
        ['Median first reply', '38 min', '-4 min'],
        ['Satisfaction', '94%', '+1 pt'],
      ]),
      card('Tickets per week', [
        cartesian('charts-line', 'Tickets opened', 'Tickets opened per week over six weeks', [
          series('opened', 'Opened', WEEKS, [310, 284, 296, 270, 255, 248]),
        ]),
      ]),
      card('Busiest queues', [
        table(
          'Five busiest queues this week',
          [
            ['queue', 'Queue'],
            ['open', 'Open'],
          ],
          [
            { queue: 'Billing', open: 41 },
            { queue: 'Shipping', open: 33 },
            { queue: 'Accounts', open: 27 },
            { queue: 'Returns', open: 22 },
            { queue: 'Hardware', open: 19 },
          ]
        ),
      ]),
    ]),
  },
  {
    id: 'g02-release-notes',
    title: 'Release notes',
    brief:
      'Write release notes for Pebble 4.2 as a document: a short summary, a "New" section and a "Fixed" section as bullet lists, and a note warning that the old export format is removed next release.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [],
    reference: doc('Pebble 4.2 release notes', [
      text('Pebble 4.2 makes shared boards faster and adds keyboard shortcuts for the editor.'),
      heading(2, 'New'),
      list(['Keyboard shortcuts in the board editor', 'Board templates for planning weeks']),
      heading(2, 'Fixed'),
      list(['Comments no longer jump while typing', 'Dates show in the viewer time zone']),
      callout(
        'warning',
        'Export format change',
        'The 3.x export format is removed in 4.3. Re-export old boards before then.'
      ),
    ]),
  },
  {
    id: 'g03-onboarding-handbook',
    title: 'Team onboarding handbook',
    brief:
      'Create the first page of the Harbor team onboarding handbook: a welcome paragraph, the first-week checklist as an ordered list, and a quote from the team lead. The site header already has the navigation, so do not add a menu of links.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [NAVIGATION],
    reference: doc('Welcome to Harbor', [
      text('This handbook covers how the team plans, ships and supports Harbor.'),
      heading(2, 'Your first week'),
      list(
        [
          'Meet your onboarding buddy',
          'Set up the development sandbox',
          'Ship a small fix with a pair',
        ],
        true
      ),
      quote(
        'Ask early and ask often; nobody expects you to know the codebase yet.',
        'Rina Okafor, team lead'
      ),
    ]),
  },
  {
    id: 'g04-quarterly-revenue',
    title: 'Quarterly revenue review',
    brief:
      'Build a quarterly revenue review for Pebble: revenue, net retention and new logos as stats, a stacked bar chart of revenue by plan for six months, and a donut of revenue share by region.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-stacked-bar', 'charts-donut'],
    traps: [],
    reference: page('Quarterly revenue review', 'Pebble, second quarter', [
      stats([
        ['Revenue', '$1.42M'],
        ['Net retention', '112%'],
        ['New logos', '38'],
      ]),
      card('Revenue by plan', [
        cartesian(
          'charts-stacked-bar',
          'Revenue by plan',
          'Monthly revenue split by plan, in thousands',
          [
            series('team', 'Team', MONTHS, [120, 126, 131, 138, 142, 150]),
            series('business', 'Business', MONTHS, [90, 94, 99, 101, 108, 112]),
          ]
        ),
      ]),
      card('Revenue by region', [
        partWhole('charts-donut', 'Revenue share', 'Share of quarterly revenue by region', [
          ['North', 42],
          ['South', 23],
          ['West', 35],
        ]),
      ]),
    ]),
  },
  {
    id: 'g05-incident-postmortem',
    title: 'Incident postmortem',
    brief:
      'Write the postmortem for the Harbor checkout outage: summary, an ordered timeline, a quote from the on-call engineer, and a callout with the follow-up owner.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [],
    reference: doc('Checkout outage postmortem', [
      text(
        'Checkout returned errors for 23 minutes after a configuration change. No data was lost.'
      ),
      heading(2, 'Timeline'),
      list(
        ['09:02 configuration deployed', '09:05 error alerts fire', '09:25 change rolled back'],
        true
      ),
      quote('The rollback was quick once we saw the config diff.', 'Theo Marsh, on call'),
      callout('info', 'Follow-up', 'Ines Varga owns adding a config canary by the next release.'),
    ]),
  },
  {
    id: 'g06-plan-comparison',
    title: 'Plan comparison',
    brief:
      'Show a comparison of the three Pebble plans (Starter, Team, Business) as a table with seats, storage and support level. Do not add buy or upgrade buttons; the billing page handles purchases.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'blocks-data'],
    traps: [NAVIGATION],
    reference: page('Compare plans', 'What each Pebble plan includes', [
      table(
        'Pebble plans',
        [
          ['plan', 'Plan'],
          ['seats', 'Seats'],
          ['storage', 'Storage'],
          ['support', 'Support'],
        ],
        [
          { plan: 'Starter', seats: 3, storage: '5 GB', support: 'Community' },
          { plan: 'Team', seats: 25, storage: '100 GB', support: 'Email' },
          { plan: 'Business', seats: 250, storage: '1 TB', support: 'Priority' },
        ]
      ),
    ]),
  },
  {
    id: 'g07-harbor-traffic-map',
    title: 'Harbor district traffic',
    brief:
      'Map foot traffic across the Harbor districts with a point map, with a short intro paragraph above it.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-geo-point-map'],
    traps: [],
    reference: page('District foot traffic', 'Harbor, Saturday counts', [
      text('Counts come from the fictional Harbor sensor network, rounded to the nearest hundred.'),
      card('Traffic by district', [
        node('charts-geo-point-map', {
          title: 'Foot traffic',
          description: 'Saturday visitors by district',
          points: [
            { id: 'p1', label: 'Old Town square', regionId: 'old-town', value: 4200 },
            { id: 'p2', label: 'Harbor Point pier', regionId: 'harbor-point', value: 3800 },
            { id: 'p3', label: 'West Shore market', regionId: 'west-shore', value: 2100 },
          ],
        }),
      ]),
    ]),
  },
  {
    id: 'g08-pricing-faq',
    title: 'Pricing FAQ',
    brief:
      'Write the pricing FAQ for Pebble: four questions with short answers. Visitors already see "Sign in" and "Buy now" in the page header, so do not repeat them.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [NAVIGATION],
    reference: doc('Pricing questions', [
      heading(2, 'Can I change plans later?'),
      text('Yes. Changes apply from your next billing period.'),
      heading(2, 'Is there a free trial?'),
      text('Every plan starts with a 14-day trial.'),
      heading(2, 'Do you offer discounts for nonprofits?'),
      text('Registered nonprofits get 30% off the Team plan.'),
      heading(2, 'How is a seat counted?'),
      text('A seat is anyone who signed in during the billing period.'),
    ]),
  },
  {
    id: 'g09-hiring-funnel',
    title: 'Hiring funnel',
    brief:
      'Show the Harbor engineering hiring funnel for the quarter, from applications to offers accepted.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-funnel'],
    traps: [],
    reference: page('Hiring funnel', 'Engineering, this quarter', [
      card('From application to offer', [
        node('charts-funnel', {
          title: 'Hiring funnel',
          description: 'Candidates at each hiring stage',
          steps: [
            { id: 'applied', label: 'Applied', value: 480 },
            { id: 'screened', label: 'Screened', value: 160 },
            { id: 'onsite', label: 'Onsite', value: 42 },
            { id: 'offer', label: 'Offer accepted', value: 9 },
          ],
        }),
      ]),
    ]),
  },
  {
    id: 'g10-energy-usage',
    title: 'Building energy usage',
    brief:
      'Build an energy overview for the Pebble office: a grid of three cards, each with a sparkline of the last eight days for electricity, heating and water.',
    tier: 'untrusted',
    mustInclude: ['layout-grid', 'charts-sparkline'],
    traps: [],
    reference: page('Energy usage', 'Pebble office, last eight days', [
      grid(3, [
        card('Electricity', [
          node('charts-sparkline', {
            label: 'Electricity in kWh',
            values: [42, 40, 44, 39, 38, 41, 37, 36],
          }),
        ]),
        card('Heating', [
          node('charts-sparkline', {
            label: 'Heating in kWh',
            values: [80, 78, 75, 70, 72, 69, 66, 64],
          }),
        ]),
        card('Water', [
          node('charts-sparkline', {
            label: 'Water in liters',
            values: [510, 495, 520, 480, 470, 505, 490, 485],
          }),
        ]),
      ]),
    ]),
  },
  {
    id: 'g11-team-photos',
    title: 'Team offsite photos',
    brief:
      'Make a page of three photos from the Harbor team offsite, each with alternative text, and a short intro.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'media-image'],
    traps: [],
    reference: page('Team offsite', 'Harbor, spring offsite', [
      text('Two days of planning by the fictional Lake Arden.'),
      grid(3, [
        image(
          'images/offsite-workshop.webp',
          'Six people around a whiteboard covered in sticky notes'
        ),
        image('images/offsite-lake.webp', 'The team walking along a lake path at sunset'),
        image('images/offsite-dinner.webp', 'A long table set for a shared dinner'),
      ]),
    ]),
  },
  {
    id: 'g12-course-syllabus',
    title: 'Course syllabus',
    brief:
      'Write a syllabus for a six-week "Intro to data visualization" course: overview, weekly topics as an ordered list, and grading.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [],
    reference: doc('Intro to data visualization', [
      text('Six weeks of practical charting with fictional datasets.'),
      heading(2, 'Weekly topics'),
      list(
        [
          'Seeing data',
          'Choosing a chart',
          'Color and contrast',
          'Text and labels',
          'Interaction',
          'Critique',
        ],
        true
      ),
      heading(2, 'Grading'),
      list(['Weekly exercises: 60%', 'Final project: 40%']),
    ]),
  },
  {
    id: 'g13-customer-quotes',
    title: 'Customer quotes',
    brief:
      'Show three customer quotes about Pebble boards in a grid, each attributed to a fictional customer.',
    tier: 'untrusted',
    mustInclude: ['layout-grid', 'blocks-text'],
    traps: [],
    reference: page('What teams say', 'Quotes from fictional Pebble customers', [
      grid(3, [
        quote('Our planning meeting got twenty minutes shorter.', 'Mara Lind, Northwind Studio'),
        quote('The board templates saved our first week.', 'Jonah Pike, Fernhill Labs'),
        quote('Everyone finally looks at the same plan.', 'Ada Brook, Orchard Co.'),
      ]),
    ]),
  },
  {
    id: 'g14-budget-treemap',
    title: 'Budget breakdown',
    brief: 'Break down the Harbor annual budget by department and team with a treemap.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-treemap'],
    traps: [],
    reference: page('Annual budget', 'Harbor, by department', [
      card('Budget by team', [
        node('charts-treemap', {
          title: 'Budget breakdown',
          description: 'Annual budget by department and team, in thousands',
          labels: PART_LABELS,
          root: {
            id: 'budget',
            label: 'Budget',
            children: [
              {
                id: 'product',
                label: 'Product',
                children: [
                  { id: 'design', label: 'Design', value: 320 },
                  { id: 'engineering', label: 'Engineering', value: 910 },
                ],
              },
              { id: 'support', label: 'Support', value: 280 },
              { id: 'sales', label: 'Sales', value: 450 },
            ],
          },
        }),
      ]),
    ]),
  },
  {
    id: 'g15-service-dependencies',
    title: 'Service dependencies',
    brief:
      'Show which Harbor services depend on each other as a network graph, with a sentence explaining how to read it.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-network'],
    traps: [],
    reference: page('Service dependencies', 'Harbor platform', [
      text('Each link points from a service to a service it calls.'),
      card('Call graph', [
        node('charts-network', {
          title: 'Service dependencies',
          description: 'Services and the services they call',
          nodes: [
            { id: 'web', label: 'Web' },
            { id: 'api', label: 'API' },
            { id: 'billing', label: 'Billing' },
            { id: 'search', label: 'Search' },
          ],
          links: [
            { source: 'web', target: 'api', value: 3 },
            { source: 'api', target: 'billing', value: 1 },
            { source: 'api', target: 'search', value: 2 },
          ],
        }),
      ]),
    ]),
  },
  {
    id: 'g16-sprint-review-deck',
    title: 'Sprint review deck',
    brief:
      'Make a three-slide sprint review deck: goals met, a bar chart of points completed per team, and next sprint focus.',
    tier: 'untrusted',
    mustInclude: ['layout-deck', 'charts-bar'],
    traps: [],
    reference: deck('Sprint 18 review', [
      card('Goals met', [list(['Shared boards beta shipped', 'Search latency halved'])]),
      card('Points completed', [
        cartesian('charts-bar', 'Points completed', 'Story points completed per team this sprint', [
          series('points', 'Points', ['Boards', 'Search', 'Mobile'], [34, 28, 21]),
        ]),
      ]),
      card('Next sprint', [list(['Offline mode', 'Board permissions'])]),
    ]),
  },
  {
    id: 'g17-service-status',
    title: 'Service status',
    brief:
      'Build a public status page for Pebble: overall status as a callout, uptime stats for three services, and recent incidents as a list. Account links like "Sign in" or "My account" belong to the site header, not this page.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'blocks-data'],
    traps: [NAVIGATION],
    reference: page('Pebble status', 'Live service health', [
      callout('success', 'All systems operational', 'No incidents in the last 72 hours.'),
      stats([
        ['Web app uptime', '99.98%'],
        ['API uptime', '99.95%'],
        ['Sync uptime', '99.91%'],
      ]),
      card('Recent incidents', [
        list([
          'Jun 4: delayed sync, resolved in 12 minutes',
          'May 28: API errors, resolved in 6 minutes',
        ]),
      ]),
    ]),
  },
  {
    id: 'g18-recipe',
    title: 'Recipe',
    brief:
      'Write a recipe page for lemon barley soup: an intro, ingredients as a list and the steps as an ordered list.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [],
    reference: doc('Lemon barley soup', [
      text('A bright, filling soup for four.'),
      heading(2, 'Ingredients'),
      list(['1 cup pearl barley', '1 onion', '2 carrots', '6 cups stock', '1 lemon']),
      heading(2, 'Steps'),
      list(
        [
          'Soften the onion and carrots',
          'Add barley and stock and simmer 40 minutes',
          'Finish with lemon juice',
        ],
        true
      ),
    ]),
  },
  {
    id: 'g19-survey-results',
    title: 'Survey results',
    brief:
      'Summarize the Harbor employee survey: a bar chart of satisfaction by department and a pie chart of preferred work setup.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-bar', 'charts-pie'],
    traps: [],
    reference: page('Employee survey', 'Harbor, spring results', [
      card('Satisfaction by department', [
        cartesian(
          'charts-bar',
          'Satisfaction',
          'Average satisfaction score by department, out of 5',
          [series('score', 'Score', ['Product', 'Support', 'Sales', 'Ops'], [4.2, 3.9, 4.0, 3.7])]
        ),
      ]),
      card('Preferred work setup', [
        partWhole('charts-pie', 'Work setup', 'Share of people preferring each setup', [
          ['Hybrid', 58],
          ['Remote', 31],
          ['Office', 11],
        ]),
      ]),
    ]),
  },
  {
    id: 'g20-api-changelog',
    title: 'API changelog',
    brief:
      'Write the Harbor API changelog entry for version 2024-06: added endpoints, deprecations, and a warning callout about the removal date.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'blocks-text'],
    traps: [],
    reference: doc('API changelog: 2024-06', [
      heading(2, 'Added'),
      list(['`GET /v2/boards/{id}/activity`', '`POST /v2/exports`']),
      heading(2, 'Deprecated'),
      list(['`GET /v1/exports`, replaced by `POST /v2/exports`']),
      callout(
        'warning',
        'Removal date',
        'The v1 export endpoints stop responding on the fictional date of 1 December.'
      ),
    ]),
  },
  {
    id: 'g21-event-agenda',
    title: 'Event agenda',
    brief:
      'Show the agenda for the Pebble community day as a table of times, sessions and speakers, with a short intro.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'blocks-data'],
    traps: [],
    reference: page('Community day agenda', 'Pebble, 14 September', [
      text('All sessions take place in the fictional Orchard Hall.'),
      table(
        'Agenda',
        [
          ['time', 'Time'],
          ['session', 'Session'],
          ['speaker', 'Speaker'],
        ],
        [
          { time: '09:30', session: 'Welcome', speaker: 'Ada Brook' },
          { time: '10:00', session: 'Boards at scale', speaker: 'Jonah Pike' },
          { time: '11:15', session: 'Planning rituals', speaker: 'Mara Lind' },
        ]
      ),
    ]),
  },
  {
    id: 'g22-signup-sources',
    title: 'Sign-up sources',
    brief: 'Show how visitors flow from traffic sources to sign-up outcomes with a Sankey diagram.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-sankey'],
    traps: [],
    reference: page('Sign-up sources', 'Pebble, last month', [
      card('From source to outcome', [
        node('charts-sankey', {
          title: 'Visitor flow',
          description: 'Visitors from each source to each sign-up outcome',
          nodes: [
            { id: 'search', label: 'Search' },
            { id: 'referral', label: 'Referral' },
            { id: 'signup', label: 'Signed up' },
            { id: 'left', label: 'Left' },
          ],
          links: [
            { source: 'search', target: 'signup', value: 120 },
            { source: 'search', target: 'left', value: 380 },
            { source: 'referral', target: 'signup', value: 90 },
            { source: 'referral', target: 'left', value: 110 },
          ],
        }),
      ]),
    ]),
  },
  {
    id: 'g23-activity-heatmap',
    title: 'Activity heatmap',
    brief:
      'Show when the Harbor support team is busiest with a heatmap of tickets by weekday and time of day.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-heatmap'],
    traps: [],
    reference: page('When we are busiest', 'Harbor support, last four weeks', [
      card('Tickets by weekday and hour', [
        node('charts-heatmap', {
          title: 'Ticket volume',
          description: 'Tickets by weekday and time of day',
          cells: ['Mon', 'Tue', 'Wed'].flatMap((day, d) =>
            ['Morning', 'Afternoon'].map((slot, s) => ({
              x: day,
              y: slot,
              value: 20 + d * 7 + s * 11,
            }))
          ),
        }),
      ]),
    ]),
  },
  {
    id: 'g24-feature-adoption',
    title: 'Feature adoption',
    brief: 'Plot feature adoption against satisfaction for six Pebble features as a scatter chart.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-scatter'],
    traps: [],
    reference: page('Feature adoption', 'Pebble, this quarter', [
      card('Adoption and satisfaction', [
        node('charts-scatter', {
          title: 'Adoption against satisfaction',
          description: 'Share of teams using each feature and their satisfaction score',
          points: [
            { id: 'templates', label: 'Templates', x: 62, y: 4.4 },
            { id: 'shortcuts', label: 'Shortcuts', x: 35, y: 4.6 },
            { id: 'export', label: 'Export', x: 48, y: 3.8 },
            { id: 'comments', label: 'Comments', x: 81, y: 4.1 },
            { id: 'timeline', label: 'Timeline', x: 27, y: 3.9 },
            { id: 'search', label: 'Search', x: 74, y: 4.2 },
          ],
        }),
      ]),
    ]),
  },
  {
    id: 'g25-quarter-goals',
    title: 'Quarter goals',
    brief:
      'Show progress on three Harbor quarter goals as a grid of cards, each with a progress ring.',
    tier: 'untrusted',
    mustInclude: ['layout-grid', 'charts-progress-ring'],
    traps: [],
    reference: page('Quarter goals', 'Harbor, progress to date', [
      grid(3, [
        card('Reply time', [
          node('charts-progress-ring', { label: 'Reply time goal', value: 72, max: 100 }),
        ]),
        card('Self-service', [
          node('charts-progress-ring', { label: 'Self-service goal', value: 45, max: 100 }),
        ]),
        card('Hiring', [
          node('charts-progress-ring', { label: 'Hiring goal', value: 90, max: 100 }),
        ]),
      ]),
    ]),
  },
  {
    id: 'g26-website-visitors',
    title: 'Website visitors',
    brief:
      'Show website visitors per month for six months as an area chart, with the total as a stat.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'charts-area'],
    traps: [],
    reference: page('Website visitors', 'Pebble marketing site', [
      stats([['Visitors, six months', '184,300']]),
      card('Visitors per month', [
        cartesian('charts-area', 'Monthly visitors', 'Visitors per month over six months', [
          series('visitors', 'Visitors', MONTHS, [26400, 28100, 29800, 31200, 33300, 35500]),
        ]),
      ]),
    ]),
  },
  {
    id: 'g27-warehouse-kpis',
    title: 'Warehouse KPIs',
    brief:
      'Build a warehouse dashboard for Harbor logistics: three KPIs (orders shipped, on-time rate, returns) and a combo chart of orders and returns per week.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'blocks-data', 'charts-combo'],
    traps: [],
    reference: page('Warehouse dashboard', 'Harbor logistics, six weeks', [
      kpis([
        ['Orders shipped', '12,480', '+6%'],
        ['On-time rate', '97.2%', '+0.4 pt'],
        ['Returns', '312', '-3%'],
      ]),
      card('Orders and returns', [
        cartesian('charts-combo', 'Orders and returns', 'Orders shipped and returns per week', [
          series('orders', 'Orders', WEEKS, [1980, 2040, 2110, 2060, 2150, 2140]),
          series('returns', 'Returns', WEEKS, [52, 49, 55, 50, 54, 52]),
        ]),
      ]),
    ]),
  },
  {
    id: 'g28-newsletter',
    title: 'Team newsletter',
    brief:
      'Write the June issue of the Pebble team newsletter: a cover photo, two short stories with headings, and a closing quote.',
    tier: 'untrusted',
    mustInclude: ['layout-doc', 'media-image', 'blocks-text'],
    traps: [],
    reference: doc('Pebble newsletter: June', [
      image('images/newsletter-cover.webp', 'The Pebble team on the office roof garden'),
      heading(2, 'Boards beta lands'),
      text('Shared boards reached 400 fictional teams in the first week.'),
      heading(2, 'Welcome, new teammates'),
      text('Five people joined support and design this month.'),
      quote('Small, steady releases keep us honest.', 'Ada Brook'),
    ]),
  },
  {
    id: 'g29-server-load',
    title: 'Server load',
    brief:
      'Show current CPU, memory and disk use for the Harbor build server as three gauges in a grid.',
    tier: 'untrusted',
    mustInclude: ['layout-grid', 'charts-gauge'],
    traps: [],
    reference: page('Build server load', 'Harbor CI, right now', [
      grid(3, [
        card('CPU', [
          node('charts-gauge', { label: 'CPU use in percent', value: 64, min: 0, max: 100 }),
        ]),
        card('Memory', [
          node('charts-gauge', { label: 'Memory use in percent', value: 48, min: 0, max: 100 }),
        ]),
        card('Disk', [
          node('charts-gauge', { label: 'Disk use in percent', value: 81, min: 0, max: 100 }),
        ]),
      ]),
    ]),
  },
  {
    id: 'g30-feature-announcement',
    title: 'Feature announcement',
    brief:
      'Announce Pebble board templates: a hero image, a paragraph, three highlights as a list. Do not build a navigation menu or a sidebar section; the app shell already has them.',
    tier: 'untrusted',
    mustInclude: ['layout-page', 'media-image', 'blocks-text'],
    traps: [NAVIGATION, CHROME],
    reference: page('Board templates are here', 'Start every plan from a proven shape', [
      image(
        'images/templates-hero.webp',
        'A board template with columns for goals, tasks and risks'
      ),
      text('Templates give every team the same starting structure, then get out of the way.'),
      list([
        'Eight starter templates',
        'Save any board as a template',
        'Share templates across workspaces',
      ]),
    ]),
  },
] satisfies GoldenTask[]);

/** The task with `id`, or `undefined`. */
export function goldenTask(id: string): GoldenTask | undefined {
  return GOLDEN_TASKS.find((task) => task.id === id);
}
