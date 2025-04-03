/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Field,
  getChangeData,
  isField,
  isObjectType,
  ObjectType,
  ReferenceExpression,
  Element,
  isFieldChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { API_NAME, FIELD_ANNOTATIONS } from '../constants'
import { relativeApiName } from '../transformers/transformer'
import { ensureSafeFilterFetch, isFieldWithFieldDependency } from './utils'
import { FieldWithFieldDependency } from '../client/types'

const log = logger(module)

const createControllingFieldReference = (field: FieldWithFieldDependency, object: ObjectType): void => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const controllingFieldValue = fieldDependency.controllingField
  if (!_.isString(controllingFieldValue)) {
    return
  }
  const controllingField = object.fields[controllingFieldValue]
  if (!isField(controllingField)) {
    return
  }
  fieldDependency.controllingField = new ReferenceExpression(controllingField.elemID, controllingField)
}

const getFullFieldApiName = (apiName: string, field: Field): string => {
  if (!_.isString(field.annotations[API_NAME])) {
    log.warn(`field's apiName is not a string: ${field.elemID.getFullName()}`)
    return apiName
  }
  return field.annotations[API_NAME].split('.')[0].concat('.', apiName)
}

const revertReferenceToString = (field: FieldWithFieldDependency, getRelativeApiName = true): void => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const controllingFieldValue = fieldDependency.controllingField
  if (!_.isString(controllingFieldValue)) {
    log.warn(
      `controllingFieldValue is not a string: ${controllingFieldValue}, under the field: ${field.elemID.getFullName()}`,
    )
    return
  }
  field.annotations.fieldDependency.controllingField = getRelativeApiName
    ? relativeApiName(controllingFieldValue)
    : getFullFieldApiName(controllingFieldValue, field)
}

/**
 * Creates reference for controllingField
 *
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: ensureSafeFilterFetch({
    fetchFilterFunc: async (elements: Element[]) => {
      elements.filter(isObjectType).forEach(object =>
        Object.values(object.fields)
          .filter(isFieldWithFieldDependency)
          .forEach(field => createControllingFieldReference(field, object)),
      )
    },
    warningMessage: 'Failed to create controlling field references',
    config,
    filterName: 'fieldReferencesFilter',
  }),
  preDeploy: async changes => {
    changes
      .filter(isFieldChange)
      .map(getChangeData)
      .filter(isFieldWithFieldDependency)
      .forEach(object => revertReferenceToString(object))
  },
  onDeploy: async changes => {
    changes
      .filter(isFieldChange)
      .map(getChangeData)
      .filter(isFieldWithFieldDependency)
      .forEach(object => revertReferenceToString(object, false))
  },
})

export default filter
