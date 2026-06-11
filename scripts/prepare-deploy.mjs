import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const apiDir = path.join(rootDir, "api");
const deployDir = path.join(rootDir, "deploy");
const hostingDir = path.join(rootDir, "hosting");

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

function getDatabaseConfigFromEnv() {
  const host = readEnv("HOSTINGER_DB_HOST", "DB_HOST");
  const port = readEnv("HOSTINGER_DB_PORT", "DB_PORT") || "3306";
  const database = readEnv("HOSTINGER_DB_NAME", "HOSTINGER_DB_DATABASE", "DB_NAME", "DB_DATABASE");
  const username = readEnv("HOSTINGER_DB_USER", "HOSTINGER_DB_USERNAME", "DB_USER", "DB_USERNAME");
  const password =
    readEnv("HOSTINGER_DB_PASSWORD", "DB_PASSWORD") || process.env.HOSTINGER_DB_PASSWORD || process.env.DB_PASSWORD || "";
  const charset = readEnv("HOSTINGER_DB_CHARSET", "DB_CHARSET") || "utf8mb4";

  if (!host || !database || !username || !password) {
    return null;
  }

  return { host, port, database, username, password, charset };
}

async function ensureDeployDatabaseConfig() {
  const targetPath = path.join(deployDir, "api", "config", "database.php");
  const envConfig = getDatabaseConfigFromEnv();

  if (envConfig) {
    const phpConfig = `<?php

declare(strict_types=1);

return [
    'host' => '${envConfig.host}',
    'port' => ${Number(envConfig.port) || 3306},
    'database' => '${envConfig.database}',
    'username' => '${envConfig.username}',
    'password' => '${envConfig.password.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}',
    'charset' => '${envConfig.charset}',
];
`;

    await fs.writeFile(targetPath, phpConfig, "utf8");
    console.log("Generated deploy/api/config/database.php from environment variables.");
    return;
  }

  if (await pathExists(targetPath)) {
    console.log("Keeping existing api/config/database.php in deploy package.");
    return;
  }

  throw new Error(
    "No database config was bundled. Set HOSTINGER_DB_HOST, HOSTINGER_DB_NAME, HOSTINGER_DB_USER, and HOSTINGER_DB_PASSWORD, or provide equivalent DB_* secrets."
  );
}

await resetDir(deployDir);
await copyDir(distDir, deployDir);
await copyDir(apiDir, path.join(deployDir, "api"));
await fs.copyFile(path.join(hostingDir, "root.htaccess"), path.join(deployDir, ".htaccess"));
await ensureDeployDatabaseConfig();

console.log("Deploy package prepared at ./deploy");

