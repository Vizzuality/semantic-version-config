const axios = require("axios");

module.exports = {
  verifyConditions: async (pluginConfig, { logger }) => {
    logger.log("Verifying Jira conditions...");
    if (!process.env.JIRA_HOST || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
      throw new Error("Jira credentials are missing (JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN).");
    }
  },

  success: async (pluginConfig, context) => {
    const { nextRelease, lastRelease, commits, branch, logger } = context;
    const jiraHost = process.env.JIRA_HOST;
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraApiToken = process.env.JIRA_API_TOKEN;
    const projectId = process.env.JIRA_PROJECT_KEY; // Example: SSP

    // Only process RC or stable branches
    if (!["main", "staging"].includes(branch.name)) {
      logger.log(`Skipping Fix Version update for branch ${branch.name}.`);
      return;
    }

    const releaseType = branch.name === "main" ? "stable" : "rc";

    logger.log(`Processing commits since the last release: ${lastRelease.gitTag || "none"}`);

    // Extract Jira ticket IDs from new commits
    const ticketRegex = /\b([A-Z]+-\d+)\b/g;
    const ticketIds = Array.from(
      new Set(
        commits
          .filter((commit) => commit.message) // Ensure the commit has a message
          .map((commit) => commit.message.match(ticketRegex)) // Extract ticket IDs
          .flat()
          .filter(Boolean) // Remove null or undefined matches
      )
    );

    if (ticketIds.length === 0) {
      logger.log("No Jira tickets found in new commits.");
      return;
    }

    logger.log(`Found Jira tickets: ${ticketIds.join(", ")}`);

    // Create or update the Fix Version in Jira
    const fixVersion = {
      name: nextRelease.version,
      description: `Release ${nextRelease.version} (${releaseType})`,
      released: releaseType === "stable", // Mark as released for stable releases
      releaseDate: new Date().toISOString().split("T")[0], // Format: YYYY-MM-DD
    };

    try {
      // Check if Fix Version exists
      const { data: existingVersions } = await axios.get(
        `${jiraHost}/rest/api/2/project/${projectId}/versions`,
        { auth: { username: jiraEmail, password: jiraApiToken } }
      );

      const existingVersion = existingVersions.find((v) => v.name === fixVersion.name);
      let versionId;

      if (existingVersion) {
        versionId = existingVersion.id;
        logger.log(`Fix Version "${fixVersion.name}" already exists.`);
      } else {
        // Create Fix Version
        const { data: newVersion } = await axios.post(
          `${jiraHost}/rest/api/2/version`,
          { ...fixVersion, project: projectId },
          { auth: { username: jiraEmail, password: jiraApiToken } }
        );
        versionId = newVersion.id;
        logger.log(`Created Fix Version "${fixVersion.name}".`);
      }

      // Update tickets with the Fix Version
      await Promise.all(
        ticketIds.map((ticketId) =>
          axios.put(
            `${jiraHost}/rest/api/2/issue/${ticketId}`,
            { fields: { fixVersions: [{ id: versionId }] } },
            { auth: { username: jiraEmail, password: jiraApiToken } }
          )
        )
      );

      logger.log(`Updated Fix Version for tickets: ${ticketIds.join(", ")}`);
    } catch (error) {
      logger.error("Failed to update Jira Fix Versions:", error.message);
      throw error;
    }
  },
};
