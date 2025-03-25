/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemID, PartialFetchOperations, PartialFetchTarget, isObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { getAccountFetchTargets, apiNameSync, isCustomObjectSync } from './filters/utils'
import { SALESFORCE } from './constants'

const log = logger(module)
const { awu } = collections.asynciterable
const { isDefined } = values

export const METADATA_TYPES_GROUP = 'metadataTypes'
export const OBJECTS_GROUP = 'objects'
export const METADATA_TYPES_PATH: string[] = []
export const OBJECTS_PATH = ['Custom Objects']

export const getAllTargets: PartialFetchOperations['getAllTargets'] = async ({ elementsSource, getAlias }) => {
  const { customObjects, metadataTypes } = await getAccountFetchTargets({ elementsSource, accountName: SALESFORCE })
  const metadataTypeTargets = await awu(metadataTypes)
    .map(async type => ({
      group: METADATA_TYPES_GROUP,
      name: type,
      path: METADATA_TYPES_PATH.concat((await getAlias(new ElemID(SALESFORCE, type))) ?? type),
    }))
    .toArray()
  const customObjectTargets = await awu(customObjects)
    .map(async object => ({
      group: OBJECTS_GROUP,
      name: object,
      path: OBJECTS_PATH.concat((await getAlias(new ElemID(SALESFORCE, object))) ?? object),
    }))
    .toArray()
  const sortedMetadataTypeTargets = _.sortBy(metadataTypeTargets, target => target.name)
  const sortedCustomObjectTargets = _.sortBy(customObjectTargets, target => target.name)

  return sortedCustomObjectTargets.concat(sortedMetadataTypeTargets)
}

export const getTargetsForElements: PartialFetchOperations['getTargetsForElements'] = async ({
  elemIds,
  elementsSource,
}) => {
  const typeNames = _.uniq(elemIds.map(id => id.typeName))
  log.debug('targeted fetch types: %s', typeNames.join(', '))
  return awu(typeNames)
    .map(typeName => elementsSource.get(new ElemID(SALESFORCE, typeName)))
    .filter(isObjectType)
    .map<PartialFetchTarget | undefined>(element => {
      const name = apiNameSync(element)
      if (name === undefined) {
        log.warn('element has no api name: %s', element.elemID.getFullName())
        return undefined
      }
      return isCustomObjectSync(element) ? { group: OBJECTS_GROUP, name } : { group: METADATA_TYPES_GROUP, name }
    })
    .filter(isDefined)
    .toArray()
}
