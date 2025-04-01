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

const DEFAULT_FLAGS_ITERATION = 0

// To bump the API set API_VERSION to the new version,
// set PREVIOUS_API_VERSION to the old version,
// and set the API_BUMP_ITERATION to the iteration you want to bump in.
// Also consider changing the E2E API version in the e2e_test/adapter.ts file.
const API_VERSION = '63.0'
const PREVIOUS_API_VERSION = '62.0'
const API_BUMP_ITERATION = 1

type FlagsIterations = {
  [FlagName in keyof Flags]: number
}

const FLAGS_ITERATIONS: FlagsIterations = {
  testFlag: 1,
  supportProfileTabVisibilities: 1,
  picklistsAsMaps: 1,
  retrieveAllTypes: 1,
}

export const getIteration = async ({
  elementSource,
  flagsSettings,
  preferDefault = false,
}: {
  elementSource: ReadOnlyElementsSource | undefined
  flagsSettings: FlagsSettings | undefined
  preferDefault?: boolean
}): Promise<number> => {
  const defaultIteration = flagsSettings?.defaultIterationOverride ?? DEFAULT_FLAGS_ITERATION
  if (!elementSource || preferDefault) {
    log.debug(`Using default flags iteration: ${defaultIteration}`)
    return defaultIteration
  }
  const flagsIteration = await elementSource.get(
    new ElemID(SALESFORCE, FLAGS_ITERATION_TYPE_NAME, 'instance', ElemID.CONFIG_NAME, FLAGS_ITERATION_FIELD_NAME),
  )
  if (!_.isNumber(flagsIteration)) {
    log.warn(`Flags iteration is not a number: ${flagsIteration}`)
    log.debug(`Using current flags iteration: ${defaultIteration}`)
    return defaultIteration
  }
  log.debug(`Using flags iteration from elements source: ${flagsIteration}`)
  return flagsIteration
}

export const isFlagEnabled = (
  flag: keyof Flags,
  iteration: number | undefined,
  flagsSettings: FlagsSettings | undefined,
): boolean =>
  flagsSettings?.flagOverrides?.[flag] ??
  FLAGS_ITERATIONS[flag] <= (flagsSettings?.iterationOverride ?? iteration ?? DEFAULT_FLAGS_ITERATION)

export const getApiVersion = (iteration: number | undefined, flagsSettings: FlagsSettings | undefined): string =>
  flagsSettings?.apiVersionOverride ??
  ((flagsSettings?.iterationOverride ?? iteration ?? DEFAULT_FLAGS_ITERATION) >= API_BUMP_ITERATION
    ? API_VERSION
    : PREVIOUS_API_VERSION)

export const createFlagsIterationInstance = (iteration: number): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, ArtificialTypes[FLAGS_ITERATION_TYPE_NAME], {
    [FLAGS_ITERATION_FIELD_NAME]: iteration,
  })
