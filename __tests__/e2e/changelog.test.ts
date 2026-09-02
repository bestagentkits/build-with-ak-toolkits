import { describe, expect, it } from 'vitest';
import { generateReleaseNotes } from '../../scripts/generate-changelog';

describe('Changelog and Release Notes Generator', () => {
  it('categorizes conventional commits correctly', () => {
    const commits = [
      {
        hash: '1111111111111111111111111111111111111111',
        shortHash: '1111111',
        subject: 'feat: add interactive studio command',
        author: 'Developer',
      },
      {
        hash: '2222222222222222222222222222222222222222',
        shortHash: '2222222',
        subject: 'fix: handle token expiration gracefully',
        author: 'Developer',
      },
      {
        hash: '3333333333333333333333333333333333333333',
        shortHash: '3333333',
        subject: 'docs: update deployment and publishing instructions',
        author: 'Developer',
      },
      {
        hash: '4444444444444444444444444444444444444444',
        shortHash: '4444444',
        subject: 'perf: optimize block compiler serialization',
        author: 'Developer',
      },
      {
        hash: '5555555555555555555555555555555555555555',
        shortHash: '5555555',
        subject: 'refactor: decouple transport from core client',
        author: 'Developer',
      },
      {
        hash: '6666666666666666666666666666666666666666',
        shortHash: '6666666',
        subject: 'ci: add release workflow',
        author: 'Developer',
      },
    ];

    const notes = generateReleaseNotes('1.1.0', commits);

    expect(notes).toContain('## [1.1.0]');
    expect(notes).toContain('### 🚀 Features');
    expect(notes).toContain('- feat: add interactive studio command (1111111)');
    expect(notes).toContain('### 🐛 Bug Fixes');
    expect(notes).toContain('- fix: handle token expiration gracefully (2222222)');
    expect(notes).toContain('### 📚 Documentation');
    expect(notes).toContain('- docs: update deployment and publishing instructions (3333333)');
    expect(notes).toContain('### ⚡ Performance');
    expect(notes).toContain('- perf: optimize block compiler serialization (4444444)');
    expect(notes).toContain('### ♻️ Refactoring');
    expect(notes).toContain('- refactor: decouple transport from core client (5555555)');
    expect(notes).toContain('### 🔧 Maintenance & Tooling');
    expect(notes).toContain('- ci: add release workflow (6666666)');
  });

  it('handles empty commit lists with default maintenance message', () => {
    const notes = generateReleaseNotes('1.0.1', []);
    expect(notes).toContain('## [1.0.1]');
    expect(notes).toContain('Maintenance release and dependency updates');
  });
});
