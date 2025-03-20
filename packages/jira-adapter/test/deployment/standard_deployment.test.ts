/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, SaltoError, toChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { defaultDeployChange, defaultServiceIdSetter, deployChanges } from '../../src/deployment/standard_deployment'
import { JIRA } from '../../src/constants'
import { createEmptyType, mockClient } from '../utils'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})
const logging = logger('jira-adapter/src/deployment/standard_deployment')
const logSpy = jest.spyOn(logging, 'warn')

describe('deployChanges', () => {
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })
    instance = new InstanceElement('instance', type)
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    logSpy.mockReset()
  })
  it('should return salto element errors when failed', async () => {
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw new Error('failed')
    })
    expect(res.appliedChanges).toHaveLength(0)
    expect(res.errors).toEqual([
      {
        message: 'Error: failed',
        detailedMessage: 'Error: failed',
        severity: 'Error',
        elemID: instance.elemID,
      },
    ])
  })

  it('should return the applied change and an error when the error severity is not Error', async () => {
    const warningError: SaltoError = {
      message: 'warning message',
      detailedMessage: 'warning detailed message',
      severity: 'Warning',
    }
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw warningError
    })
    expect(res.appliedChanges).toHaveLength(1)
    expect(res.appliedChanges[0]).toEqual(toChange({ after: instance }))
    expect(res.errors).toEqual([
      {
        message: 'warning message',
        detailedMessage: 'warning detailed message',
        severity: 'Warning',
        elemID: instance.elemID,
      },
    ])
  })
  describe('serviceIdSetter', () => {
    it('should set the serviceId', async () => {
      mockDeployChange.mockResolvedValueOnce({ id: '12' })
      await defaultDeployChange({
        change: toChange({ after: instance }),
        client: mockClient().client,
        apiDefinitions: config.apiDefinitions,
      })
      expect(instance.value.id).toEqual('12')
    })
  })
  it('should use responseServiceIdField if defined', async () => {
    mockDeployChange.mockResolvedValueOnce({ serviceId: '12' })
    await defaultDeployChange({
      change: toChange({ after: instance }),
      client: mockClient().client,
      apiDefinitions: config.apiDefinitions,
      responseServiceIdField: 'serviceId',
    })
    expect(instance.value.id).toEqual('12')
  })
  it('should log error and not crash if response is undefined', async () => {
    mockDeployChange.mockResolvedValueOnce(undefined)
    await defaultDeployChange({
      change: toChange({ after: instance }),
      client: mockClient().client,
      apiDefinitions: config.apiDefinitions,
    })
    expect(instance.value.id).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith(`Service id field id not found in response: ${undefined}`)
  })
  it('should log error and not crash if response is an array', async () => {
    mockDeployChange.mockResolvedValueOnce([])
    await defaultDeployChange({
      change: toChange({ after: instance }),
      client: mockClient().client,
      apiDefinitions: config.apiDefinitions,
    })
    expect(instance.value.id).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith('Received unexpected response from deployChange: %o', [])
  })
  it('should log error and not crash if id does not exist in response', async () => {
    mockDeployChange.mockResolvedValueOnce({})
    await defaultDeployChange({
      change: toChange({ after: instance }),
      client: mockClient().client,
      apiDefinitions: config.apiDefinitions,
    })
    expect(instance.value.id).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith(`Service id field id not found in response: ${{}}`)
  })
  it('should log error and not crash if responseServiceIdField does not exist in response', async () => {
    mockDeployChange.mockResolvedValueOnce({})
    await defaultDeployChange({
      change: toChange({ after: instance }),
      client: mockClient().client,
      apiDefinitions: config.apiDefinitions,
      responseServiceIdField: 'serviceId',
    })
    expect(instance.value.id).toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith(`Service id field serviceId not found in response: ${{}}`)
  })
})
describe('defaultServiceIdSetter', () => {
  let instance: InstanceElement
  let response: clientUtils.ResponseValue
  beforeEach(() => {
    instance = new InstanceElement('instance', createEmptyType('type'))
    response = { id: 'serviceId' }
  })

  it('should use the serviceFieldId if responseServiceIdField is not defined', async () => {
    defaultServiceIdSetter(instance, 'id', response)
    expect(instance.value.id).toEqual('serviceId')
  })
})
