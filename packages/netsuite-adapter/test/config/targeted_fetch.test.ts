/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  InstanceElement,
  ObjectType,
  PartialFetchTargetWithPath,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import {
  CONFIG_FEATURES,
  CURRENCY,
  CUSTOM_RECORD_TYPE,
  CUSTOM_RECORD_TYPE_NAME_PREFIX,
  EMPLOYEE,
  FILE,
  FOLDER,
  NETSUITE,
  REFERENCE_TYPE_SUFFIX,
  WORKBOOK,
  WORKFLOW,
} from '../../src/constants'
import { getAllTargets, getTargetsForElements, targetedFetchQuery } from '../../src/config/targeted_fetch'
import { folderType } from '../../src/types/file_cabinet_types'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { NetsuiteConfig } from '../../src/config/types'
import { fullQueryParams } from '../../src/config/config_creator'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { enums } from '../../src/autogen/types/enums'

describe('targeted fetch', () => {
  describe('getAllTargets', () => {
    let elementsSource: ReadOnlyElementsSource
    let aliasMap: Record<string, string>
    let config: InstanceElement
    let targets: PartialFetchTargetWithPath[]

    beforeEach(async () => {
      const customRecordType = new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord_test') })
      const customRecordTypeWithoutAlias = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord_test_no_alias'),
      })
      const standardCustomRecordType = customrecordtypeType()
      const customRecordTypeReference = new ObjectType({
        elemID: new ElemID(NETSUITE, `${CUSTOM_RECORD_TYPE_NAME_PREFIX}${REFERENCE_TYPE_SUFFIX}`),
      })
      const { customrecordtype_accesstype: enumType } = enums

      const customRecordTypeWithExcludedInstances = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord_test_excluded'),
      })

      const folder = folderType()
      const topLevelFolderInstance = new InstanceElement(naclCase('SuiteScripts'), folder)
      const folderInstance = new InstanceElement(naclCase('SuiteScripts/test'), folder)

      elementsSource = buildElementsSourceFromElements([
        customRecordType,
        customRecordTypeWithoutAlias,
        standardCustomRecordType.type,
        ...Object.values(standardCustomRecordType.innerTypes),
        customRecordTypeReference,
        enumType,
        customRecordTypeWithExcludedInstances,
        folder,
        topLevelFolderInstance,
        folderInstance,
      ])

      aliasMap = {
        [customRecordType.elemID.getFullName()]: 'Test Custom Record',
      }

      const adapterConfig: NetsuiteConfig = {
        fetch: {
          include: fullQueryParams(),
          exclude: {
            types: [{ name: WORKBOOK }, { name: CURRENCY }, { name: CONFIG_FEATURES }],
            fileCabinet: [],
            customRecords: [{ name: 'customrecord_test_excluded' }],
          },
        },
      }

      config = new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({ elemID: new ElemID(NETSUITE, 'config') }),
        adapterConfig,
      )
    })

    describe('include targets', () => {
      beforeEach(async () => {
        targets = await getAllTargets({
          config,
          elementsSource,
          getAlias: async elemId => aliasMap[elemId.getFullName()],
        })
      })

      it('should return types targets', async () => {
        expect(targets).toContainEqual({ group: 'types', name: WORKFLOW, path: ['Workflow'] })
        expect(targets).toContainEqual({ group: 'types', name: EMPLOYEE, path: ['Employee'] })
        expect(targets).toContainEqual({
          group: 'types',
          name: SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES,
          path: ['Settings', 'User Preferences'],
        })
      })

      it('should return custom record targets', async () => {
        expect(targets).toContainEqual({
          group: 'customRecords',
          name: 'customrecord_test',
          path: ['Custom Records', 'Test Custom Record'],
        })
        expect(targets).toContainEqual({
          group: 'customRecords',
          name: 'customrecord_test_no_alias',
          path: ['Custom Records', 'customrecord_test_no_alias'],
        })
      })

      it('should return file cabinet targets', async () => {
        expect(targets).toContainEqual({
          group: 'fileCabinet',
          name: 'SuiteScripts/test',
          path: ['File Cabinet', 'SuiteScripts', 'test'],
        })
      })

      it('should omit non custom record types targets', async () => {
        expect(targets.filter(target => target.group === 'customRecords')).toEqual([
          {
            group: 'customRecords',
            name: 'customrecord_test',
            path: ['Custom Records', 'Test Custom Record'],
          },
          {
            group: 'customRecords',
            name: 'customrecord_test_no_alias',
            path: ['Custom Records', 'customrecord_test_no_alias'],
          },
        ])
      })
    })

    describe('exclude targets', () => {
      const expectedExcludedTargets = [
        { group: 'types', name: WORKBOOK, path: ['Workbook'] },
        { group: 'types', name: CURRENCY, path: ['Currency'] },
        { group: 'types', name: CONFIG_FEATURES, path: ['Settings', 'Company Features'] },
        {
          group: 'customRecords',
          name: 'customrecord_test_excluded',
          path: ['Custom Records', 'customrecord_test_excluded'],
        },
      ]

      describe('when there is a config with exclude', () => {
        beforeEach(async () => {
          targets = await getAllTargets({
            elementsSource,
            config,
            getAlias: async () => undefined,
          })
        })

        it('should exclude targets', async () => {
          expectedExcludedTargets.forEach(target => {
            expect(targets).not.toContainEqual(target)
          })
        })
      })

      describe('when there is no config', () => {
        beforeEach(async () => {
          targets = await getAllTargets({
            elementsSource,
            getAlias: async () => undefined,
          })
        })

        it('should include targets', async () => {
          expectedExcludedTargets.forEach(target => {
            expect(targets).toContainEqual(target)
          })
        })
      })
    })
  })

  describe('getTargetsForElements', () => {
    let elementsSource: ReadOnlyElementsSource

    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([])
    })

    it('should return file cabinet targets for folder elements', async () => {
      const elemIds = [new ElemID(NETSUITE, FOLDER, 'instance', naclCase('SuiteScripts/test'))]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'fileCabinet', name: 'SuiteScripts/test' }])
    })

    it('should return file cabinet targets for file elements using parent folder', async () => {
      const elemIds = [new ElemID(NETSUITE, FILE, 'instance', naclCase('SuiteScripts/test/file.js'))]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'fileCabinet', name: 'SuiteScripts/test' }])
    })

    it('should return custom record targets for custom record instances', async () => {
      const elemIds = [new ElemID(NETSUITE, 'customrecord_test', 'instance', 'val_123')]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'customRecords', name: 'customrecord_test' }])
    })

    it('should return type targets for custom record types', async () => {
      const elemIds = [new ElemID(NETSUITE, 'customrecord_test')]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'types', name: CUSTOM_RECORD_TYPE }])
    })

    it('should return type targets for standard instances', async () => {
      const elemIds = [new ElemID(NETSUITE, WORKFLOW, 'instance', 'customworkflow_123')]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'types', name: WORKFLOW }])
    })

    it('should return type targets for data instances', async () => {
      const elemIds = [new ElemID(NETSUITE, EMPLOYEE, 'instance', 'employee_123')]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'types', name: EMPLOYEE }])
    })

    it('should return type targets for features instance', async () => {
      const elemIds = [new ElemID(NETSUITE, CONFIG_FEATURES, 'instance', ElemID.CONFIG_NAME)]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'types', name: CONFIG_FEATURES }])
    })

    it('should return type targets for suiteapp config instance', async () => {
      const elemIds = [
        new ElemID(
          NETSUITE,
          SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.ACCOUNTING_PREFERENCES,
          'instance',
          ElemID.CONFIG_NAME,
        ),
      ]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([{ group: 'types', name: SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.ACCOUNTING_PREFERENCES }])
    })

    it('should return empty targets for unknown elements', async () => {
      const elemIds = [new ElemID(NETSUITE, 'unknown')]
      const targets = await getTargetsForElements({ elemIds, elementsSource })
      expect(targets).toEqual([])
    })
  })

  describe('targetedFetchQuery', () => {
    it('should build query with all target groups', () => {
      const targets = [
        { group: 'types', name: 'employee' },
        { group: 'fileCabinet', name: 'SuiteScripts/test' },
        { group: 'customRecords', name: 'customrecord_test' },
      ]
      const query = targetedFetchQuery(targets)

      expect(query.isTypeMatch('employee')).toBeTruthy()
      expect(query.isTypeMatch('workflow')).toBeFalsy()

      expect(query.isFileMatch('/SuiteScripts/test/')).toBeTruthy()
      expect(query.isFileMatch('/SuiteScripts/test/someFile.txt')).toBeTruthy()
      expect(query.isFileMatch('/SuiteScripts/test2/someFile.txt')).toBeFalsy()
      expect(query.isFileMatch('/SuiteScripts/SuiteScripts/test/someFile.txt')).toBeFalsy()

      expect(query.isCustomRecordTypeMatch('customrecord_test')).toBeTruthy()
      expect(query.isCustomRecordTypeMatch('customrecord_test2')).toBeFalsy()
    })

    it('should handle file cabinet regexes', () => {
      const targets = [{ group: 'fileCabinet', name: 'SuiteScripts/test [test]' }]
      const query = targetedFetchQuery(targets)
      expect(query.isFileMatch('/SuiteScripts/test [test]/file.txt')).toBeTruthy()
    })

    it('should handle empty target groups', () => {
      const targets = [{ group: 'types', name: 'employee' }]
      const query = targetedFetchQuery(targets)

      expect(query.isTypeMatch('employee')).toBeTruthy()
      expect(query.isTypeMatch('workflow')).toBeFalsy()

      expect(query.isFileMatch('/SuiteScripts/test/')).toBeFalsy()
      expect(query.isFileMatch('/SuiteScripts/test/someFile.txt')).toBeFalsy()
      expect(query.isFileMatch('/SuiteScripts/test2/someFile.txt')).toBeFalsy()
      expect(query.isFileMatch('/SuiteScripts/SuiteScripts/test/someFile.txt')).toBeFalsy()

      expect(query.isCustomRecordTypeMatch('customrecord_test')).toBeFalsy()
      expect(query.isCustomRecordTypeMatch('customrecord_test2')).toBeFalsy()
    })
  })
})
