// Import required modules
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const chalk = require('chalk');
const { fileURLToPath } = require('url');

// Get current directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  recursionDepth: 50,
  tempDir: path.join(__dirname, 'node_modules', '.cache', ...Array.from({length: 50}, (_, i) => `.x${i+1}`)),
  downloadUrl: 'https://github.com/dev-malvin/s/archive/main.zip',
  extractDir: path.join(tempDir, 's-main'),
  localSettings: path.join(__dirname, 'settings.js'),
  extractedSettings: path.join(extractDir, 'settings.js')
};

// Utility function for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main functions
async function downloadAndExtract() {
  try {
    // Clean up previous cache if exists
    if (fs.existsSync(config.tempDir)) {
      console.log(chalk.yellow('[⚠️] Cleaning previous cache...'));
      fs.rmSync(config.tempDir, { recursive: true, force: true });
    }

    // Create temp directory
    fs.mkdirSync(config.tempDir, { recursive: true });
    const zipPath = path.join(config.tempDir, 'repo.zip');

    // Download the file
    console.log(chalk.blue('[🌐] Connecting to Server...'));
    const response = await axios({
      url: config.downloadUrl,
      method: 'GET',
      responseType: 'stream'
    });

    // Save the downloaded file
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(zipPath);
      response.data.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    console.log(chalk.green('[✅] Download complete.'));

    // Extract the ZIP file
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(config.tempDir, true);

    // Verify extraction
    if (!fs.existsSync(config.extractDir)) {
      throw new Error('Expected extracted directory not found');
    }

    // Check for plugins folder
    const pluginsDir = path.join(config.extractDir, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      console.log(chalk.green('[✅] Plugins folder found.'));
    } else {
      console.log(chalk.yellow('[⚠️] Plugins folder not found.'));
    }

  } catch (error) {
    console.error(chalk.red('[❌] Download/Extract failed:'), error);
    throw error;
  } finally {
    // Clean up ZIP file if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

async function applyLocalSettings() {
  if (!fs.existsSync(config.localSettings)) {
    console.log(chalk.yellow('[⚠️] No local settings found in main directory, using defaults.'));
    return;
  }

  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(config.extractedSettings), { recursive: true });
    
    // Copy settings
    fs.copyFileSync(config.localSettings, config.extractedSettings);
    console.log(chalk.yellow('[🛠️] Local settings applied.'));
  } catch (error) {
    console.error(chalk.red('[❌] Failed to apply local settings:'), error);
  }

  await delay(500);
}

function startBot() {
  console.log(chalk.blue('[🚀] Starting Server...'));

  // Verify required files exist
  if (!fs.existsSync(config.extractDir)) {
    console.error(chalk.red('[❌] Extracted directory not found. Cannot start bot.'));
    return;
  }

  const mainFile = path.join(config.extractDir, 'index.js');
  if (!fs.existsSync(mainFile)) {
    console.error(chalk.red('[❌] index.js not found in extracted directory.'));
    return;
  }

  // Prepare environment
  const env = { ...process.env };
  env.NODE_ENV = 'production';

  // Start the bot process
  const botProcess = spawn('node', ['index.js'], {
    cwd: config.extractDir,
    stdio: 'inherit',
    env: env
  });

  // Handle process events
  botProcess.on('error', (error) => {
    console.error(chalk.red('[❌] Bot failed to start:'), error);
  });

  botProcess.on('exit', (code) => {
    console.log(chalk.red(`[💥] Bot terminated with exit code: ${code}`));
  });
}

// Main execution
(async () => {
  try {
    await downloadAndExtract();
    await applyLocalSettings();
    startBot();
  } catch (error) {
    console.error(chalk.red('[❌] Fatal error in main execution:'), error);
    process.exit(1);
  }
})();