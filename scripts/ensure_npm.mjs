const userAgent = process.env.npm_config_user_agent || '';
const isNpm = process.env.npm_execpath?.includes('npm-cli.js');

if (!isNpm) {
  console.error(`
⛔ This project requires npm for dependency management
   It looks like you're using a different package manager (possibly "${userAgent}")
   Using different package managers can cause problem and generate different / incorrect package lock files.

💡 Please use "npm install" instead
`);
  process.exit(1);
}
