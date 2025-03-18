/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Element,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { createEmptyType, getFilterParams } from '../../utils'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE, SCREEN_SCHEME_TYPE } from '../../../src/constants'
import createReferencesIssueLayoutFilter from '../../../src/filters/layouts/create_references_layouts'
import { getDefaultConfig } from '../../../src/config/config'
import { createLayoutType } from '../../../src/filters/layouts/layout_types'

describe('createReferencesIssueLayoutFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let issueLayoutInstance: InstanceElement
  let issueLayoutDefaultValueInstance: InstanceElement
  const screenType = new ObjectType({
    elemID: new ElemID(JIRA, 'Screen'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const screenInstance = new InstanceElement('screen1', screenType, {
    id: 11,
  })
  const screenSchemeType = new ObjectType({
    elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      screens: { refType: screenType },
    },
  })
  const screenSchemeInstance = new InstanceElement('screenScheme1', screenSchemeType, {
    id: 111,
    screens: { default: new ReferenceExpression(screenInstance.elemID, screenInstance) },
  })
  const issueTypeScreenSchemeItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'IssueTypeScreenSchemeItem'),
    fields: {
      issueTypeId: { refType: BuiltinTypes.STRING },
      screenSchemeId: { refType: screenSchemeType },
    },
  })
  const issueTypeScreenSchemeType = new ObjectType({
    elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      issueTypeMappings: { refType: new ListType(issueTypeScreenSchemeItemType) },
    },
  })
  const issueTypeScreenSchemeInstance = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
    id: 1111,
    issueTypeMappings: [
      {
        issueTypeId: 1,
        screenSchemeId: new ReferenceExpression(screenSchemeInstance.elemID, screenSchemeInstance),
      },
    ],
  })
  const projectType = new ObjectType({
    elemID: new ElemID(JIRA, PROJECT_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      simplified: { refType: BuiltinTypes.BOOLEAN },
      issueTypeScreenScheme: { refType: issueTypeScreenSchemeType },
    },
  })
  const projectInstance = new InstanceElement('project1', projectType, {
    id: 11111,
    name: 'project1',
    simplified: false,
    projectTypeKey: 'software',
    issueTypeScreenScheme: new ReferenceExpression(issueTypeScreenSchemeInstance.elemID, issueTypeScreenSchemeInstance),
  })
  const fieldType = createEmptyType('Field')
  const fieldInstance1 = new InstanceElement('testField1', fieldType, {
    id: 'testField1',
    name: 'TestField1',
    type: 'testField1',
  })
  const issueLayoutItemDataDefaultValueType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutItemDataDefaultValue'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      groupId: { refType: BuiltinTypes.STRING },
    },
  })
  const issueLayoutItemDataType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutItemData'),
    fields: {
      defaultValue: { refType: issueLayoutItemDataDefaultValueType },
    },
  })
  const customFieldContextOptionType = createEmptyType('CustomFieldContextOption')
  const groupIdType = createEmptyType('Group')
  const projectIdType = createEmptyType('Project')
  const defaultValueGroupIdInstance = new InstanceElement('defaultValueGroupIdInstance', groupIdType, {
    groupId: 'a123',
    name: 'ProjectName',
    type: 'defaultValueGroupIdInstance',
  })
  const defaultValueIdInstance = new InstanceElement('defaultValueIdInstance', customFieldContextOptionType, {
    id: 2,
    name: 'CustomFieldContextOptionName',
    type: 'defaultValueIdInstance',
  })
  const defaultValueInstance = new InstanceElement('defaultValueInstance', projectIdType, {
    id: 'id123',
    name: 'ProjectName',
    type: 'defaultValueInstance',
  })
  const layoutConfigItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'layoutConfigItem'),
    fields: {
      key: { refType: fieldType },
      sectionType: { refType: BuiltinTypes.STRING },
      type: { refType: BuiltinTypes.STRING },
      data: { refType: issueLayoutItemDataType },
    },
  })
  const layoutConfigType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutConfig'),
    fields: {
      items: { refType: new ListType(layoutConfigItemType) },
    },
  })
  const issueLayoutType = createLayoutType(ISSUE_LAYOUT_TYPE).layoutType

  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  config.fetch.enableIssueLayouts = true

  beforeEach(() => {
    issueLayoutInstance = new InstanceElement('issueLayout', issueLayoutType, {
      id: '2',
      extraDefinerId: '11',
      issueLayoutConfig: {
        items: [
          {
            type: 'FIELD',
            sectionType: 'PRIMARY',
            key: 'testField1',
          },
        ],
      },
    })
    issueLayoutDefaultValueInstance = new InstanceElement('issueLayoutDefaultValueInstance', issueLayoutType, {
      id: '1',
      extraDefinerId: '12',
      issueLayoutConfig: {
        items: [
          {
            type: 'FIELD',
            sectionType: 'PRIMARY',
            key: 'testField1',
            data: {
              defaultValue: 'id123',
            },
          },
        ],
      },
    })

    elements = [
      screenType,
      screenInstance,
      screenSchemeType,
      screenSchemeInstance,
      issueTypeScreenSchemeType,
      issueTypeScreenSchemeInstance,
      projectType,
      projectInstance,
      fieldType,
      fieldInstance1,
      groupIdType,
      projectIdType,
      customFieldContextOptionType,
      defaultValueGroupIdInstance,
      defaultValueIdInstance,
      defaultValueInstance,
      layoutConfigItemType,
      layoutConfigType,
      issueLayoutType,
      issueLayoutItemDataDefaultValueType,
      issueLayoutItemDataType,
      issueLayoutInstance,
      issueLayoutDefaultValueInstance,
    ]
    filter = createReferencesIssueLayoutFilter(getFilterParams({ config })) as typeof filter
  })
  it('should add references to extraDefinerId and key fields', async () => {
    await filter.onFetch(elements)
    expect(issueLayoutInstance.value).toEqual({
      id: '2',
      extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
      issueLayoutConfig: {
        items: [
          {
            type: 'FIELD',
            sectionType: 'PRIMARY',
            key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
          },
        ],
      },
    })
  })
  it('should add key as missing ref if there is no field', async () => {
    fieldInstance1.value.id = 'testField3'
    await filter.onFetch(elements)
    expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key).toEqual('testField1')
  })
  describe('defaultValue field', () => {
    it('should add reference to default value when its a string', async () => {
      await filter.onFetch(elements)
      const { defaultValue } = issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data
      expect(defaultValue).toEqual(new ReferenceExpression(defaultValueInstance.elemID, defaultValueInstance))
    })
    it('should add reference to default value when its an object with id field', async () => {
      issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data.defaultValue = { id: 2 }
      await filter.onFetch(elements)
      const { defaultValue } = issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data
      expect(defaultValue).toEqual({
        id: new ReferenceExpression(defaultValueIdInstance.elemID, defaultValueIdInstance),
      })
    })
    it('should add reference to default value when its an array with groupId field', async () => {
      issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data.defaultValue = [{ groupId: 'a123' }]
      await filter.onFetch(elements)
      const { defaultValue } = issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data
      expect(defaultValue).toEqual([
        { groupId: new ReferenceExpression(defaultValueGroupIdInstance.elemID, defaultValueGroupIdInstance) },
      ])
    })
    it('should add missing ref if there is no field', async () => {
      defaultValueInstance.value.id = 'noRef'
      await filter.onFetch(elements)
      const { defaultValue } = issueLayoutDefaultValueInstance.value.issueLayoutConfig.items[0].data
      expect(defaultValue).toEqual(new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'missing_id123')))
    })
  })
})
