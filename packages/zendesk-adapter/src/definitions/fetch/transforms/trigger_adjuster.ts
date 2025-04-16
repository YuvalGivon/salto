/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'

const log = logger(module)

export const TRIGGER_SKILL_FIELDS = ['add_skills', 'set_skills']
export const NO_PRIORITY_VALUE = 'no_priority'
const SKILL_WITH_PRIORITY_PATTERN = /^([a-zA-Z0-9-]+)#(\d+)$/ // the regex is a uuid followed by a priority number
export const PRIORITY_NAMES: { [key: string]: string } = {
  '0': 'required',
  '1': 'optional high',
  '2': 'optional medium',
  '3': 'optional low',
}

// Helper function to process a skill string and extract priority
const processSkillWithPriority = (
  skill: string,
  triggerTitle: string = 'unknown',
): { value: string; priority: string } => {
  const skillWithPriority = skill.match(SKILL_WITH_PRIORITY_PATTERN)
  if (skillWithPriority !== null) {
    const priorityValue = skillWithPriority[2]
    const priority = priorityValue in PRIORITY_NAMES ? PRIORITY_NAMES[priorityValue] : `unknown_${priorityValue}`
    if (priority.startsWith('unknown')) {
      log.warn('For trigger %s - Received unknown priority: %s', triggerTitle, priorityValue)
    }
    return {
      value: skillWithPriority[1],
      priority,
    }
  }

  // Log warning for invalid skill values
  if (!skill.match(/^[a-zA-Z0-9-]+$/)) {
    log.warn(`For trigger ${triggerTitle} - Failed to parse skill value with priority: %s`, skill)
  }

  return {
    value: skill,
    priority: NO_PRIORITY_VALUE,
  }
}

// This transformer parses skill priority in trigger actions.
// See https://developer.zendesk.com/documentation/ticketing/using-the-zendesk-api/setting-skill-priority-with-skills-in-trigger-action/
export const transform: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for trigger item, not transforming')
  }

  const actions = _.get(value, 'actions')
  if (actions === undefined || !Array.isArray(actions)) {
    return { value }
  }

  const triggerTitle = _.get(value, 'title', 'unknown')

  const updatedActions = actions.map(action => {
    if (TRIGGER_SKILL_FIELDS.includes(_.get(action, 'field'))) {
      const skillValue = _.get(action, 'value')

      if (Array.isArray(skillValue)) {
        const processedSkills = skillValue.map(skill => {
          if (typeof skill === 'string') {
            return processSkillWithPriority(skill, triggerTitle)
          }
          return {
            value: skill,
            priority: NO_PRIORITY_VALUE,
          }
        })

        return {
          ...action,
          value: processedSkills.map(s => s.value),
          priority: processedSkills.map(s => s.priority),
        }
      }

      if (typeof skillValue === 'string') {
        const processedSkill = processSkillWithPriority(skillValue, triggerTitle)
        return {
          ...action,
          value: processedSkill.value,
          priority: processedSkill.priority,
        }
      }
      log.warn(`For trigger ${triggerTitle} - Received invalid skill value, could not get priority`)
    }
    return { ...action }
  })

  return {
    value: {
      ...value,
      actions: updatedActions,
    },
  }
}
