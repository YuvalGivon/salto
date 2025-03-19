/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import {
  CORE_ANNOTATIONS,
  Element,
  isField,
  isInstanceElement,
  isObjectType,
  isPlaceholderObjectType,
  isPrimitiveValue,
  isReferenceExpression,
  ObjectType,
  ReadOnlyElementsSource,
  Value,
} from '@salto-io/adapter-api'

const log = logger(module)
const { isDefined } = values
const { makeArray } = collections.array

export type ImportantValue = { value: string; indexed: boolean; highlighted: boolean }
export type ImportantValues = ImportantValue[]
export type FormattedImportantValueData = { key: string; value: Value }

export const toImportantValues = (
  type: ObjectType,
  fieldNames: string[],
  {
    indexed = false,
    highlighted = false,
  }: {
    indexed?: boolean
    highlighted?: boolean
  },
): ImportantValues =>
  fieldNames
    .filter(fieldName => type.fields[fieldName] !== undefined)
    .map(fieldName => ({ value: fieldName, highlighted, indexed }))

const isValidIndexedValueData = (importantValue: ImportantValue, valueData: unknown): boolean => {
  if (importantValue.indexed !== true) {
    return true
  }
  if (_.isArray(valueData)) {
    return valueData.every(part => isPrimitiveValue(part) || isReferenceExpression(part))
  }

  return isPrimitiveValue(valueData) || isReferenceExpression(valueData)
}

const getRelevantImportantValues = (
  importantValues: ImportantValues,
  indexedOnly?: boolean,
  highlightedOnly?: boolean,
): ImportantValues => {
  const indexedValues = indexedOnly === true ? importantValues.filter(value => value.indexed === true) : importantValues
  return highlightedOnly === true
    ? indexedValues
        .filter(value => value.highlighted === true)
        .filter(value => {
          if (value.value.includes('.')) {
            log.warn(`${value.value} is an inner value, we do not support inner values as highlighted important values`)
            return false
          }
          return true
        })
    : indexedValues
}

export const extractImportantValuesFromElement = ({
  importantValuesDefinitions,
  element,
  indexedOnly,
  highlightedOnly,
}: {
  importantValuesDefinitions: ImportantValues
  element: Element
  indexedOnly?: boolean
  highlightedOnly?: boolean
}): FormattedImportantValueData[] => {
  if (_.isEmpty(importantValuesDefinitions)) {
    if (importantValuesDefinitions === undefined) {
      log.trace('important value is undefined for element %s', element.elemID.getFullName())
    }
    return []
  }
  const relevantImportantValues = getRelevantImportantValues(importantValuesDefinitions, indexedOnly, highlightedOnly)
  const getFrom = isInstanceElement(element) ? element.value : element.annotations
  const finalImportantValues = relevantImportantValues
    .map(importantValue => {
      const { value } = importantValue
      const valueData = _.get(getFrom, value, undefined)
      if (!isValidIndexedValueData(importantValue, valueData)) {
        log.warn(`${importantValue.value} for element ${element.elemID.getFullName()} is not a primitive value,
      we do not support non primitive values as indexed important values`)
        return undefined
      }
      return { key: value, value: valueData }
    })
    .filter(isDefined)

  return finalImportantValues
}

const hasHiddenImportantValues = (objectType: ObjectType, importantValues: ImportantValues): boolean =>
  importantValues.some(importantValue => {
    const field = objectType.fields[importantValue.value]
    return field?.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]
  })

export const getImportantValuesDefinitions = async ({
  element,
  elementSource,
}: {
  element: Element
  elementSource?: ReadOnlyElementsSource
}): Promise<{ importantValuesDefinitions: ImportantValues; isHiddenImportantValue: boolean }> => {
  if (isObjectType(element)) {
    const importantValuesDefinitions = makeArray(element.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES])
    return {
      importantValuesDefinitions,
      isHiddenImportantValue: false,
    }
  }
  if (isField(element) || isInstanceElement(element)) {
    const getTypeObj = async (): Promise<ObjectType> => {
      const typeObj = await element.getType(elementSource)
      return isPlaceholderObjectType(typeObj) ? elementSource?.get(typeObj.elemID) : typeObj
    }
    try {
      const typeObj = await getTypeObj()
      if (typeObj === undefined) {
        log.trace(
          `could not get important values as type is undefined returning [] for element ${element.elemID.getFullName()}`,
        )
        return { importantValuesDefinitions: [], isHiddenImportantValue: false }
      }
      const importantValuesDefinitions = makeArray(typeObj?.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES])
      return {
        importantValuesDefinitions,
        isHiddenImportantValue: isInstanceElement(element)
          ? // currently we support hidden important values only for instances
            hasHiddenImportantValues(typeObj, importantValuesDefinitions)
          : false,
      }
    } catch (e) {
      // getType throws an error when the type calculated is not a valid type, or when
      // resolvedValue === undefined && elementsSource === undefined in getResolvedValue
      log.warn(
        `could not get important values for element ${element.elemID.getFullName()}, received error ${e}, returning []`,
      )
      return { importantValuesDefinitions: [], isHiddenImportantValue: false }
    }
  }
  return { importantValuesDefinitions: [], isHiddenImportantValue: false }
}

// this function returns the important values of an element. if the element is an instance or a field the important
// values will be calculated from the type. When the flag indexedOnly is on, only values with indexed = true will be
// returned
export const getImportantValues = async ({
  element,
  elementSource,
  indexedOnly,
  highlightedOnly,
}: {
  element: Element
  elementSource?: ReadOnlyElementsSource
  allowHiddenValues?: boolean
  indexedOnly?: boolean
  highlightedOnly?: boolean
}): Promise<FormattedImportantValueData[]> => {
  const { importantValuesDefinitions } = await getImportantValuesDefinitions({
    element,
    elementSource,
  })

  return extractImportantValuesFromElement({
    importantValuesDefinitions,
    element,
    indexedOnly,
    highlightedOnly,
  })
}
