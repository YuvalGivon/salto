/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Options } from '../types'

const log = logger(module)

// TODO: This seems like it should work, but many endpoints return nonsense pagination data, like offsets larger than
//  the total. For now, endpoint all use 'none'.
const offsetAndLimitPagination =
  (): definitions.PaginationFunction =>
  ({ responseData, currentParams }) => {
    // `after` is a pagination token. Prefer it over offset if it exists.
    const after: string | undefined = _.get(responseData, 'meta.pagination.after')
    if (after !== undefined) {
      log.debug('Using "after" pagination token: %s', after)
      return [
        _.merge({}, _.omit(currentParams, ['offset']), {
          queryParams: { after },
        }),
      ]
    }
    if (_.get(currentParams.queryParams, 'after') !== undefined) {
      log.debug('No more "after" token in response, ending pagination')
      // CrowdStrike will omit `after` on the last page, but it'll still include the other pagination fields.
      // If we previously used `after`, don't use `offset` in the next request.
      return []
    }
    // CrowdStrike reports offset incorrectly, so we can't rely on it. Rely on the offset sent in the request instead.
    const offset = Number(_.get(currentParams.queryParams, 'offset') ?? 0)
    const total = Number(_.get(responseData, 'meta.pagination.total'))
    const limit = Number(_.get(responseData, 'meta.pagination.limit'))
    log.debug('Pagination state: offset: %d, total: %d, limit: %d', offset, total, limit)
    if (Number.isNaN(offset) || Number.isNaN(total) || offset + limit >= total) {
      log.debug('Reached end of pagination or encountered invalid values')
      return []
    }
    const nextOffset = offset + limit
    log.debug('Continuing pagination with next offset: %d', nextOffset)
    return [
      _.merge({}, currentParams, {
        queryParams: { limit, offset: nextOffset },
      }),
    ]
  }

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  offset: {
    funcCreator: () => offsetAndLimitPagination(),
  },
}
