/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { Element, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import {
  addElementParentReference,
  apiNameSync,
  buildElementsSourceForFetch,
  isCustomObjectSync,
  isMetadataInstanceElementSync,
  metadataTypeOrUndefined,
} from './utils'
import { APPROVAL_PROCESS_METADATA_TYPE, FLOW_METADATA_TYPE, GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE } from '../constants'

const { toArrayAsync } = collections.asynciterable
const { DefaultMap } = collections.map
const log = logger(module)

type FolderInstancesIndex = Map<string, Record<string, InstanceElement>>

type GetParentElementParams = {
  instance: InstanceElement
  customObjectByName: Record<string, ObjectType>
  folderInstancesIndex: FolderInstancesIndex
}

type GetParentElementFunc = (params: GetParentElementParams) => Element | undefined

const createFolderInstancesIndex = (elements: Element[]): FolderInstancesIndex => {
  const folderInstancesIndex = new DefaultMap<string, Record<string, InstanceElement>>(() => ({}))
  elements.filter(isInstanceElement).forEach(folderInstance => {
    if (folderInstance.getTypeSync().annotations.folderContentType) {
      folderInstancesIndex.get(metadataTypeOrUndefined(folderInstance) ?? '')[apiNameSync(folderInstance) ?? ''] =
        folderInstance
    }
  })
  return folderInstancesIndex
}

const isInstanceWithinFolder = (instance: InstanceElement): boolean =>
  instance.getTypeSync().annotations.folderType !== undefined

const getParentFolder: GetParentElementFunc = ({ instance, folderInstancesIndex }) => {
  const { folderType } = instance.getTypeSync().annotations
  const folderName = apiNameSync(instance)?.split('/')[0] ?? ''
  return folderInstancesIndex.get(folderType)?.[folderName]
}

const GET_PARENT_ELEMENT_FUNC_BY_TYPE: Record<string, GetParentElementFunc> = {
  [APPROVAL_PROCESS_METADATA_TYPE]: ({ instance, customObjectByName }) =>
    customObjectByName[apiNameSync(instance)?.split('.')[0] ?? ''],
  [FLOW_METADATA_TYPE]: ({ instance, customObjectByName }) => customObjectByName[instance.value.start?.object],
  [GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE]: ({ instance, customObjectByName }) =>
    customObjectByName[instance.value.relatedEntity],
}

const filter: FilterCreator = ({ config }) => ({
  name: 'addParentRelationship',
  onFetch: async (elements: Element[]) => {
    const allElements = await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll())
    const customObjectByName = _.keyBy(
      allElements.filter(isCustomObjectSync),
      objectType => apiNameSync(objectType) ?? '',
    )
    const folderInstancesIndex = createFolderInstancesIndex(allElements)

    const createdReferencesCount = elements.filter(isMetadataInstanceElementSync).reduce((acc, instance) => {
      const getParentElementFunc = isInstanceWithinFolder(instance)
        ? getParentFolder
        : GET_PARENT_ELEMENT_FUNC_BY_TYPE[metadataTypeOrUndefined(instance) ?? '']
      if (getParentElementFunc === undefined) {
        return acc
      }
      const parent = getParentElementFunc({ instance, customObjectByName, folderInstancesIndex })
      if (parent === undefined) {
        log.warn('could not resolve parent of instance %s', instance.elemID.getFullName())
        return acc
      }
      addElementParentReference(instance, parent)
      return acc + 1
    }, 0)
    log.debug('created %d parent references in total', createdReferencesCount)
  },
})

export default filter
