// Hand-authored editorial content for this mockup — the eventual real build replaces this
// with the two-stage scoring + LLM-narration pipeline (deterministic selection, LLM prose).

export const GAMES = [
  {
    away: { name: 'Texas', rank: 3 }, home: { name: 'Alabama', rank: 6 },
    when: 'Sat 3:30pm', spread: 'Texas -3.5', ou: 'O/U 51.5',
    note: 'A loss drops Texas out of the top-4 bye line; Alabama needs this to stay in the field.',
  },
  {
    away: { name: 'Georgia', rank: 2 }, home: { name: 'Tennessee', rank: 9 },
    when: 'Sat 7:30pm', spread: 'Georgia -9.5', ou: 'O/U 47.0',
    note: "Tennessee is fighting for the last comfortable at-large spot — an upset would be the week's biggest shake-up.",
  },
  {
    away: { name: 'Ohio State', rank: 1 }, home: { name: 'Michigan', rank: 8 },
    when: 'Sat 12:00pm', spread: 'Ohio State -6.5', ou: 'O/U 44.5',
    note: "The Game. A Michigan win puts real pressure on the committee's #1 seed.",
  },
  {
    away: { name: 'Notre Dame', rank: 11 }, home: { name: 'USC', rank: 19 },
    when: 'Sat 8:00pm', spread: 'Notre Dame -4', ou: 'O/U 52.0',
    note: 'Both teams need this to stay alive on the bubble; loser is likely out of the top 16.',
  },
];

export const PREDICTIONS = [
  "If Texas beats Alabama, expect them to leapfrog Oregon for the 3-seed — their resume already has two top-12 wins to Oregon's one.",
  "Ohio State–Michigan is the week's biggest 1-seed risk: a Wolverines win wouldn't drop Ohio State out of the top 4, but it would open the door for Georgia to jump to #1.",
  "Vanderbilt is this week's fastest riser (+3) on the strength of a road win over a ranked SEC foe — worth watching if they stay this hot.",
  "Washington's three-spot drop follows a loss with no ranked opponents left on the schedule — their path back into the top 16 is narrow.",
  "Memphis (11-1, #25) is the resume the committee will argue about most: gaudy record, thin schedule. Likely ceiling is a New Year's Six bid, not the 12-team field.",
];

export const PATH_SCENARIOS = [
  'Texas at Alabama (Sat) is the only game this week involving two current bye-line teams — the loser has the most to lose in seeding.',
  "If Ole Miss and Iowa State both win, seeds 10–13 could reshuffle entirely by Tuesday's reveal.",
  'Notre Dame and USC are playing each other on the bubble line — one of them is likely out of the top 16 by Sunday regardless of anything else.',
  "No one-loss Group of Five team (Memphis included) projects into the field under this model — the ceiling for an undefeated G5 run is a New Year's Six at-large.",
];

export const BUBBLE_NOTES = {
  13: 'Needs a win and help — a top-12 loss above them opens the door.',
  14: 'Controls its own fate with one more quality win.',
  15: "Fastest riser on the board — one more week like this and they're in.",
  16: 'Trending the wrong way; needs chaos above to stay relevant.',
};
