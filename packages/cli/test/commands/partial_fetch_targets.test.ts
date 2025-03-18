/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EOL } from 'os'
import * as coreApi from '@salto-io/core'
import { CliExitCode } from '../../src/types'
import { listAction, getAction } from '../../src/commands/partial_fetch_targets'
import { mockCliArgs, MockCliArgs, mockCliCommandArgs, MockCliOutput, mockWorkspace, MockWorkspace } from '../mocks'
import { header } from '../../src/formatter'

const commandName = 'partial-fetch-targets'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  getAccountPartialFetchTargets: jest.fn(),
  getPartialFetchTargetsForElements: jest.fn(),
}))

const mockedCore = jest.mocked(coreApi)

describe('partial-fetch-targets commands', () => {
  let cliArgs: MockCliArgs
  let output: MockCliOutput
  let workspace: MockWorkspace

  beforeEach(() => {
    cliArgs = mockCliArgs()
    output = cliArgs.output
    workspace = mockWorkspace({
      accounts: ['account1', 'account2'],
    })

    mockedCore.getAccountPartialFetchTargets.mockResolvedValue([
      { group: 'group1', name: 'target1', path: ['path1', 'subpath1'] },
      { group: 'group2', name: 'target2', path: ['path1', 'subpath2'] },
    ])

    mockedCore.getPartialFetchTargetsForElements.mockResolvedValue({
      account1: [
        { group: 'group1', name: 'target1' },
        { group: 'group1', name: 'target2' },
      ],
      account2: [
        { group: 'group1', name: 'target1' },
        { group: 'group1', name: 'target2' },
      ],
    })
  })

  describe('list partial fetch targets', () => {
    describe('with given account', () => {
      beforeEach(async () => {
        await listAction({
          ...mockCliCommandArgs(commandName, cliArgs),
          input: {
            accounts: ['account1'],
          },
          workspace,
        })
      })

      it('should print the targets tree of the given account', () => {
        expect(output.stdout.content).toContain(
          [
            header('Partial fetch targets for the "account1" account:'),
            '○ path1',
            '  ○ subpath1 (group1:target1)',
            '  ○ subpath2 (group2:target2)',
          ].join(EOL),
        )
        expect(output.stdout.content).not.toContain('account2')
      })
    })

    describe('with no given account', () => {
      beforeEach(async () => {
        await listAction({
          ...mockCliCommandArgs(commandName, cliArgs),
          input: {},
          workspace,
        })
      })

      it('should print the targets tree for all accounts', () => {
        expect(output.stdout.content).toContain(
          [
            header('Partial fetch targets for the "account1" account:'),
            '○ path1',
            '  ○ subpath1 (group1:target1)',
            '  ○ subpath2 (group2:target2)',
          ].join(EOL),
        )
        expect(output.stdout.content).toContain(
          [
            header('Partial fetch targets for the "account2" account:'),
            '○ path1',
            '  ○ subpath1 (group1:target1)',
            '  ○ subpath2 (group2:target2)',
          ].join(EOL),
        )
      })
    })

    describe('with no targets available', () => {
      beforeEach(async () => {
        mockedCore.getAccountPartialFetchTargets.mockResolvedValue([])
        await listAction({
          ...mockCliCommandArgs(commandName, cliArgs),
          input: {
            accounts: ['account1'],
          },
          workspace,
        })
      })

      it('should print no targets message', () => {
        expect(output.stdout.content).toContain('account1: No partial fetch targets available')
      })
    })
  })

  describe('get partial fetch targets', () => {
    describe('with valid selectors', () => {
      let result: CliExitCode

      beforeEach(async () => {
        result = await getAction({
          ...mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['account1.type', 'account2.type'],
          },
          workspace,
        })
      })

      it('should return success exit code', () => {
        expect(result).toEqual(CliExitCode.Success)
      })

      it('should print the targets for each account', () => {
        expect(output.stdout.content).toContain('account1:group1:target1')
        expect(output.stdout.content).toContain('account1:group1:target2')
        expect(output.stdout.content).toContain('account2:group1:target1')
        expect(output.stdout.content).toContain('account2:group1:target2')
      })
    })

    describe('with invalid selectors', () => {
      let result: CliExitCode

      beforeEach(async () => {
        result = await getAction({
          ...mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['a.b.c.d'],
          },
          workspace,
        })
      })

      it('should return user input error', () => {
        expect(result).toEqual(CliExitCode.UserInputError)
      })

      it('should print error message', () => {
        expect(output.stderr.content).toContain('Failed to created element ID')
      })
    })
  })
})
