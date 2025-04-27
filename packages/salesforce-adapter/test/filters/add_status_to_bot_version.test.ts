/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, Change, Element, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { createInstanceElement, createMetadataObjectType } from '../../src/transformers/transformer'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import filterCreator from '../../src/filters/add_status_to_bot_version'
import { BOT_METADATA_TYPE, BOT_VERSION_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'
import { FilterWith } from './mocks'
import { SalesforceClient } from '../../index'
import { mockTypes } from '../mock_elements'

describe('add status to bot version filter', () => {
  let client: SalesforceClient
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let bot1: InstanceElement
  let bot2: InstanceElement
  let bot3: InstanceElement

  const botVersionType = createMetadataObjectType({
    annotations: { metadataType: BOT_VERSION_METADATA_TYPE },
    fields: {
      status: { refType: BuiltinTypes.STRING },
    },
  })

  describe('onFetch', () => {
    let elements: Element[]
    const BOT1_API_NAME = 'bot1'
    const BOT2_API_NAME = 'bot2'
    const BOT3_API_NAME = 'bot3'
    beforeEach(async () => {
      const mockClientResult = mockClient()
      client = mockClientResult.client
      filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<
        'onFetch' | 'preDeploy' | 'onDeploy'
      >

      bot1 = createInstanceElement(
        {
          fullName: BOT1_API_NAME,
          botVersions: [{ fullName: 'v1' }, { fullName: 'v2' }],
        },
        mockTypes.Bot,
      )

      bot2 = createInstanceElement(
        {
          fullName: BOT2_API_NAME,
          botVersions: [{ fullName: 'v1' }],
        },
        mockTypes.Bot,
      )
      bot3 = createInstanceElement(
        {
          fullName: BOT3_API_NAME,
          botVersions: [{ fullName: 'v1' }],
        },
        mockTypes.Bot,
      )

      elements = [mockTypes.Bot, botVersionType, bot1, bot2, bot3]

      client.queryAll = jest.fn().mockImplementation(async () => [
        {
          DeveloperName: 'v1',
          Status: 'Active',
          BotDefinition: {
            DeveloperName: BOT1_API_NAME,
          },
        },
        {
          DeveloperName: 'v2',
          Status: 'Inactive',
          BotDefinition: {
            DeveloperName: BOT1_API_NAME,
          },
        },
        {
          DeveloperName: 'v1',
          Status: 'Active',
          BotDefinition: {
            DeveloperName: BOT2_API_NAME,
          },
        },
      ])
    })

    it('should add status field to bot version type', async () => {
      await filter.onFetch(elements)
      const statusField = botVersionType.fields.status
      expect(statusField).toBeDefined()
    })

    it('should add status to bot versions that returned from query', async () => {
      await filter.onFetch(elements)
      expect(bot1.value.botVersions[0].status).toBe('Active')
      expect(bot1.value.botVersions[1].status).toBe('Inactive')
      expect(bot2.value.botVersions[0].status).toBe('Active')
    })
    it('should not add status to bot versions that not returned from query', async () => {
      await filter.onFetch(elements)
      expect(bot3.value.botVersions[0].status).toBeUndefined()
    })
  })

  describe('preDeploy and onDeploy', () => {
    let changes: Change<InstanceElement>[]

    beforeEach(() => {
      const mockClientResult = mockClient()
      client = mockClientResult.client
      filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<
        'onFetch' | 'preDeploy' | 'onDeploy'
      >

      const botWithStatus = createInstanceElement(
        {
          [METADATA_TYPE]: BOT_METADATA_TYPE,
          fullName: 'testBotWithStatus',
          botVersions: [
            { fullName: 'version1', status: 'Active' },
            { fullName: 'version2', status: 'Inactive' },
          ],
        },
        mockTypes.Bot,
      )
      const botWithoutStatus = createInstanceElement(
        {
          [METADATA_TYPE]: BOT_METADATA_TYPE,
          fullName: 'testBotWithoutStatus',
          botVersions: [{ fullName: 'version1' }],
        },
        mockTypes.Bot,
      )

      changes = [toChange({ after: botWithStatus }), toChange({ after: botWithoutStatus })]
    })

    it('should remove status field on preDeploy and restore it on onDeploy', async () => {
      await filter.preDeploy(changes)
      const botPreDeploy = getChangeData(changes[0])
      expect(botPreDeploy.value.botVersions[0].status).toBeUndefined()
      expect(botPreDeploy.value.botVersions[1].status).toBeUndefined()
      await filter.onDeploy(changes)
      const botOnDeploy = getChangeData(changes[0])
      expect(botOnDeploy.value.botVersions[0].status).toBe('Active')
      expect(botOnDeploy.value.botVersions[1].status).toBe('Inactive')
    })
    it('should do nothing on Bot instance without statuses', async () => {
      await filter.preDeploy(changes)
      const botPreDeploy = getChangeData(changes[1])
      expect(botPreDeploy.value.botVersions[0].status).toBeUndefined()
      await filter.onDeploy(changes)
      const botOnDeploy = getChangeData(changes[1])
      expect(botOnDeploy.value.botVersions[0].status).toBeUndefined()
    })
  })
})
