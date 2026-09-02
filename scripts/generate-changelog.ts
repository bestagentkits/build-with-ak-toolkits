import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
}

interface CategorizedCommits {
  features: CommitInfo[];
  fixes: CommitInfo[];
  performance: CommitInfo[];
  docs: CommitInfo[];
  refactor: CommitInfo[];
  maintenance: CommitInfo[];
  other: CommitInfo[];
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function getPreviousTag(): string {
  const tags = run('git tag --sort=-v:refname').split('\n').filter(Boolean);
  return tags[0] || '';
}

function getCommitsSince(tag: string): CommitInfo[] {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const rawLog = run(`git log ${range} --pretty=format:"%H|%h|%s|%an"`);
  if (!rawLog) return [];

  return rawLog.split('\n').map((line) => {
    const [hash, shortHash, subject, author] = line.split('|');
    return {
      hash: hash || '',
      shortHash: shortHash || '',
      subject: subject || '',
      author: author || '',
    };
  });
}

function categorizeCommits(commits: CommitInfo[]): CategorizedCommits {
  const categorized: CategorizedCommits = {
    features: [],
    fixes: [],
    performance: [],
    docs: [],
    refactor: [],
    maintenance: [],
    other: [],
  };

  for (const commit of commits) {
    const s = commit.subject.trim();
    // Skip version bump / release commits in changelog
    if (/^chore\(release\):/i.test(s) || /^release:/i.test(s)) {
      continue;
    }

    if (/^feat(\(.*\))?:/i.test(s)) {
      categorized.features.push(commit);
    } else if (/^fix(\(.*\))?:/i.test(s)) {
      categorized.fixes.push(commit);
    } else if (/^perf(\(.*\))?:/i.test(s)) {
      categorized.performance.push(commit);
    } else if (/^docs(\(.*\))?:/i.test(s)) {
      categorized.docs.push(commit);
    } else if (/^refactor(\(.*\))?:/i.test(s)) {
      categorized.refactor.push(commit);
    } else if (/^(chore|ci|test|build)(\(.*\))?:/i.test(s)) {
      categorized.maintenance.push(commit);
    } else {
      categorized.other.push(commit);
    }
  }

  return categorized;
}

function formatSection(title: string, icon: string, commits: CommitInfo[]): string {
  if (commits.length === 0) return '';
  const lines = commits.map((c) => `- ${c.subject} (${c.shortHash})`);
  return `### ${icon} ${title}\n\n${lines.join('\n')}\n\n`;
}

export function generateReleaseNotes(version: string, commits: CommitInfo[]): string {
  const date = new Date().toISOString().split('T')[0];
  const categorized = categorizeCommits(commits);

  let notes = `## [${version}] - ${date}\n\n`;

  notes += formatSection('Features', '🚀', categorized.features);
  notes += formatSection('Bug Fixes', '🐛', categorized.fixes);
  notes += formatSection('Performance', '⚡', categorized.performance);
  notes += formatSection('Documentation', '📚', categorized.docs);
  notes += formatSection('Refactoring', '♻️', categorized.refactor);
  notes += formatSection('Maintenance & Tooling', '🔧', categorized.maintenance);
  notes += formatSection('Other Changes', '📝', categorized.other);

  if (
    commits.length === 0 ||
    (!categorized.features.length &&
      !categorized.fixes.length &&
      !categorized.performance.length &&
      !categorized.docs.length &&
      !categorized.refactor.length &&
      !categorized.maintenance.length &&
      !categorized.other.length)
  ) {
    notes += `- Maintenance release and dependency updates.\n\n`;
  }

  return notes;
}

export function updateChangelog(version: string, releaseNotes: string): void {
  const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
  const header = '# Changelog\n\nAll notable changes to `@agentkit/build-with-ak` will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';

  let currentContent = '';
  if (existsSync(changelogPath)) {
    const raw = readFileSync(changelogPath, 'utf-8');
    // Strip header if already exists
    if (raw.startsWith('# Changelog')) {
      currentContent = raw.replace(/^# Changelog[\s\S]*?(?=## \[)/, '');
    } else {
      currentContent = raw;
    }
  }

  const updatedContent = `${header}${releaseNotes}${currentContent.trim()}\n`;
  writeFileSync(changelogPath, updatedContent, 'utf-8');
}

if (process.argv[1] && (resolve(process.argv[1]) === resolve(__filename) || process.argv[1].includes('generate-changelog'))) {
  const targetVersion = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf-8')).version;
  const previousTag = getPreviousTag();
  const commits = getCommitsSince(previousTag);
  const releaseNotes = generateReleaseNotes(targetVersion, commits);

  // Write release notes artifact for GitHub release
  const releaseNotesPath = resolve(process.cwd(), 'RELEASE_NOTES.md');
  writeFileSync(releaseNotesPath, releaseNotes, 'utf-8');

  // Update CHANGELOG.md
  updateChangelog(targetVersion, releaseNotes);

  console.log(`[changelog] Successfully generated release notes for v${targetVersion} (${commits.length} commits found)`);
}
