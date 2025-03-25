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
  isInstanceElement,
  isObjectType,
  PartialFetchOperations,
  PartialFetchTarget,
} from '@salto-io/adapter-api'
import { generateElements, GeneratorParams } from './generator'

const GROUP = 'dummy'

export const PARTIAL_FETCH_ANNOTATION = 'partialFetch'

const getElementPath = (element: Element): string[] => {
  if (element.path === undefined || element.path.length < 2) {
    return [element.elemID.typeName]
  }
  return [element.path[1], element.elemID.typeName]
}

export const getAllTargets: PartialFetchOperations['getAllTargets'] = async ({ config }) => {
  const elements = await generateElements(config?.value as GeneratorParams)
  const objectTypes = _.uniqBy(elements.filter(isObjectType), element => element.elemID.typeName)

  return objectTypes.map(element => ({
    group: GROUP,
    name: element.elemID.typeName,
    path: getElementPath(element),
  }))
}

export const getTargetsForElements: PartialFetchOperations['getTargetsForElements'] = async ({ elemIds }) =>
  elemIds.map(elemId => ({
    group: GROUP,
    name: elemId.typeName,
  }))

const markElementsAsPartiallyFetched = (elements: Element[]): void => {
  elements.forEach(element => {
    if (isInstanceElement(element)) {
      element.value[PARTIAL_FETCH_ANNOTATION] = true
    } else {
      element.annotations[PARTIAL_FETCH_ANNOTATION] = true
    }
  })
}

export const getPartiallyFetchedElements = (
  elements: Element[],
  partialFetchTargets: PartialFetchTarget[],
): Element[] => {
  const partialFetchTypes = new Set(partialFetchTargets.map(target => target.name))
  const partialFetchElements = elements.filter(element => partialFetchTypes.has(element.elemID.typeName))
  markElementsAsPartiallyFetched(partialFetchElements)
  return partialFetchElements
}
