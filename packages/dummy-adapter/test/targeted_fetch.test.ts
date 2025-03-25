/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, ObjectType, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { getAllTargets, getTargetsForElements } from '../src/targeted_fetch'
import testParams from './test_params'

describe('targeted fetch', () => {
  let config: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  const getAlias = (): Promise<string | undefined> => Promise.resolve(undefined)

  beforeEach(() => {
    config = new InstanceElement(
      'config',
      new ObjectType({
        elemID: new ElemID('dummy', 'Config'),
      }),
      { ...testParams },
    )
    elementsSource = buildElementsSourceFromElements([])
  })

  describe('getAllTargets', () => {
    it('should return all types as targets', async () => {
      const result = await getAllTargets({ config, elementsSource, getAlias })

      expect(result.filter(target => target.path[0] === 'Types')).toHaveLength(testParams.numOfTypes)
    })

    it('should handle elements without path correctly', async () => {
      const result = await getAllTargets({ config, elementsSource, getAlias })

      expect(result).toContainEqual({
        group: 'dummy',
        name: 'noPath',
        path: ['noPath'],
      })
    })

    it('should return env specific targets', async () => {
      const envName = 'env1'
      config.value.generateEnvName = envName
      const result = await getAllTargets({ config, elementsSource, getAlias })

      expect(result).toContainEqual({
        group: 'dummy',
        name: `${envName}EnvObj`,
        path: ['EnvStuff', `${envName}EnvObj`],
      })
    })
  })

  describe('getTargetsForElements', () => {
    it('should convert element IDs to targets', async () => {
      const elemIds = [new ElemID('dummy', 'Type1'), new ElemID('dummy', 'Type2')]

      const result = await getTargetsForElements({ elemIds, elementsSource })

      expect(result).toEqual([
        {
          group: 'dummy',
          name: 'Type1',
        },
        {
          group: 'dummy',
          name: 'Type2',
        },
      ])
    })
  })
})
