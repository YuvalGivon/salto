/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  Change,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { TRIGGER_TYPES_FIELD_NAME, TriggerType } from '../../src/filters/extend_triggers_metadata'
import changeValidator from '../../src/change_validators/triggers_pre_post_action'
import { apiNameSync } from '../../src/filters/utils'
import { mockTypes } from '../mock_elements'

describe('Triggers pre/post action change validator', () => {
  const createTriggerInstance = (name: string, triggerTypes: TriggerType[], parentType: ObjectType): InstanceElement =>
    new InstanceElement(
      name,
      mockTypes.ApexTrigger,
      {
        [TRIGGER_TYPES_FIELD_NAME]: triggerTypes,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentType.elemID, parentType)],
      },
    )

  const createDataInstance = (name: string): InstanceElement => new InstanceElement(name, mockTypes.Account, {})

  describe('when there are no changes', () => {
    it('should return an empty array', async () => {
      const changes: Change[] = []
      const elementsSource = buildElementsSourceFromElements([])
      const result = await changeValidator(changes, elementsSource)
      expect(result).toEqual([])
    })
  })

  describe('when there are data changes but no triggers', () => {
    it('should return an empty array', async () => {
      const changes = [toChange({ after: createDataInstance('Account1') })]
      const elementsSource = buildElementsSourceFromElements([])
      const result = await changeValidator(changes, elementsSource)
      expect(result).toEqual([])
    })
  })

  describe('when there are data changes and triggers', () => {
    it('should return a change error', async () => {
      const dataInstance = createDataInstance('Account1')
      const triggerInstance = createTriggerInstance('Trigger1', [TriggerType.UsageBeforeInsert], mockTypes.Account)
      const changes = [toChange({ after: dataInstance })]
      const elementsSource = buildElementsSourceFromElements([triggerInstance])
      const result = await changeValidator(changes, elementsSource)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        elemID: dataInstance.elemID,
        severity: 'Info',
        message: 'Salesforce data changes detected',
        detailedMessage: '',
        deployActions: {
          preAction: {
            title: 'Disable Triggers If Possible',
            description: expect.stringContaining(apiNameSync(triggerInstance) ?? ''),
            subActions: [],
          },
          postAction: {
            title: 'Re-enable Disabled Triggers',
            description: expect.stringContaining(apiNameSync(triggerInstance) ?? ''),
            subActions: [],
          },
        },
      })
    })

    it('should handle multiple triggers for different actions', async () => {
      const dataInstance = createDataInstance('Account1')
      const beforeInsertTrigger = createTriggerInstance(
        'BeforeInsertTrigger',
        [TriggerType.UsageBeforeInsert],
        mockTypes.Account,
      )
      const afterUpdateTrigger = createTriggerInstance(
        'AfterUpdateTrigger',
        [TriggerType.UsageAfterUpdate],
        mockTypes.Account,
      )
      const changes = [toChange({ after: dataInstance }), toChange({ before: dataInstance, after: dataInstance })]
      const elementsSource = buildElementsSourceFromElements([beforeInsertTrigger, afterUpdateTrigger])
      const result = await changeValidator(changes, elementsSource)
      expect(result[0]).toEqual({
        elemID: dataInstance.elemID,
        severity: 'Info',
        message: 'Salesforce data changes detected',
        detailedMessage: '',
        deployActions: {
          preAction: {
            title: 'Disable Triggers If Possible',
            description: expect.stringContaining(apiNameSync(beforeInsertTrigger) ?? ''),
            subActions: [],
          },
          postAction: {
            title: 'Re-enable Disabled Triggers',
            description: expect.stringContaining(apiNameSync(beforeInsertTrigger) ?? ''),
            subActions: [],
          },
        },
      })
    })

    it('should handle triggers with service URLs', async () => {
      const dataInstance = createDataInstance('Account1')
      const triggerInstance = createTriggerInstance('Trigger1', [TriggerType.UsageBeforeInsert], mockTypes.Account)
      triggerInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = 'https://example.com/trigger'
      const changes = [toChange({ after: dataInstance })]
      const elementsSource = buildElementsSourceFromElements([triggerInstance])
      const result = await changeValidator(changes, elementsSource)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        elemID: dataInstance.elemID,
        severity: 'Info',
        message: 'Salesforce data changes detected',
        detailedMessage: '',
        deployActions: {
          preAction: {
            title: 'Disable Triggers If Possible',
            description: expect.stringContaining(triggerInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]),
            subActions: [],
          },
          postAction: {
            title: 'Re-enable Disabled Triggers',
            description: expect.stringContaining(triggerInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]),
            subActions: [],
          },
        },
      })
    })
  })
})
