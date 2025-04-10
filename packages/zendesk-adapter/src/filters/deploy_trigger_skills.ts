/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { get, invert, isString } from 'lodash'
import { TRIGGER_TYPE_NAME } from '../constants'
import {
  NO_PRIORITY_VALUE,
  PRIORITY_NAMES,
  TRIGGER_SKILL_FIELDS,
} from '../definitions/fetch/transforms/trigger_adjuster'
import { FilterCreator } from '../filter'

const log = logger(module)

const PRIORITY_NUMBERS: { [key: string]: string } = {
  ...invert(PRIORITY_NAMES),
  optional: '1', // 'optional' is for backwards compatibility
}

type SkillMapping = Record<string, { value: string | string[]; priority: string | string[] }>
type Action = { value?: string | string[]; priority?: string | string[] }

const extractPriorityNumber = (priority: string): string => {
  if (priority in PRIORITY_NUMBERS) {
    return `#${PRIORITY_NUMBERS[priority]}`
  }
  if (priority.match(/unknown_\d+/)) {
    return `#${priority.split('_')[1]}`
  }
  if (priority === NO_PRIORITY_VALUE) {
    return ''
  }
  log.warn('Received unknown priority: %s', priority)
  return `#${priority}`
}

const restoreTriggerSkillToApi = async (instance: InstanceElement, skillMapping: SkillMapping): Promise<void> => {
  instance.value?.actions
    .filter((action: unknown) => TRIGGER_SKILL_FIELDS.includes(get(action, 'field')))
    .forEach((action: Action) => {
      if ('priority' in action && 'value' in action) {
        const { value, priority } = action
        if (Array.isArray(value) && Array.isArray(priority)) {
          action.value = value.map((attributeValue, index) => {
            const newValue = `${attributeValue}${extractPriorityNumber(priority[index])}`
            skillMapping[`${newValue}.${index}`] = { value: attributeValue, priority: priority[index] }
            return newValue
          })
        } else if (typeof value === 'string' && typeof priority === 'string') {
          action.value = `${value}${extractPriorityNumber(priority)}`
          skillMapping[action.value] = { value, priority }
        }
        delete action.priority
      }
    })
}

const isValidValueArray = (value: unknown, skillMapping: SkillMapping): value is string[] =>
  Array.isArray(value) &&
  value.every(val => typeof val === 'string') &&
  value.every((val, index) => {
    const key = `${val}.${index}`
    return skillMapping[key] !== undefined
  })

/**
 * Restores trigger action skills to match the correct API calls.
 * See https://developer.zendesk.com/documentation/ticketing/using-the-zendesk-api/setting-skill-priority-with-skills-in-trigger-action/
 */
const filterCreator: FilterCreator = () => {
  const skillMapping: Record<string, { value: string; priority: string }> = {}
  return {
    name: 'deployTriggerSkillsFilter',
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      await Promise.all(
        changes
          .map(getChangeData)
          .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
          .map(instance => restoreTriggerSkillToApi(instance, skillMapping)),
      )
    },
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> =>
      changes
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME && Array.isArray(instance.value?.actions))
        .forEach(instance => {
          instance.value.actions = instance.value.actions.map((action: { value: string | string[] }) => {
            try {
              if (isValidValueArray(action.value, skillMapping)) {
                const newActionAndPriority = action.value.map((value, index) => {
                  const key = `${value}.${index}`
                  if (skillMapping[key]) {
                    return {
                      value: skillMapping[key].value,
                      priority: skillMapping[key].priority,
                    }
                  }
                  throw new Error(`Skill mapping for ${key} not found in instance ${instance.elemID.name}`)
                })
                return {
                  ...action,
                  value: newActionAndPriority.map(newAction => newAction.value),
                  priority: newActionAndPriority.map(newAction => newAction.priority),
                }
              }
              if (isString(action.value) && skillMapping[action.value]) {
                return {
                  ...action,
                  value: skillMapping[action.value].value,
                  priority: skillMapping[action.value].priority,
                }
              }
            } catch (error) {
              log.error('Error restoring trigger skill to API: %s', error)
            }
            return action
          })
        }),
  }
}

export default filterCreator
