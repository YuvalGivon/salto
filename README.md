# Salto Base
[![Knuckles](bnw-face.png)](https://github.com/salto-io/salto-base/blob/main/docs/faq.md#why-did-we-choose-knuckles-as-our-mascot)
---

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield)](https://circleci.com/gh/salto-io/salto)
TODO [![Coverage Status](https://coveralls.io/repos/github/salto-io/salto/badge.svg?branch=main)](https://coveralls.io/github/salto-io/salto?branch=main)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
---

Salto allows you to manage your SaaS applications' configuration in code. By doing so, it enables modern devops style methodologies for development, testing and deployment for these business applications.

Salto consists of 3 main components:

1. The NaCl language — a declarative configuration language (follows the syntax of [hcl](https://github.com/hashicorp/hcl/tree/hcl2)), specifically designed to describe the configuration of modern business applications.
2. The Salto command line interface — a tool which uses NaCl files to manage the configuration of business applications, with operations such as `deploy` (to deploy configuration changes to a business application) and `fetch` (to fetch the latest state of a business application into NaCl files). This tool is composed of a core processing engine, and various adapters to interact with the different business applications.
3. The Salto vs-code extension — An extension to the popular vs-code IDE to easily interact with NaCl files.

For more information, see the [user guide](docs/user_guide.md) and the [FAQ](docs/faq.md).

To report issues or ask about using the Salto CLI - please join our public Slack channel [here](https://invite.playplay.io/invite?team_id=T011W61EVHD).

### Using Github Packages

> ⚠️ NOTE: All packages in the `@salto-io` namespace must be installed from Github Packages. 
> This is a limitation of `yarn`, where we cannot mix packages from different registries within the same namespace.
> See https://github.com/yarnpkg/berry/issues/1455

#### Authenticate to Github Packages

In order to use the private `salto-base` repo, you'd need to setup the Github Packages authentication method.

  1. [Generate a CLASSIC personal access token in Github](https://github.com/settings/tokens)
    * Give it the scope or `read:packages`
    * Name is how you'd like to. For example: `NPM read only token`
  2. Export this variable however you're used to. Remember, this is a **private** token. Name it `GITHUB_PAT_PACKAGES`
    * See `./yarnrc.yml`

If you're using `npm` you should also setup `~/.npmrc`. It should look like this:

```ini
@salto-io:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=$TOKEN
```

#### Migrate packages from npmjs to Github Packages

In the meantime, whenever you're publishing some supporting package, such as `@salto-io/node-diff3`,
we need to publish it to Github Packages.
It looks like this:

```bash
$ npm pack @salto-io/node-diff3@$VERSION # this will download a tgz file with the npm package content
$ tar -zxvf node-diff3-$VERSION.tgz
$ cd package

# edit the package.json file, bump/change the version number
# add to the package.json file:
# "publishConfig": {
#   "access": "private",
#   "registry": "https://npm.pkg.github.com/"
# },
# in package.json, remove the "repository" field

$ npm publish --registry=https://npm.pkg.github.com
```

This is a temporary solution until we're publishing all packages to Github Packages dirteclty.

### Installing salto

#### CLI

Please head to our [releases](https://github.com/salto-io/salto/releases) page.
There you'll find prebuilt binaries for major OSes (MacOS, Linux, Windows).

#### VSCode extension

See [the vscode package documentation](packages/vscode/README.md#installation)

### Running using docker

```bash
docker build --tag salto-cli .
docker run salto-cli
```

### Building from source

  1. Install Node.js 18.9.0. You can download it directly from [here](https://nodejs.org/en/download/releases/), or use [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) (simply run `nvm use`) to install it.
  2. Run Corepack: `corepack enable` to install and set up the relevant yarn version
  3. Verify Yarn and Node.js versions using `node -v` (should be 18.9.x) and `yarn -v` (should be 3.1.0)
  4. Fetch dependencies and build:

```bash
$ yarn
$ yarn build
```

### Running tests

```bash
$ yarn test
```

### E2E tests

By default, `yarn test` will run only unit tests - stored at the `tests` directory of each package.

E2E (end-to-end) tests are stored at the `e2e_tests` directories. To run them, define the `RUN_E2E_TESTS=1` environment variable:

```bash
RUN_E2E_TESTS=1 yarn test
```

E2E tests are run on CircleCI builds, and you should also run them locally before creating a PR.

**Important** E2E tests for the `cli` and `salesforce-adapter` need [valid SFDC credentials](packages/salesforce-adapter/README.md#E2E-tests) to run.

### Creating a release

_Salto_ is versioned using the [semantic versioning scheme](https://semver.org/). Therefore, when composing a new
release, we would:

  1. Bump the version in the packages' `package.json` files. For that, we're using `lerna`
  2. Tag the git repository with the new version
  3. Publish the packages in this repo to [Github Packages](https://github.com/salto-io/salto-base/packages)
  3. Build artifacts and attach them to a new [release in this repository](https://github.com/salto-io/salto-base/releases)

Here is how to do it:

#### TL;DR Quick method

Install [GitHub CLI](https://cli.github.com) and configure it (for example by running `gh pr status`).
Make sure you're on `main`, no local changes, CI status is passing, and run:

```bash
yarn lerna-version-pr [BUMP]
```

Where BUMP is a [lerna version](https://github.com/lerna/lerna/tree/main/commands/version#usage); default is  `patch`

This will create a [PR labeled `VERSION`](https://github.com/salto-io/salto-base/pulls?q=is%3Apr+label%3AVERSION). Once the PR is merged, the version will be published and a git tag will be created.

#### Create a PR manually

##### 1. Create a new version

```bash
yarn lerna-version [BUMP]
```

##### 2. Commit and push the version to git

Submit a PR and have it merged.

Once the PR is merged, the version will be published and a git tag will be created.

### Usage instructions

See READMEs of individual packages under the `packages` directory.

### License
[Licensed under the Salto Terms of Use](LICENSE)
