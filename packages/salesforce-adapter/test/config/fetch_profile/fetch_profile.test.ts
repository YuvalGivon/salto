/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateFetchParameters, buildContext } from '../../../src/config/context/context'
import { mergeWithDefaultImportantValues } from '../../../src/config/context/important_values'
import { FetchParameters } from '../../../src/config/types'

describe('Fetch Profile', () => {
  describe('validateFetchParameters', () => {
    describe('when additional important values contain duplicate definitions', () => {
      it('should throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'fullName', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).toThrow()
      })
    })
    describe('when additional important values are valid', () => {
      it('should not throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'label', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).not.toThrow()
      })
    })
  })
  describe('buildContext', () => {
    it('should build a fetch profile with the correct values', () => {
      const fetchParams: FetchParameters = {
        metadata: { include: [{ metadataType: 'CustomObject' }], exclude: [] },
        additionalImportantValues: [
          { value: 'fullName', highlighted: true, indexed: false },
          { value: 'label', highlighted: true, indexed: true },
        ],
        limits: { maxExtraDependenciesQuerySize: 10, maxExtraDependenciesResponseSize: 10 },
      }
      const maxItemsInRetrieveRequest = 10
      const context = buildContext({
        fetchParams,
        maxItemsInRetrieveRequest,
      })
      expect(context.maxItemsInRetrieveRequest).toEqual(maxItemsInRetrieveRequest)
      expect(context.importantValues).toEqual(mergeWithDefaultImportantValues(fetchParams.additionalImportantValues))
      expect(context.preferActiveFlowVersions).toEqual(false)
      expect(context.limits).toEqual(fetchParams.limits)
    })
  })
})
