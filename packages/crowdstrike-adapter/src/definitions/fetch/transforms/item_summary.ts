/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'

/**
 * Convert a list of "item" summaries to a list of IDs, to be converted to references.
 *
 * For example:
 * Several endpoints return group summaries, which are partial representation of the HostGroup element. We want these
 * to be references instead, so we extract the ID and flatten the list. Later, IDs will be converted to references.
 */
export const convertSummaryToIdList =
  (key: string): definitions.AdjustFunctionSingle =>
  async ({ typeName, value }) => {
    validatePlainObject(value, typeName)
    const items = _.get(value, key)
    return {
      value: {
        ...value,
        [key]: Array.isArray(items) ? items.map(item => item?.id) : items,
      },
    }
  }
