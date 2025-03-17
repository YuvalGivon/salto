/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'

/**
 * Convert a list of group summaries to a list of IDs, to be converted to references.
 *
 * Several endpoints return group summaries, which are partial representation of the HostGroup element. We want these
 * to be references instead, so we extract the ID and flatten the list. Later, IDs will be converted to references.
 */
export const convertGroupSummaryToIdList: definitions.AdjustFunctionSingle = async ({ typeName, value }) => {
  validatePlainObject(value, typeName)
  const groups = Array.isArray(value?.groups) ? value?.groups.map(group => group?.id) : value?.groups
  return { value: { ...value, groups } }
}
