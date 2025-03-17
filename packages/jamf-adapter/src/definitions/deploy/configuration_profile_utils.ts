/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import * as plist from 'plist'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'

const log = logger(module)

/**
 * Converts JSON payloads back to XML for deployment
 * This is the opposite operation of parseXmlPayloadsToJson in the fetch transform
 */
export const preparePayloadsForDeploy: definitions.AdjustFunction<
  definitions.deploy.ChangeAndExtendedContext
> = async ({ value }) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  const payloads = _.get(value, 'general.payloads')
  if (values.isPlainRecord(payloads)) {
    try {
      const processedPayloads = fetchUtils.element.recursiveNaclCase(payloads, false)

      // convert back to XML with plist
      const xmlPayloads = plist.build(processedPayloads)

      // set the payloads back to XML format
      _.set(value, 'general.payloads', xmlPayloads)
    } catch (error) {
      log.error('Failed to convert payloads back to XML: %o', error)
    }
  }
  return { value }
}
