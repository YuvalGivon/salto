/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  APP_ROLES_FIELD_NAME,
  API_FIELD_NAME,
  OAUTH2_PERMISSION_SCOPES_FIELD_NAME,
} from '../../../../../src/constants/entra'
import { MICROSOFT_SECURITY, entraConstants } from '../../../../../src/constants'
import { isTemplateInstantiateChange } from '../../../../../src/definitions/deploy/entra/utils/template_application'
import { templateApplication } from '../../../../../src/definitions/deploy/entra/utils'
import { contextMock } from '../../../../mocks'

describe('template_application', () => {
  const applicationTemplateType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.APPLICATION_TEMPLATE_TYPE_NAME),
  })
  const applicationType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME),
  })
  const applicationTemplate = new InstanceElement('instance', applicationTemplateType, {
    id: 'template-123',
  })
  const nonTemplateApplication = new InstanceElement('instance', applicationType, { appId: 'app-id' })
  const applicationFromTemplate = new InstanceElement('instance', applicationType, {
    applicationTemplateId: new ReferenceExpression(applicationTemplate.elemID, applicationTemplate),
  })

  describe('toActionNames', () => {
    describe('addition change', () => {
      const additionChange = toChange({ after: applicationFromTemplate })
      it('should return add and modify actions', async () => {
        await expect(
          templateApplication.toActionNames({
            change: additionChange,
            sharedContext: {},
            changeGroup: { groupID: 'groupID', changes: [additionChange] },
            elementSource: buildElementsSourceFromElements([]),
          }),
        ).resolves.toEqual(['add', 'modify'])
      })
    })

    describe('modification change', () => {
      const modificationChange = toChange({ before: nonTemplateApplication, after: nonTemplateApplication })
      it('should return only modify action', async () => {
        await expect(
          templateApplication.toActionNames({
            change: modificationChange,
            sharedContext: {},
            changeGroup: { groupID: 'groupID', changes: [modificationChange] },
            elementSource: buildElementsSourceFromElements([]),
          }),
        ).resolves.toEqual(['modify'])
      })
    })

    describe('deletion change', () => {
      const deletionChange = toChange({ before: nonTemplateApplication })
      it('should return only delete action', async () => {
        await expect(
          templateApplication.toActionNames({
            change: deletionChange,
            sharedContext: {},
            changeGroup: { groupID: 'groupID', changes: [deletionChange] },
            elementSource: buildElementsSourceFromElements([]),
          }),
        ).resolves.toEqual(['remove'])
      })
    })
  })

  describe('isTemplateInstantiateChange', () => {
    it('should return true for addition with applicationTemplateId', () => {
      const change = toChange({ after: applicationFromTemplate })
      expect(isTemplateInstantiateChange({ ...contextMock, change })).toBe(true)
    })

    it('should return false for addition without applicationTemplateId', () => {
      const change = toChange({ after: nonTemplateApplication })
      expect(isTemplateInstantiateChange({ ...contextMock, change })).toBe(false)
    })

    it('should return false for modification', () => {
      const change = toChange({ before: applicationFromTemplate, after: applicationFromTemplate })
      expect(isTemplateInstantiateChange({ ...contextMock, change })).toBe(false)
    })

    it('should return false for deletion', () => {
      const change = toChange({ before: applicationFromTemplate, after: applicationFromTemplate })
      expect(isTemplateInstantiateChange({ ...contextMock, change })).toBe(false)
    })
  })

  describe('updateAppStandaloneFieldsWithIds', () => {
    const appWithRoles = new InstanceElement('instance', applicationType, {
      [APP_ROLES_FIELD_NAME]: [
        { displayName: 'Role1', value: 'role1', id: 'change-id1' },
        { displayName: 'Role2', value: 'role2', id: 'change-id2' },
        { displayName: 'Role3', value: 'role3', id: 'change-id3' },
      ],
      [API_FIELD_NAME]: {
        [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]: [
          { value: 'scope1', id: 'change-scope-id1' },
          { value: 'scope2', id: 'change-scope-id2' },
          { value: 'scope3', id: 'change-scope-id3' },
        ],
      },
    })

    const mockResponse = {
      application: {
        [APP_ROLES_FIELD_NAME]: [
          { displayName: 'Role1', value: 'role1', id: 'response-id1' },
          { displayName: 'Role2', value: 'role2', id: 'response-id2' },
        ],
        [API_FIELD_NAME]: {
          [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]: [
            { value: 'scope1', id: 'response-scope-id1' },
            { value: 'scope2', id: 'response-scope-id2' },
          ],
        },
      },
    }

    const change = toChange({ after: appWithRoles })
    const context = {
      change,
      changeGroup: { groupID: 'groupID', changes: [change] },
      elementSource: buildElementsSourceFromElements([]),
      errors: {},
      sharedContext: {
        [appWithRoles.elemID.getFullName()]: mockResponse,
      },
    }

    it('should update IDs from response', async () => {
      const result = await templateApplication.updateAppStandaloneFieldsWithIds({
        context,
        value: appWithRoles.clone().value,
        typeName: entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME,
      })

      expect(result.value[APP_ROLES_FIELD_NAME][0].id).toBe('response-id1')
      expect(result.value[APP_ROLES_FIELD_NAME][1].id).toBe('response-id2')
      expect(result.value[APP_ROLES_FIELD_NAME][2].id).toBe('change-id3')
      expect(result.value[API_FIELD_NAME][OAUTH2_PERMISSION_SCOPES_FIELD_NAME][0].id).toBe('response-scope-id1')
      expect(result.value[API_FIELD_NAME][OAUTH2_PERMISSION_SCOPES_FIELD_NAME][1].id).toBe('response-scope-id2')
      expect(result.value[API_FIELD_NAME][OAUTH2_PERMISSION_SCOPES_FIELD_NAME][2].id).toBe('change-scope-id3')
    })

    it('should return original value when no response is available', async () => {
      const result = await templateApplication.updateAppStandaloneFieldsWithIds({
        context: {
          ...context,
          sharedContext: {},
        },
        value: appWithRoles.clone().value,
        typeName: entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME,
      })

      expect(result.value).toEqual(appWithRoles.value)
    })
  })
})
