// Unit tests for classifyPoll -- specifically the non-FBS exclusion, which has already caused one
// real production incident (an "FCS Coaches Poll" entry silently overwrote the real FBS Coaches
// Poll, since a loose "coaches" substring match alone can't tell them apart) and was broadened
// here to Division II/III after auditing for the same failure mode with a different substring.
import { describe, it, expect } from 'vitest';
import { classifyPoll } from './poll.mjs';

describe('classifyPoll', () => {
  it('classifies the real FBS polls', () => {
    expect(classifyPoll('AP Top 25')).toBe('ap');
    expect(classifyPoll('Coaches Poll')).toBe('coaches');
    expect(classifyPoll('Playoff Committee Rankings')).toBe('cfp');
  });

  it('excludes an FCS poll even though it contains "coaches" -- the original incident', () => {
    expect(classifyPoll('FCS Coaches Poll')).toBeNull();
  });

  it('excludes Division II/III polls that also contain "coaches" -- the same failure mode, a different substring', () => {
    expect(classifyPoll('AFCA Division II Coaches Poll')).toBeNull();
    expect(classifyPoll('AFCA Division III Coaches Poll')).toBeNull();
  });

  it('is case-insensitive for both the real polls and the exclusions', () => {
    expect(classifyPoll('ap top 25')).toBe('ap');
    expect(classifyPoll('fcs coaches poll')).toBeNull();
  });

  it('returns null for an unrecognized or missing poll name rather than guessing', () => {
    expect(classifyPoll('Some Other Poll')).toBeNull();
    expect(classifyPoll(null)).toBeNull();
    expect(classifyPoll(undefined)).toBeNull();
    expect(classifyPoll('')).toBeNull();
  });
});
