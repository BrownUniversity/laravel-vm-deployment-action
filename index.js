const core = require("@actions/core");
const exec = require("@actions/exec");

function getRequiredInput(input) {
  const capturedInput = core.getInput(input);
  if (capturedInput === null || capturedInput === "") {
    core.setFailed(`Action failed, unable to get required input: ${input}`);
  }

  return capturedInput;
}

function parseArrayFromPipeDelimitedString(pipeDelimitedString) {
  return pipeDelimitedString.split("|").filter(x => x !== "");
}

function getOptions() {
  return {
    user: getRequiredInput("user"),
    host: getRequiredInput("host"),
    versionsRoot: getRequiredInput("versionsRoot"),
    version: core.getInput("version") || process.env.GITHUB_SHA || "",
    key: getRequiredInput("key"),
    artisanCommands: parseArrayFromPipeDelimitedString(
      core.getInput("artisanCommands")
    ),
    writableDirectories: parseArrayFromPipeDelimitedString(
      core.getInput("writableDirectories")
    ),
    artifact: core.getInput("artifact"),
    versionsToKeep: core.getInput("numberOfVersionsToKeep") || 0,
    postDeploymentCommands: parseArrayFromPipeDelimitedString(
      core.getInput("postDeploymentCommands")
    )
  };
}

async function executeCall(call, options = {}) {
  try {
    await exec.exec(call, [], options);
  } catch (e) {
    core.setFailed(`Action failed ${e}`);
  }
}

async function executeSSH({ key, user, host }, command, execOptions = {}) {
  await executeCall(`ssh -i ${key} ${user}@${host} ${command}`, execOptions);
}

async function executeSCP({ key }, source, destination) {
  await executeCall(`scp -i ${key} ${source} ${destination}`);
}

async function ensureTargetDirectoryExists(options) {
  const path = `${options.versionsRoot}/${options.version}`;
  await executeSSH(options, `rm -fr ${path}`);
  await executeSSH(options, `mkdir -p ${path}`);
}

async function deployArtifact(options) {
  const { artifact, user, host, versionsRoot } = options;
  const source = artifact;
  const destination = `${user}@${host}:${versionsRoot}`;
  await executeSCP(options, source, destination);
}

async function explodeTarball(options) {
  const { artifact, version, versionsRoot } = options;
  await executeSSH(
    options,
    `tar -xzf ${versionsRoot}/${artifact} -C ${versionsRoot}/${version}`
  );
}

async function removeArtifact(options) {
  const { artifact, versionsRoot } = options;
  await executeSSH(options, `rm -f ${versionsRoot}/${artifact}`);
}

async function updateVersionDirectoryTimeStamp(options) {
  const path = `${options.versionsRoot}/${options.version}`;
  await executeSSH(options, `touch --date="now" ${path}`);
}

async function setTargetPermissions(options) {
  const { versionsRoot, version } = options;
  const path = `${versionsRoot}/${version}`;
  await executeSSH(options, `chmod -R 770 ${path}`);
  /* eslint-disable no-restricted-syntax */
  for (const dir of options.writableDirectories) {
    // eslint-disable-next-line no-await-in-loop
    await executeSSH(
      options,
      `stat ${path}/${dir} >/dev/null && chmod -R 775 ${path}/${dir}`
    );
  }
}

async function executeArtisan(options) {
  const { versionsRoot, version } = options;
  /* eslint-disable no-restricted-syntax */
  for (const command of options.artisanCommands) {
    // eslint-disable-next-line no-await-in-loop
    await executeSSH(
      options,
      `cd ${versionsRoot}/${version}; php artisan ${command}`
    );
  }
  /* eslint-enable no-restricted-syntax */
}

async function executePostDeploymentCommands(options) {
  const { versionsRoot, version } = options;
  /* eslint-disable no-restricted-syntax */
  for (const command of options.postDeploymentCommands) {
    // eslint-disable-next-line no-await-in-loop
    await executeSSH(options, `cd ${versionsRoot}/${version}; ${command}`);
  }
  /* eslint-enable no-restricted-syntax */
}

async function updateSymlink(options) {
  const { version, versionsRoot } = options;
  await executeSSH(options, `rm -f ${versionsRoot}/current`);
  await executeSSH(
    options,
    `ln -s ${versionsRoot}/${version} ${versionsRoot}/current`
  );
}

async function removeOldVersions(options) {
  const { versionsToKeep, versionsRoot } = options;
  if (versionsToKeep === 0) {
    return;
  }

  let output = "";
  const execOptions = {};
  execOptions.listeners = {
    stdout: data => {
      output += data.toString();
    }
  };
  await executeSSH(options, `ls -t ${versionsRoot}`, execOptions);

  const rawDirs = output.split(/\s+/).filter(dir => dir !== "current");
  rawDirs.splice(-1, 1);
  if (rawDirs.length <= versionsToKeep) {
    return;
  }
  const dirsToRemove = rawDirs.slice(versionsToKeep);
  /* eslint-disable no-restricted-syntax */
  for (const dir of dirsToRemove) {
    // eslint-disable-next-line no-await-in-loop
    await executeSSH(options, `rm -fr ${versionsRoot}/${dir}`);
  }
  /* eslint-enable no-restricted-syntax */
}

async function main() {
  const options = getOptions();
  await ensureTargetDirectoryExists(options);
  await deployArtifact(options);
  await explodeTarball(options);
  await removeArtifact(options);
  await updateVersionDirectoryTimeStamp(options);
  await setTargetPermissions(options);
  await executeArtisan(options);
  await executePostDeploymentCommands(options);
  await updateSymlink(options);
  await removeOldVersions(options);
}

main();
