/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  StaticFile,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE, RECORDS_PATH, SALESFORCE } from '../constants'
import { apiNameSync, isInstanceOfTypeChangeSync, isInstanceOfTypeSync } from './utils'

type TemplateVersion = {
  content: string | Buffer | StaticFile
}

type GenAiPromptTemplate = InstanceElement & {
  value: {
    templateVersions: TemplateVersion[]
    fullName: string
  }
}

const isTemplateVersion = (version: unknown): version is TemplateVersion => {
  const content = _.get(version, 'content')
  return _.isString(content) || Buffer.isBuffer(content)
}

const isGenAiPromptTemplate = (element: Element): element is GenAiPromptTemplate =>
  isInstanceOfTypeSync(GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE)(element) &&
  _.isArray(_.get(element, 'value.templateVersions')) &&
  element.value.templateVersions.every(isTemplateVersion)

const createStaticFile = (folderName: string, name: string, content: string): StaticFile =>
  new StaticFile({
    filepath: `${folderName}/${name}`,
    content: Buffer.from(content),
  })

const createFolderPath = (instance: InstanceElement): string =>
  `${SALESFORCE}/${RECORDS_PATH}/${GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE}/${instance.value.fullName}`

const organizeStaticFiles = (instance: GenAiPromptTemplate): void => {
  const folderPath = createFolderPath(instance)
  instance.value.templateVersions.forEach((version, index) => {
    version.content = createStaticFile(folderPath, `version_${index + 1}.txt`, version.content as string)
  })
}

const getTemplateVersionsFromChanges = (
  changes: Change[],
): { versionIdentifier: string; version: TemplateVersion; instance: GenAiPromptTemplate }[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceOfTypeChangeSync(GEN_AI_PROMPT_TEMPLATE_METADATA_TYPE))
    .map(getChangeData)
    .filter(isGenAiPromptTemplate)
    .flatMap(instance =>
      instance.value.templateVersions.map((version, index) => ({
        versionIdentifier: `${apiNameSync(instance)}_${index + 1}`,
        version,
        instance,
      })),
    )

const filter: FilterCreator = () => {
  const botVersionsWithStaticFileIdentifiers = new Set<string>()
  return {
    name: 'genAiPromptTemplateFilter',
    onFetch: async (elements: Element[]) => {
      elements.filter(isGenAiPromptTemplate).forEach(instance => organizeStaticFiles(instance))
    },
    preDeploy: async changes => {
      getTemplateVersionsFromChanges(changes).forEach(({ versionIdentifier, version }) => {
        if (_.isBuffer(version.content)) {
          botVersionsWithStaticFileIdentifiers.add(versionIdentifier)
          version.content = version.content.toString()
        }
      })
    },
    onDeploy: async changes => {
      getTemplateVersionsFromChanges(changes).forEach(({ versionIdentifier, version, instance }, index) => {
        if (_.isString(version.content) && botVersionsWithStaticFileIdentifiers.has(versionIdentifier)) {
          const folderPath = createFolderPath(instance)
          version.content = createStaticFile(folderPath, `version_${index + 1}.txt`, version.content)
        }
      })
    },
  }
}

export default filter
