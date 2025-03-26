/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  Change,
  ElemID,
  Element,
  ReadOnlyElementsSource,
  getChangeData,
  isElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { getReferencesFromElement, getReferencesFromRefTypes, ReferenceIndexEntry } from './reference_indexes'
import { ReadOnlyRemoteMap } from './remote_map'
import { getSaltoFlagBool, WORKSPACE_FLAGS } from '../flags'

const log = logger(module)
const { awu } = collections.asynciterable

type IsDependentFunc = (elemID: ElemID, dependencies: ElemID[]) => Promise<boolean>

const getDependentIDsFromReferences = (
  elemIDs: ElemID[],
  referenceSourcesIndex: ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
  addedIDs: Set<string>,
  isDependent: IsDependentFunc,
): Promise<ElemID[]> =>
  log.timeDebug(
    () =>
      awu(elemIDs)
        .map(id => referenceSourcesIndex.get(id.getFullName()))
        .flatMap(references => references ?? [])
        .map(ref => ref.id.createTopLevelParentID().parent)
        .filter(id => !addedIDs.has(id.getFullName()))
        .uniquify(id => id.getFullName())
        .filter(id => isDependent(id, elemIDs))
        .toArray(),
    'getDependentIDsFromReferences for %d elemIDs',
    elemIDs.length,
  )

const getDependentIDs = (
  elemIDs: ElemID[],
  referenceSourcesIndex: ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
  isDependent: IsDependentFunc,
): Promise<ElemID[]> =>
  log.timeDebug(
    () => {
      const addedIDs = new Set<string>()

      const getDependentIDsRecursive = async (ids: ElemID[]): Promise<ElemID[]> => {
        ids.forEach(id => {
          addedIDs.add(id.getFullName())
        })
        const dependentIDs = await getDependentIDsFromReferences(ids, referenceSourcesIndex, addedIDs, isDependent)
        return dependentIDs.length === 0
          ? dependentIDs
          : dependentIDs.concat(await getDependentIDsRecursive(dependentIDs))
      }

      return getDependentIDsRecursive(elemIDs)
    },
    'getDependentIDs for %d elemIDs',
    elemIDs.length,
  )

const getAdditionalDependentIDs = (dependentIDs: ElemID[], elementsSource: ReadOnlyElementsSource): Promise<ElemID[]> =>
  log.timeDebug(
    async () => {
      // if there are no dependent types we can avoid iterating `elementsSource.list()` to get the additional dependent instances.
      if (!dependentIDs.some(id => id.idType === 'type')) {
        return []
      }

      const dependentIdsSet = new Set(dependentIDs.map(id => id.getFullName()))

      // in `referenceSourcesIndex` there are no references between types and their instances
      // so we should add the instances of the types that are in `addedIDs` as well.
      const additionalDependentInstanceIDs = await awu(await elementsSource.list())
        .filter(
          id =>
            id.idType === 'instance' &&
            !dependentIdsSet.has(id.getFullName()) &&
            dependentIdsSet.has(new ElemID(id.adapter, id.typeName).getFullName()),
        )
        .toArray()

      return additionalDependentInstanceIDs
    },
    'getAdditionalDependentIDs for %d dependentIDs',
    dependentIDs.length,
  )

const getElementDependencies = async (
  elemID: ElemID,
  elementsSource: ReadOnlyElementsSource,
  removedElementIDs: Set<string>,
): Promise<Set<string>> => {
  const element = await elementsSource.get(elemID)
  if (!isElement(element)) {
    log.warn('missing %s in elements source', elemID.getFullName())
    return new Set()
  }
  const refTypesDependencies = getReferencesFromRefTypes(element).map(ref => ref.target.getFullName())

  const elementDependencies = (await getReferencesFromElement(element))
    // when there's a reference to a removed element, we should validate the dependent elements (that may have a broken reference now).
    // when there's a reference to a non top-level id, we should validate the reference's value in the dependent elements (e.g for type mismatch).
    // when there's a reference to a top-level element, we skip the validation of the dependent elements, and therefore they can be removed from the list.
    .filter(ref => removedElementIDs.has(ref.target.getFullName()) || !ref.target.isTopLevel())
    .map(ref => ref.target.createTopLevelParentID().parent.getFullName())

  return new Set(refTypesDependencies.concat(elementDependencies))
}

const createIsDependentFunc = (
  changes: Change<Element>[],
  elementsSource: ReadOnlyElementsSource,
  skipValidationDependentElementsFiltering: boolean,
): IsDependentFunc => {
  if (skipValidationDependentElementsFiltering) {
    return async () => true
  }

  const dependsOnMap: Record<string, Promise<Set<string>>> = {}

  const removedElementIDs = new Set(
    changes
      .filter(isRemovalChange)
      .map(getChangeData)
      .map(change => change.elemID.getFullName()),
  )

  const isDependent: IsDependentFunc = async (elemID, dependencies) => {
    if (dependsOnMap[elemID.getFullName()] === undefined) {
      dependsOnMap[elemID.getFullName()] = getElementDependencies(elemID, elementsSource, removedElementIDs)
    }
    const dependsOn = await dependsOnMap[elemID.getFullName()]
    return dependencies.some(id => dependsOn.has(id.getFullName()))
  }

  return isDependent
}

const getDependentElements = (elementsSource: ReadOnlyElementsSource, dependentIDs: ElemID[]): Promise<Element[]> =>
  log.timeDebug(
    () => Promise.all(dependentIDs.map(id => elementsSource.get(id))).then(res => res.filter(isElement)),
    'getDependentElements for %d dependentIDs',
    dependentIDs.length,
  )

export const getDependents = async (
  changes: Change<Element>[],
  elementsSource: ReadOnlyElementsSource,
  referenceSourcesIndex: ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
): Promise<Element[]> => {
  const elemIDs = changes.map(change => getChangeData(change).elemID)
  const skipValidationDependentElementsFiltering = getSaltoFlagBool(
    WORKSPACE_FLAGS.skipValidationDependentElementsFiltering,
  )
  // TODO: remove this log when deleting the flag
  log.debug(
    'getting dependents for %d elements, skipValidationDependentElementsFiltering: %s',
    elemIDs.length,
    skipValidationDependentElementsFiltering,
  )
  const dependentIDs = await getDependentIDs(
    elemIDs,
    referenceSourcesIndex,
    createIsDependentFunc(changes, elementsSource, skipValidationDependentElementsFiltering),
  )
  const additionalDependentIDs = await getAdditionalDependentIDs(dependentIDs, elementsSource)
  const allDependentIDs = dependentIDs.concat(additionalDependentIDs)
  const dependents = await getDependentElements(elementsSource, allDependentIDs)
  log.debug('found %d dependents of %d elements', dependents.length, elemIDs.length)
  if (allDependentIDs.length !== dependents.length) {
    const missingDependents = _.difference(
      allDependentIDs.map(id => id.getFullName()),
      dependents.map(elem => elem.elemID.getFullName()),
    )
    log.warn(
      `there is a mismatch between the num of requested dependent IDs and the num of dependents in the elements source. missing dependents: ${missingDependents}`,
    )
  }

  return dependents
}
