/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ObjectType, ElemID } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getAccountFetchTargets } from '../src/filters/utils'
import {
  getAllTargets,
  getTargetsForElements,
  METADATA_TYPES_GROUP,
  OBJECTS_GROUP,
  METADATA_TYPES_PATH,
  OBJECTS_PATH,
} from '../src/fetch_targets'
import { SALESFORCE, API_NAME, CUSTOM_OBJECTS_LOOKUPS_FIELD, CUSTOM_OBJECT_ALIASES_FIELD } from '../src/constants'
import { createCustomObjectType } from './utils'
import { createInstanceElement } from '../src/transformers/transformer'

jest.mock('../src/filters/utils', () => ({
  ...jest.requireActual('../src/filters/utils'),
  getAccountFetchTargets: jest.fn(),
}))

describe('fetch targets', () => {
  describe('getAllTargets', () => {
    const mockMetadataTypes = ['Type1', 'Type2']
    const mockCustomObjects = ['Object1', 'Object2']
    beforeEach(() => {
      jest.mocked(getAccountFetchTargets).mockResolvedValue({
        metadataTypes: mockMetadataTypes,
        customObjects: mockCustomObjects,
        [CUSTOM_OBJECTS_LOOKUPS_FIELD]: {},
        [CUSTOM_OBJECT_ALIASES_FIELD]: {
          Object1: 'Object1 Alias',
          Type1: 'Type1 Alias',
        },
      })
    })
    it('should return metadata types and custom objects targets', async () => {
      const result = await getAllTargets({
        elementsSource: buildElementsSourceFromElements([]),
        getAlias: async _id => {
          throw new Error('Should not be invoked')
        },
      })

      expect(result).toIncludeSameMembers([
        { group: METADATA_TYPES_GROUP, name: 'Type1', path: METADATA_TYPES_PATH.concat('Type1') },
        { group: METADATA_TYPES_GROUP, name: 'Type2', path: METADATA_TYPES_PATH.concat('Type2') },
        { group: OBJECTS_GROUP, name: 'Object1', path: OBJECTS_PATH.concat('Object1 Alias') },
        { group: OBJECTS_GROUP, name: 'Object2', path: OBJECTS_PATH.concat('Object2') },
      ])
    })
  })

  describe('getTargetsForElements', () => {
    it('should return targets for custom objects and metadata types', async () => {
      const customObjectType = createCustomObjectType('CustomObject__c', {})
      const metadataType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'MetadataType'),
        annotations: { [API_NAME]: 'MetadataType' },
      })
      const metadataInstance = createInstanceElement({ fullName: 'TestInstance' }, metadataType)

      const result = await getTargetsForElements({
        elemIds: [customObjectType.elemID, metadataType.elemID, metadataInstance.elemID],
        elementsSource: buildElementsSourceFromElements([customObjectType, metadataType]),
      })

      expect(result).toEqual([
        { group: OBJECTS_GROUP, name: 'CustomObject__c' },
        { group: METADATA_TYPES_GROUP, name: 'MetadataType' },
      ])
    })

    it('should filter out elements without api name', async () => {
      const elementWithoutApiName = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'TestElement'),
      })

      const result = await getTargetsForElements({
        elemIds: [elementWithoutApiName.elemID],
        elementsSource: buildElementsSourceFromElements([elementWithoutApiName]),
      })

      expect(result).toEqual([])
    })

    it('should filter out undefined elements', async () => {
      const result = await getTargetsForElements({
        elemIds: [new ElemID(SALESFORCE, 'NonExistent')],
        elementsSource: buildElementsSourceFromElements([]),
      })

      expect(result).toEqual([])
    })
  })
})
