/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FileProperties } from '@salto-io/jsforce-types'
import {
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isObjectType,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { inspectValue, resolveTypeShallow } from '@salto-io/adapter-utils'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterResult, FilterCreator } from '../filter'
import {
  ACTIVE_VERSION_NUMBER,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_FIELD,
  SALESFORCE,
} from '../constants'
import { fetchMetadataInstances } from '../fetch'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { FetchElements, Context } from '../config/types'
import {
  apiNameSync,
  findObjectType,
  isDeactivatedFlowChangeOnly,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
  listMetadataObjects,
} from './utils'
import { SalesforceRecord } from '../client/types'

const { isDefined } = lowerdashValues

const log = logger(module)
const { DefaultMap } = collections.map
const { toArrayAsync } = collections.asynciterable

const DEFAULT_CHUNK_SIZE = 500

type AuthorInfo = { Name: string } | null
type FlowVersionRecord = SalesforceRecord & {
  DefinitionId: string
  VersionNumber: number
  Status: string
  CreatedDate: string
  CreatedBy: AuthorInfo
  LastModifiedDate: string
  LastModifiedBy: AuthorInfo
}

const isValidAuthorInfo = (value: unknown): value is AuthorInfo =>
  (_.isPlainObject(value) && _.isString(_.get(value, 'Name'))) || value === null

const isFlowVersionRecord = (record: SalesforceRecord): record is FlowVersionRecord =>
  _.isString(record.DefinitionId) &&
  _.isString(record.Status) &&
  _.isNumber(record.VersionNumber) &&
  _.isString(record.CreatedDate) &&
  isValidAuthorInfo(record.CreatedBy) &&
  _.isString(record.LastModifiedDate) &&
  isValidAuthorInfo(record.LastModifiedBy)

type FlowVersionProperties = {
  id: string
  version: number
  status: string
  createdByName?: string
  createdDate: string
  lastModifiedByName?: string
  lastModifiedDate: string
}

const getFlowVersionsByApiName = async ({
  client,
  flowDefinitions,
  chunkSize,
}: {
  client: SalesforceClient
  flowDefinitions: InstanceElement[]
  chunkSize: number
}): Promise<Map<string, FlowVersionProperties[]>> => {
  const flowDefinitionsIdsToApiNames = Object.fromEntries(
    flowDefinitions
      .map(flow => [flow.value[INTERNAL_ID_FIELD], flow.value[INSTANCE_FULL_NAME_FIELD]])
      .filter((entry): entry is [string, string] => entry.every(_.isString)),
  )
  const records = _.flatten(
    await Promise.all(
      _.chunk(Object.keys(flowDefinitionsIdsToApiNames), chunkSize).map(async chunk => {
        const query = `SELECT Id, DefinitionId, VersionNumber, Status, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM Flow WHERE DefinitionId IN ('${chunk.join("','")}')`
        return (await toArrayAsync(await client.queryAll(query, true))).flat()
      }),
    ),
  )
  const [validRecords, invalidRecords] = _.partition(records, isFlowVersionRecord)
  if (invalidRecords.length > 0) {
    log.warn(
      'Some Flow version records are invalid. Records are: %s',
      inspectValue(invalidRecords, { maxArrayLength: 10 }),
    )
    if (invalidRecords.length > 10) {
      log.trace('All invalid Flow version records are: %s', inspectValue(invalidRecords, { maxArrayLength: null }))
    }
  }
  return validRecords.reduce(
    (acc, record) => {
      const apiName = flowDefinitionsIdsToApiNames[record.DefinitionId]
      if (apiName === undefined) {
        log.warn('Got flow version with unrecognized flow definition ID: %s', inspectValue(record))
        return acc
      }
      acc.get(apiName).push({
        id: record.Id,
        version: record.VersionNumber,
        status: record.Status,
        createdByName: record.CreatedBy?.Name,
        createdDate: record.CreatedDate,
        lastModifiedByName: record.LastModifiedBy?.Name,
        lastModifiedDate: record.LastModifiedDate,
      })
      return acc
    },
    new DefaultMap<string, FlowVersionProperties[]>(() => []),
  )
}

type versionSelector = (versions: FlowVersionProperties[]) => FlowVersionProperties | undefined
const selectLatestVersion: versionSelector = versions => _.maxBy(versions, 'version')
const selectActiveVersion: versionSelector = versions =>
  versions.find(version => version.status === 'Active') ?? selectLatestVersion(versions)

