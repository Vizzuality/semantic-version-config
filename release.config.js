module.exports = {
  branches: [
    { name: "main" }, // Stable production releases
    { name: "develop", prerelease: "beta" }, // Beta pre-releases for ongoing development
    { name: "staging", prerelease: "rc" }, // RC (release candidate) pre-releases
  ],
  plugins: [
  
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" }, // Features trigger minor release
          { type: "fix", release: "patch" }, // Fixes trigger patch release
          { breaking: true, release: "major" }, // Breaking changes trigger major release
          { type: "docs", release: false }, // Documentation changes are ignored
          { type: "chore", release: false }, // Chores are ignored
        ],
        parserOpts: {
          noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
        },
      },
    ],

    "@semantic-release/release-notes-generator",

    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],

      "@semantic-release/github",
      "./jira-plugin", 
  ],
};
