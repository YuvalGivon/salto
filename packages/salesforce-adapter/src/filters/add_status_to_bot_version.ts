/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  CORE_ANNOTATIONS,
  BuiltinTypes,
  createRefToElmWithValue,
  Field,
  InstanceElement,
  Change,
  isAdditionOrModificationChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import {
  BOT_METADATA_TYPE,
  BOT_VERSION_METADATA_TYPE,
  BOT_VERSION_STATUS_FIELD,
  INSTANCE_FULL_NAME_FIELD,
} from '../constants'
import { apiNameSync, findObjectType, isInstanceOfTypeSync } from './utils'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'

const { toArrayAsync } = collections.asynciterable
const { DefaultMap } = collections.map
const log = logger(module)
const CHUNK_SIZE = 200

type BotVersionInstance = {
  fullName: string
  status?: string
}

type BotInstance = InstanceElement & {
  value: {
    botVersions: Array<BotVersionInstance>
  }
}

type ValidRecord = {
  BotDefinition: {
    DeveloperName: string
  }
  DeveloperName: string
  Status: string
}

const isValidRecord = (record: unknown): record is ValidRecord =>
  [['BotDefinition', 'DeveloperName'], 'DeveloperName', 'Status'].every(
    field => _.get(record, field) !== undefined && _.isString(_.get(record, field)),
  )

type BotVersionsStatusMap = collections.map.DefaultMap<string, Map<string, string>>

const isBotInstance = (element: Element): element is BotInstance =>
  isInstanceOfTypeSync(BOT_METADATA_TYPE)(element) &&
  Array.isArray(element.value.botVersions) &&
  element.value.botVersions.every(version => _.isString(_.get(version, INSTANCE_FULL_NAME_FIELD)))

const createBotVersionToStatus = async (
  client: SalesforceClient,
  bots: BotInstance[],
): Promise<BotVersionsStatusMap> => {
  const originalBotVersionsStatusesByBotName: BotVersionsStatusMap = new DefaultMap<string, Map<string, string>>(
    () => new Map(),
  )
  const botsNames = bots.map(bot => bot.value.fullName)
  const chunkedBotVersionsStatusQuery = async (botsNamesChunk: string[]): Promise<SalesforceRecord[]> => {
    const query = `SELECT BotDefinition.DeveloperName, DeveloperName, Status
FROM BotVersion
WHERE BotDefinition.DeveloperName IN ('${botsNamesChunk.join("', '")}')`
    return (await toArrayAsync(await client.queryAll(query, false))).flat()
  }
  const results = (await Promise.all(_.chunk(botsNames, CHUNK_SIZE).map(chunkedBotVersionsStatusQuery))).flat()
  results.forEach(record => {
    if (!isValidRecord(record)) {
      log.debug('Unexpected record values: %s', record)
      return
    }
    const botName = record.BotDefinition.DeveloperName
    const versionName = record.DeveloperName
    const status = record.Status
    originalBotVersionsStatusesByBotName.get(botName).set(versionName, status)
  })
  const botsWithNoRecords = botsNames.filter(botName => !originalBotVersionsStatusesByBotName.has(botName))
  if (botsWithNoRecords.length > 0) {
    log.warn('No BotVersion records found for the following bots: %s', botsWithNoRecords.join(', '))
  }
  return originalBotVersionsStatusesByBotName
}

const removeBotVersionStatuses = (bot: BotInstance, botVersionsStatusesByBotName: BotVersionsStatusMap): void => {
  const botName = apiNameSync(bot) ?? ''
  bot.value.botVersions.forEach(version => {
    if (version.status !== undefined) {
      botVersionsStatusesByBotName.get(botName).set(version.fullName, version.status)
      delete version.status
    }
  })
}

const addBotVersionStatuses = (bot: BotInstance, botVersionsStatusesByBotName: BotVersionsStatusMap): void => {
  const botName = apiNameSync(bot) ?? ''
  bot.value.botVersions.forEach(version => {
    const versionStatus = botVersionsStatusesByBotName.getOrUndefined(botName)?.get(version.fullName)
    if (versionStatus !== undefined) {
      version.status = versionStatus
    }
  })
}

const filter: FilterCreator = ({ client }) => {
  const preDeployBotVersionsStatusesByBotName: BotVersionsStatusMap = new DefaultMap<string, Map<string, string>>(
    () => new Map(),
  )
  return {
    name: 'addStatusToBotVersionFilter',
    onFetch: async (elements: Element[]) => {
      if (!client) {
        return
      }
      const botVersionType = findObjectType(elements, BOT_VERSION_METADATA_TYPE)
      if (botVersionType === undefined) {
        return
      }
      botVersionType.fields.status = new Field(
        botVersionType,
        BOT_VERSION_STATUS_FIELD,
        createRefToElmWithValue(BuiltinTypes.STRING),
        {
          [CORE_ANNOTATIONS.CREATABLE]: false,
          [CORE_ANNOTATIONS.UPDATABLE]: false,
          [CORE_ANNOTATIONS.DELETABLE]: false,
        },
      )
      const bots = elements.filter(isBotInstance)
      const botVersionsStatusesByBotName: BotVersionsStatusMap = await createBotVersionToStatus(client, bots)
      bots.forEach(bot => addBotVersionStatuses(bot, botVersionsStatusesByBotName))
    },
    preDeploy: async (changes: Change[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isBotInstance)
        .forEach(bot => removeBotVersionStatuses(bot, preDeployBotVersionsStatusesByBotName)),
    onDeploy: async (changes: Change[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isBotInstance)
        .forEach(bot => addBotVersionStatuses(bot, preDeployBotVersionsStatusesByBotName)),
  }
}

export default filter
