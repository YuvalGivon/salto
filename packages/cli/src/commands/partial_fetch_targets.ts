/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { adapterCreators } from '@salto-io/adapter-creators'
import { getAccountPartialFetchTargets, getPartialFetchTargetsForElements } from '@salto-io/core'
import { createElementSelectors, selectElementIdsByTraversal } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { outputLine, errorOutputLine } from '../outputer'
import { WorkspaceCommandAction, createCommandGroupDef, createWorkspaceCommand } from '../command_builder'
import { CliExitCode } from '../types'
import {
  formatAccountPartialFetchTargets,
  formatAccountPartialFetchTargetsWithPath,
  formatInvalidFilters,
} from '../formatter'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'
import { ACCOUNTS_OPTION, AccountsArg } from './common/accounts'

const { awu } = collections.asynciterable

const PARTIAL_FETCH_TARGET_SEPARATOR = ':'

type ListPartialFetchTargetsArgs = AccountsArg & EnvArg

export const listAction: WorkspaceCommandAction<ListPartialFetchTargetsArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { accounts = workspace.accounts() } = input

  await validateAndSetEnv(workspace, input, output)

  await awu(accounts).forEach(async account => {
    const targets = await getAccountPartialFetchTargets({ workspace, account, adapterCreators })
    outputLine(formatAccountPartialFetchTargetsWithPath(account, targets ?? [], PARTIAL_FETCH_TARGET_SEPARATOR), output)
  })

  return CliExitCode.Success
}

const listPartialFetchTargetsDef = createWorkspaceCommand({
  properties: {
    name: 'list',
    description: 'List the targets for a partial fetch',
    keyedOptions: [ACCOUNTS_OPTION, ENVIRONMENT_OPTION],
  },
  action: listAction,
})

type GetPartialFetchTargetsArgs = EnvArg & {
  selectors: string[]
}

export const getAction: WorkspaceCommandAction<GetPartialFetchTargetsArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { validSelectors, invalidSelectors } = createElementSelectors(input.selectors)
  if (invalidSelectors.length > 0) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  await validateAndSetEnv(workspace, input, output)

  const elemIds = await awu(
    await selectElementIdsByTraversal({
      selectors: validSelectors,
      source: await workspace.elements(),
      referenceSourcesIndex: await workspace.getReferenceSourcesIndex(),
    }),
  ).toArray()

  const targetsByAccount = await getPartialFetchTargetsForElements({ elemIds, workspace, adapterCreators })

  Object.entries(targetsByAccount).forEach(([account, targets]) => {
    outputLine(formatAccountPartialFetchTargets(account, targets ?? [], PARTIAL_FETCH_TARGET_SEPARATOR), output)
  })

  return CliExitCode.Success
}

const getPartialFetchTargetsDef = createWorkspaceCommand({
  properties: {
    name: 'get',
    description: 'Get the partial fetch targets for selected elements',
    keyedOptions: [ENVIRONMENT_OPTION],
    positionalOptions: [
      {
        name: 'selectors',
        type: 'stringsList',
        required: true,
      },
    ],
  },
  action: getAction,
})

const partialFetchTargetsGroupDef = createCommandGroupDef({
  properties: {
    name: 'partial-fetch-targets',
    description: 'Manage the partial fetch targets',
  },
  subCommands: [listPartialFetchTargetsDef, getPartialFetchTargetsDef],
})

export default partialFetchTargetsGroupDef
