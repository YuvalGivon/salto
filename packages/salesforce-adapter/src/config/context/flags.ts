/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ReadOnlyElementsSource, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { FLAGS_ITERATION_FIELD_NAME, FLAGS_ITERATION_TYPE_NAME, SALESFORCE, ArtificialTypes } from '../../constants'
import { Flags, FlagsSettings } from '../types'

const log = logger(module)

const CURRENT_FLAGS_ITERATION = 0

export const API_VERSION = '62.0'

type FlagsIterations = {
  [FlagName in keyof Flags]: number
}

const FLAGS_ITERATIONS: FlagsIterations = {
  testFlag: 1,
  supportProfileTabVisibilities: 1,
  picklistsAsMaps: 1,
  retrieveAllTypes: 1,
}

export const getIteration = async (
  elementsSource: ReadOnlyElementsSource | undefined,
  flagsSettings: FlagsSettings | undefined,
  preferCurrent = false,
): Promise<number> => {
  const currentIteration = flagsSettings?.currentIterationOverride ?? CURRENT_FLAGS_ITERATION
  if (!elementsSource || preferCurrent) {
    log.debug(`Using current flags iteration: ${currentIteration}`)
    return currentIteration
  }
  const flagsIteration = await elementsSource.get(
    new ElemID(SALESFORCE, FLAGS_ITERATION_TYPE_NAME, 'instance', ElemID.CONFIG_NAME, FLAGS_ITERATION_FIELD_NAME),
  )
  if (!_.isNumber(flagsIteration)) {
    log.warn(`Flags iteration is not a number: ${flagsIteration}`)
    log.debug(`Using current flags iteration: ${currentIteration}`)
    return currentIteration
  }
  log.debug(`Using flags iteration from elements source: ${flagsIteration}`)
  return flagsIteration
}

export const isFlagEnabled = (flag: keyof Flags, iteration?: number, flagsSettings?: FlagsSettings): boolean =>
  flagsSettings?.flagOverrides?.[flag] ??
  FLAGS_ITERATIONS[flag] <= (flagsSettings?.iterationOverride ?? iteration ?? CURRENT_FLAGS_ITERATION)

export const createFlagsIterationInstance = (iteration: number): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, ArtificialTypes[FLAGS_ITERATION_TYPE_NAME], {
    [FLAGS_ITERATION_FIELD_NAME]: iteration,
  })
