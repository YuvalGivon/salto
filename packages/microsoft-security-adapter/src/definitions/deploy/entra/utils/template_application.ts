/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ActionName, getChangeData, isAdditionChange, Value, Values } from '@salto-io/adapter-api'
import { validatePlainObject, validateArray } from '@salto-io/adapter-utils'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { APP_ROLES_FIELD_NAME, API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME } from '../../../../constants/entra'
import { AdjustFunctionSingle } from '../../shared/types'

export const toActionNames = async ({ change }: definitionsUtils.deploy.ChangeAndContext): Promise<ActionName[]> => {
  if (isAdditionChange(change)) {
    return ['add', 'modify']
  }
  return [change.action]
}

export const actionDependencies = [
  {
    first: 'add' as const,
    second: 'modify' as const,
  },
]

export const isTemplateInstantiateChange = ({ change }: definitionsUtils.deploy.ChangeAndExtendedContext): boolean => {
  if (isAdditionChange(change)) {
    const instance = getChangeData(change)
    return instance.value.applicationTemplateId !== undefined
  }
  return false
}

// Updates the id field of items in itemsInChange to match the id of corresponding items in itemsInResponse
// Items are considered matching if they have identical values for all fields specified in identifyingFields
const matchAndSetIds = ({
  itemsInChange,
  itemsInResponse,
  identifyingFields,
}: {
  itemsInChange: Value[]
  itemsInResponse: Value[]
  identifyingFields: string[]
}): Value[] => {
  validateArray(itemsInChange, 'itemsInChange')
  validateArray(itemsInResponse, 'itemsInResponse')

  return itemsInChange.map(itemInChange => {
    validatePlainObject(itemInChange, 'itemInChange')
    const matchingItem = itemsInResponse.find(itemInResponse => {
      validatePlainObject(itemInResponse, 'itemInResponse')
      return identifyingFields.every(
        field =>
          itemInResponse[field] === itemInChange[field] ||
          // If some field doesn't exist in the change, it may be null in the response. In this case, we consider them matching
          (itemInResponse[field] === null && itemInChange[field] === undefined),
      )
    })
    return matchingItem ? { ...itemInChange, id: _.get(matchingItem, 'id') } : itemInChange
  })
}

const updateApplicationFieldWithIds = ({
  applicationValue,
  applicationResponse,
  fieldPath,
  identifyingFields,
}: {
  applicationValue: Values
  applicationResponse: Values
  fieldPath: string[]
  identifyingFields: string[]
}): void => {
  const itemsInResponse = _.get(applicationResponse, fieldPath, [])
  const itemsInChange = _.get(applicationValue, fieldPath, [])
  const itemsWithIds = matchAndSetIds({ itemsInChange, itemsInResponse, identifyingFields })
  _.set(applicationValue, fieldPath, itemsWithIds)
}

// When instantiating an application from a template, we need to update the IDs of the app roles and
// oauth2 permission scopes in the application instance to match the IDs assigned by Microsoft.
// This adjust function takes the response from creating the application and updates the IDs in the change.
export const updateAppStandaloneFieldsWithIds: AdjustFunctionSingle = async ({ value, context }) => {
  const { change, sharedContext } = context
  validatePlainObject(value, 'application')
  const applicationResponse = _.get(sharedContext, [getChangeData(change).elemID.getFullName(), 'application'])
  if (_.isEmpty(applicationResponse)) {
    return { value } as { value: Values }
  }
  validatePlainObject(applicationResponse, 'applicationResponse')

  updateApplicationFieldWithIds({
    applicationValue: value,
    applicationResponse,
    fieldPath: [APP_ROLES_FIELD_NAME],
    identifyingFields: ['displayName', 'value'],
  })

  updateApplicationFieldWithIds({
    applicationValue: value,
    applicationResponse,
    fieldPath: [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME],
    identifyingFields: ['value'],
  })

  return { value }
}
