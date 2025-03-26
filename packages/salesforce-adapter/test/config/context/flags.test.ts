/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { SALESFORCE } from '../../../src/constants'
import {
  getIteration,
  isFlagEnabled,
  CURRENT_FLAGS_ITERATION,
  createFlagsIterationInstance,
} from '../../../src/config/context/flags'
import { FlagsSettings } from '../../../src/config/types'

describe('flags', () => {
  describe('getIteration', () => {
    it('should return CURRENT_FLAGS_ITERATION when elementsSource is not provided', async () => {
      const result = await getIteration()
      expect(result).toBe(CURRENT_FLAGS_ITERATION)
    })

    it('should return iteration from elementsSource when available', async () => {
      const iteration = 5
      const elementsSource = buildElementsSourceFromElements([createFlagsIterationInstance(iteration)])

      const result = await getIteration(elementsSource)
      expect(result).toBe(iteration)
    })

    it('should return CURRENT_FLAGS_ITERATION when the flags iteration instance is missing', async () => {
      const elementsSource = buildElementsSourceFromElements([])

      const result = await getIteration(elementsSource)
      expect(result).toBe(CURRENT_FLAGS_ITERATION)
    })

    it('should return CURRENT_FLAGS_ITERATION when the flags iteration instance is malformed', async () => {
      const nonNumberInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({ elemID: new ElemID(SALESFORCE, 'FlagsIteration') }),
        { iteration: 'not a number' },
      )
      const elementsSource = buildElementsSourceFromElements([nonNumberInstance])

      const result = await getIteration(elementsSource)
      expect(result).toBe(CURRENT_FLAGS_ITERATION)
    })
  })

  describe('isFlagEnabled', () => {
    it('should return true when flag iteration is greater than or equal to current iteration', () => {
      const result = isFlagEnabled('testFlag', 1)
      expect(result).toBe(true)
    })

    it('should return false when flag iteration is less than current iteration', () => {
      const result = isFlagEnabled('testFlag', 0)
      expect(result).toBe(false)
    })

    it('should respect flagOverrides when provided', () => {
      const flagsSettings: FlagsSettings = {
        flagOverrides: {
          testFlag: true,
        },
      }
      const result = isFlagEnabled('testFlag', 0, flagsSettings)
      expect(result).toBe(true)
    })

    it('should respect iterationOverride when provided', () => {
      const flagsSettings: FlagsSettings = {
        iterationOverride: 1,
      }
      const result = isFlagEnabled('testFlag', 0, flagsSettings)
      expect(result).toBe(true)
    })
  })

  describe('createFlagsIterationInstance', () => {
    it('should create the correct instance', () => {
      const iteration = 5
      const instance = createFlagsIterationInstance(iteration)

      expect(instance.elemID).toEqual(new ElemID(SALESFORCE, 'FlagsIteration', 'instance', ElemID.CONFIG_NAME))
      expect(instance.value.iteration).toBe(iteration)
    })
  })
})
