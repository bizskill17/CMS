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

async function removeIfExists(filePath) {
  await fs.rm(filePath, { force: true });
}

await resetDir(deployDir);
await copyDir(distDir, deployDir);
await copyDir(apiDir, path.join(deployDir, "api"));
await fs.copyFile(path.join(hostingDir, "root.htaccess"), path.join(deployDir, ".htaccess"));
await removeIfExists(path.join(deployDir, "api", "config", "database.php"));

console.log("Deploy package prepared at ./deploy");

