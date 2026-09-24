const canonicalPlatform = 'darwin';

if (process.platform !== canonicalPlatform) {
  console.error(
    `Canonical UX visual regression uses macOS snapshots (${canonicalPlatform}); current platform is ${process.platform}. ` +
      'Run pnpm e2e:responsive for cross-platform smoke coverage.'
  );
  process.exit(1);
}