const createSelectedVersionFileProperties = async ({
  flowsFileProps,
  flowDefinitions,
  client,
  context,
}: {
  flowsFileProps: FileProperties[]
  flowDefinitions: InstanceElement[]
  client: SalesforceClient
  context: Context
}): Promise<FileProperties[]> => {
  const flowVersionsByApiName = await getFlowVersionsByApiName({
    client,
    flowDefinitions,
    chunkSize: context.limits?.flowDefinitionsQueryChunkSize ?? DEFAULT_CHUNK_SIZE,
  })
  const versionSelector = context.preferActiveFlowVersions ? selectActiveVersion : selectLatestVersion
  const selectedVersions = new Map<string, FlowVersionProperties | undefined>()
  flowVersionsByApiName.forEach((versions, apiName) => {
    selectedVersions.set(apiName, versionSelector(versions))
  })
  return flowsFileProps.map(prop => {
    const selectedVersion = selectedVersions.get(prop.fullName)
    if (selectedVersion === undefined) {
      return prop
    }
    return {
      ...prop,
      ...selectedVersion,
      fullName: `${prop.fullName}-${selectedVersion.version}`,
    }
  })
}

const getFlowWithoutVersion = (element: InstanceElement): InstanceElement => {
  const prevFullName = element.value.fullName
  const flowName = prevFullName.includes('-') ? prevFullName.split('-').slice(0, -1).join('-') : prevFullName
  return createInstanceElement(
    { ...element.value, fullName: flowName },
    element.getTypeSync(),
    undefined,
    element.annotations,
  )
}

const createDeactivatedFlowDefinitionChange = (
  flowChange: Change<InstanceElement>,
  flowDefinitionMetadataType: ObjectType,
): Change<InstanceElement> => {
  const flowApiName = apiNameSync(getChangeData(flowChange))
  if (flowApiName === undefined) {
    throw new Error('Attempting to deploy a flow with no apiName')
  }
  const flowDefinitionInstance = createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: flowApiName,
      [ACTIVE_VERSION_NUMBER]: 0,
    },
    flowDefinitionMetadataType,
  )
  return toChange({ after: flowDefinitionInstance })
}

const getFlowInstances = async (
  client: SalesforceClient,
  context: Context,
  flowType: ObjectType,
  flowDefinitions: InstanceElement[],
): Promise<FetchElements<InstanceElement[]>> => {
  const { elements: flowsFileProps, configChanges } = await listMetadataObjects(client, FLOW_METADATA_TYPE)

  const flowsVersionProps = await createSelectedVersionFileProperties({
    flowsFileProps,
    flowDefinitions,
    client,
    context,
  })
  const instances = await fetchMetadataInstances({
    client,
    fileProps: flowsVersionProps,
    metadataType: flowType,
    metadataQuery: context.metadataQuery,
    maxInstancesPerType: context.maxInstancesPerType,
  })
  return {
    configChanges: instances.configChanges.concat(configChanges),
    elements: instances.elements.map(getFlowWithoutVersion),
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'flowsFilter',
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    if (client === undefined) {
      return {}
    }
    const flowDefinitions = elements.filter(isInstanceOfTypeSync(FLOW_DEFINITION_METADATA_TYPE))
    flowDefinitions.forEach(flowDefinition => {
      flowDefinition.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    })

    const flowType = findObjectType(elements, FLOW_METADATA_TYPE)
    if (!config.context.metadataQuery.isTypeMatch(FLOW_METADATA_TYPE) || flowType === undefined) {
      return {}
    }
    const instances = await getFlowInstances(client, config.context, flowType, flowDefinitions)
    instances.elements.forEach(e => elements.push(e))
    return {
      configSuggestions: [...instances.configChanges],
    }
  },
  // In order to deactivate a Flow, we need to create a FlowDefinition instance with activeVersionNumber of 0
  preDeploy: async changes => {
    const deactivatedFlowOnlyChanges = changes.filter(isDeactivatedFlowChangeOnly)
    if (deactivatedFlowOnlyChanges.length === 0) {
      return
    }
    const flowDefinitionType = await config.elementsSource.get(new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE))
    if (!isObjectType(flowDefinitionType)) {
      log.error(
        'Failed to deactivate flows since the FlowDefinition metadata type does not exist in the elements source',
      )
      return
    }
    await resolveTypeShallow(flowDefinitionType, config.elementsSource)
    deactivatedFlowOnlyChanges
      .map(flowChange => createDeactivatedFlowDefinitionChange(flowChange, flowDefinitionType))
      .forEach(flowDefinitionChange => changes.push(flowDefinitionChange))
  },

  // Remove the created FlowDefinition instances
  onDeploy: async changes => {
    const flowDefinitionChanges = changes.filter(isInstanceOfTypeChangeSync(FLOW_DEFINITION_METADATA_TYPE))
    if (flowDefinitionChanges.length === 0) {
      return
    }
    const deactivatedFlowNames = flowDefinitionChanges
      .map(getChangeData)
      .map(change => apiNameSync(change))
      .filter(isDefined)
    log.info(`Successfully deactivated the following flows: ${deactivatedFlowNames.join(' ')}`)
    _.pullAll(changes, flowDefinitionChanges)
  },
})

export default filterCreator
