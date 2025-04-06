/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { getElementPrettyName } from '@salto-io/adapter-utils'
import {
  ACTION_NAMES,
  ActionName,
  ChangeValidator,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { apiNameSync, isInstanceOfCustomObjectChangeSync } from '../filters/utils'
import { APEX_TRIGGER_METADATA_TYPE } from '../constants'
import { TRIGGER_TYPES_FIELD_NAME, TriggerType } from '../filters/extend_triggers_metadata'

const { awu } = collections.asynciterable
const { DefaultMap } = collections.map

const TRIGGER_TYPES = new Set(Object.values(TriggerType))

type ApexTriggerInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    [TRIGGER_TYPES_FIELD_NAME]: TriggerType[]
  }
  annotations: InstanceElement['annotations'] & {
    [CORE_ANNOTATIONS.PARENT]: [ReferenceExpression]
  }
}

type DataInstancesAndTriggersIndexEntry = {
  [key in ActionName]: { dataInstances: InstanceElement[]; triggers: ApexTriggerInstance[] }
}

const isApexTriggerInstance = (instance: InstanceElement): instance is ApexTriggerInstance => {
  const triggerTypes = instance.value[TRIGGER_TYPES_FIELD_NAME]
  const triggerParent = instance.annotations[CORE_ANNOTATIONS.PARENT]
  return (
    _.isArray(triggerTypes) &&
    triggerTypes.every(triggerType => TRIGGER_TYPES.has(triggerType)) &&
    _.isArray(triggerParent) &&
    isReferenceExpression(triggerParent[0])
  )
}

const triggerTypeToAction: Record<TriggerType, ActionName> = {
  [TriggerType.UsageBeforeInsert]: 'add',
  [TriggerType.UsageAfterInsert]: 'add',
  [TriggerType.UsageAfterUndelete]: 'add',
  [TriggerType.UsageBeforeUpdate]: 'modify',
  [TriggerType.UsageAfterUpdate]: 'modify',
  [TriggerType.UsageBeforeDelete]: 'remove',
  [TriggerType.UsageAfterDelete]: 'remove',
}

const triggerPrettyName = (instance: ApexTriggerInstance): string => {
  const triggerName = getElementPrettyName(instance)
  const serviceUrl = instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]
  return _.isString(serviceUrl) ? `[${triggerName}](${serviceUrl})` : `${triggerName}`
}

const actionToPrettyName: Record<ActionName, string> = {
  add: 'Addition',
  modify: 'Modification',
  remove: 'Removal',
}

const entryDescription = ({
  action,
  dataInstances,
  triggers,
}: {
  action: ActionName
  dataInstances: InstanceElement[]
  triggers: ApexTriggerInstance[]
}): string | undefined => {
  if (dataInstances.length === 0 || triggers.length === 0) {
    return undefined
  }
  const type = getElementPrettyName(dataInstances[0].getTypeSync())
  return `${actionToPrettyName[action]} of ${type} instances: ${triggers.map(triggerPrettyName).join(', ')}.`
}

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  const customObjectInstancesChanges = changes.filter(isInstanceOfCustomObjectChangeSync)
  if (elementsSource === undefined || customObjectInstancesChanges.length === 0) {
    return []
  }
  const index = new DefaultMap<string, DataInstancesAndTriggersIndexEntry>(() => ({
    add: { dataInstances: [], triggers: [] },
    modify: { dataInstances: [], triggers: [] },
    remove: { dataInstances: [], triggers: [] },
  }))
  customObjectInstancesChanges.forEach(change => {
    const instanceType = apiNameSync(getChangeData(change).getTypeSync())
    if (instanceType === undefined) {
      return
    }
    index.get(instanceType)[change.action].dataInstances.push(getChangeData(change))
  })
  await awu(await elementsSource.list())
    .filter(elemId => elemId.typeName === APEX_TRIGGER_METADATA_TYPE)
    .map(elementsSource.get)
    .filter(isInstanceElement)
    .filter(isApexTriggerInstance)
    .forEach(trigger => {
      const parentType = trigger.annotations[CORE_ANNOTATIONS.PARENT][0].elemID.name
      const indexEntry = index.getOrUndefined(parentType)
      if (indexEntry === undefined) {
        return
      }
      _.uniq(trigger.value[TRIGGER_TYPES_FIELD_NAME].map(triggerType => triggerTypeToAction[triggerType])).forEach(
        action => {
          indexEntry[action].triggers.push(trigger)
        },
      )
    })

  const entryDescriptions: string[] = []
  // Iterate over index and invoke entryPrettyName
  index.forEach((entry, _type) => {
    ACTION_NAMES.forEach(action => {
      const description = entryDescription({
        action,
        dataInstances: entry[action].dataInstances,
        triggers: entry[action].triggers,
      })
      if (description) {
        entryDescriptions.push(description)
      }
    })
  })
  if (entryDescriptions.length === 0) {
    return []
  }
  const preActionDescription = [
    'Your deployment contains data instances. The following triggers will run for each group of changes:',
  ]
    .concat(entryDescriptions)
    .concat('If possible, we advise you to disable these triggers prior to your deployment.')
    .join('\n')

  const postActionDescription = [
    'Your deployment has been completed. The following triggers ran as part of your deployment:',
  ]
    .concat(entryDescriptions)
    .concat('Re-enable the triggers you have disabled prior to your deployment.')
    .join('\n')

  return [
    {
      elemID: getChangeData(customObjectInstancesChanges[0]).elemID,
      severity: 'Info',
      message: 'Salesforce data changes detected',
      detailedMessage: '',
      deployActions: {
        preAction: {
          title: 'Disable Triggers If Possible',
          description: preActionDescription,
          subActions: [],
        },
        postAction: {
          title: 'Re-enable Disabled Triggers',
          description: postActionDescription,
          subActions: [],
        },
      },
    },
  ]
}

export default changeValidator
