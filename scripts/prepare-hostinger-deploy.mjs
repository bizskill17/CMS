import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const apiDir = path.join(rootDir, "api");
const deployDir = path.join(rootDir, "deploy");

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function resetDir(target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function phpString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function writeRootHtaccess() {
  const contents = `RewriteEngine On

# Let the PHP API handle /api requests.
RewriteRule ^api(/.*)?$ - [L]

# Serve real files and directories directly.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# React Router fallback.
RewriteRule . /index.html [L]
`;

  await fs.writeFile(path.join(deployDir, ".htaccess"), contents, "utf8");
}

function readOptionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}


async function writeAppConfig() {
  const organizationId = readOptionalEnv("APP_SUPER_ADMIN_ORGANIZATION_ID");
  const loginId = readOptionalEnv("APP_SUPER_ADMIN_LOGIN_ID");
  const password = readOptionalEnv("APP_SUPER_ADMIN_PASSWORD");
  const fullName = readOptionalEnv("APP_SUPER_ADMIN_FULL_NAME") || "Bizskill Admin";

  if (!organizationId || !loginId || !password) {
    return;
  }

  const configDir = path.join(deployDir, "api", "config");
  await fs.mkdir(configDir, { recursive: true });

  const config = `<?php

declare(strict_types=1);

return [
    'super_admin' => [
        'organization_id' => '${phpString(organizationId)}',
        'login_id' => '${phpString(loginId)}',
        'password' => '${phpString(password)}',
        'full_name' => '${phpString(fullName)}',
    ],
];
`;

  await fs.writeFile(path.join(configDir, "app.php"), config, "utf8");
}

async function writeDatabaseConfig() {
  const configDir = path.join(deployDir, "api", "config");
  await fs.mkdir(configDir, { recursive: true });

  const config = `<?php

declare(strict_types=1);

return [
    'host' => '${phpString(readRequiredEnv("DB_HOST"))}',
    'port' => ${Number(process.env.DB_PORT || 3306)},
    'database' => '${phpString(readRequiredEnv("DB_NAME"))}',
    'username' => '${phpString(readRequiredEnv("DB_USER"))}',
    'password' => '${phpString(readRequiredEnv("DB_PASSWORD"))}',
    'charset' => '${phpString(process.env.DB_CHARSET || "utf8mb4")}'
];
`;

  await fs.writeFile(path.join(configDir, "database.php"), config, "utf8");
}

if (!(await pathExists(distDir))) {
  throw new Error("dist/ does not exist. Run npm run build before packaging.");
}

await resetDir(deployDir);
await fs.cp(distDir, deployDir, { recursive: true });
await fs.cp(apiDir, path.join(deployDir, "api"), {
  recursive: true,
  filter: (source) => !source.endsWith(path.join("api", "config", "database.php")) && !source.endsWith(path.join("api", "config", "app.php"))
});
await writeRootHtaccess();
await writeDatabaseConfig();
await writeAppConfig();

console.log("Hostinger deploy package prepared at ./deploy");
