# Laravel VM-based Deployment Action

This action is geared toward the deployment steps for installing a Laravel application to a 
VM-based application server.  An artifact in the form of a tarball must be created in a worklow
prior to using this action.  This action is only intended to run on a self-hosted runner.
Also, unlike the Bamboo-based deployments, this action does not attempt to deal with application 
storage (e.g. logs, cache, files).  It is recommended that a storage directory be created outside 
the versions root on the VM and the application configured to redirect all storage to that location.

## Inputs

### `user`

**Required** The username under which to execute SCP/SSH operations.

### `host`

**Required** The hostname of the VM to which to deploy the code.

### `versionsRoot`

**Required** The path to the deployment directories.  Example: `/www/vhosts/{domain}/versions`

### `version`

The name of the version to deploy.  Default: sha value of the commit triggering the workflow.

### `artisanCommands`

A pipe-delimited list of artisan commands to run after the deployment.  Example: `clear-compiled|migrate|optimize`

### `writableDirectories`

A pipe-delimited list of paths relative to the application root that need to be writable by the web server. Example: `storage` for Laravel, `application/cache|application/logs` for Kohana.

### `artifact`

The path to the deployable tarball.  Default: `./artifact.tar.gz`

### `numberOfVersionsToKeep`

The number of versions to keep on the target VM.  The most recent number of configured versions will be kept.
All others will be removed.  The default behavior is to not remove anything.  This can also be achieved with 
an explicit value of `"0"`

### `postDeploymentCommands`

A pipe-delimited list of commands to run after the deployment.  These will be run in the directory to which 
the code was deployed.

## Example usage

```
uses: brownuniversity/laravel-vm-deployment-action@v1
with:
    user: "cibot"
    host: "appserver.services.brown.edu"
    versionsRoot: "/www/vhosts/appserver.services.brown.edu/versions"
    version:"v1.0.0"
    artisanCommands: "config:cache|migrate"
    postDeploymentCommands: "sudo supervisorctl restart foo-worker"
    writableDirectories: "storage"
    artifact: "some-other-tarball.tar.gz"
    numberOfVersionsToKeep: 5
```

## Publishing

Be sure to run `make compile` and commit the changes to the resultant `dist/index.js` file prior to tagging a new release.