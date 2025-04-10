/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { transformTriggerItem } from '../../../../src/definitions/fetch/transforms'

describe('trigger_adjuster', () => {
  describe('without priority', () => {
    it('should not update trigger item with add_skills or set_skills field', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'skillWithoutPriority',
            priority: 'no_priority',
          },
          {
            field: 'set_skills',
            value: 'skillWithoutPriority',
            priority: 'no_priority',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({ value })
    })
  })

  describe('with priority', () => {
    it('should transform trigger item with skill priority', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'requiredSkill#0',
          },
          {
            field: 'set_skills',
            value: 'optionalSkillHigh#1',
          },
          {
            field: 'set_skills',
            value: 'optionalSkillMedium#2',
          },
          {
            field: 'set_skills',
            value: 'optionalSkillLow#3',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          actions: [
            {
              field: 'add_skills',
              value: 'requiredSkill',
              priority: 'required',
            },
            {
              field: 'set_skills',
              value: 'optionalSkillHigh',
              priority: 'optional high',
            },
            {
              field: 'set_skills',
              value: 'optionalSkillMedium',
              priority: 'optional medium',
            },
            {
              field: 'set_skills',
              value: 'optionalSkillLow',
              priority: 'optional low',
            },
          ],
        },
      })
    })

    it('should transform trigger item with a number as a priority that does not match skill priority', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'skillWithLargePriority#44',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          actions: [
            {
              field: 'add_skills',
              value: 'skillWithLargePriority',
              priority: 'unknown_44',
            },
          ],
        },
      })
    })

    it('should transform trigger item with mixed skill priority and non-priority skills', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'requiredSkill#0',
          },
          {
            field: 'set_skills',
            value: 'skillWithoutPriority',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          actions: [
            {
              field: 'add_skills',
              value: 'requiredSkill',
              priority: 'required',
            },
            {
              field: 'set_skills',
              value: 'skillWithoutPriority',
              priority: 'no_priority',
            },
          ],
        },
      })
    })

    it('should transform trigger item with array of skills with priorities', async () => {
      const value = {
        title: 'arraySkillsTrigger',
        actions: [
          {
            field: 'add_skills',
            value: ['skill1#1', 'skill2#2', 'skill3#3'],
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          title: 'arraySkillsTrigger',
          actions: [
            {
              field: 'add_skills',
              value: ['skill1', 'skill2', 'skill3'],
              priority: ['optional high', 'optional medium', 'optional low'],
            },
          ],
        },
      })
    })

    it('should transform trigger item with mixed array of skills with and without priorities', async () => {
      const value = {
        title: 'mixedSkillsTrigger',
        actions: [
          {
            field: 'add_skills',
            value: ['skill1#1', 'skill2', 'skill3#3'],
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          title: 'mixedSkillsTrigger',
          actions: [
            {
              field: 'add_skills',
              value: ['skill1', 'skill2', 'skill3'],
              priority: ['optional high', 'no_priority', 'optional low'],
            },
          ],
        },
      })
    })

    it('should transform trigger item with array of skills with unknown priorities', async () => {
      const value = {
        title: 'unknownPrioritiesTrigger',
        actions: [
          {
            field: 'add_skills',
            value: ['skill1#44', 'skill2#55'],
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          title: 'unknownPrioritiesTrigger',
          actions: [
            {
              field: 'add_skills',
              value: ['skill1', 'skill2'],
              priority: ['unknown_44', 'unknown_55'],
            },
          ],
        },
      })
    })
  })

  it('should not update trigger item without actions', async () => {
    const value = { a: 1 }
    const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
    expect(transformedItem).toEqual({ value: { a: 1 } })
  })

  it('should log a warning for invalid skill value', async () => {
    const value = {
      title: 'invalidTrigger',
      actions: [
        {
          field: 'add_skills',
          value: 'invalidWithABang!@?',
        },
      ],
    }
    const logging = logger('zendesk-adapter/src/definitions/fetch/transforms/trigger_adjuster')
    const logWarn = jest.spyOn(logging, 'warn')
    const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
    expect(transformedItem).toEqual({
      value: {
        title: 'invalidTrigger',
        actions: [
          {
            field: 'add_skills',
            value: 'invalidWithABang!@?',
            priority: 'no_priority',
          },
        ],
      },
    })
    expect(logWarn).toHaveBeenCalledWith(
      'For trigger invalidTrigger - Failed to parse skill value with priority: %s',
      'invalidWithABang!@?',
    )
  })
})
