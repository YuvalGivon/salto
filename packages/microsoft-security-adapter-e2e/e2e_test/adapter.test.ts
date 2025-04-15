/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { e2eUtils, adapter } from '@salto-io/microsoft-security-adapter'
import { Workspace } from '@salto-io/workspace'
import { Element, InstanceElement, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import {
  e2eDeploy,
  fetchWorkspace,
  getElementsFromWorkspace,
  setupWorkspace,
  helpers as e2eHelpers,
} from '@salto-io/e2e-test-utils'
import { promises } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import { credsLease } from './adapter'
import { getAllInstancesToDeploy, UNIQUE_NAME } from './e2e_instance_generator'
import {
  getModificationDetailedChangesForCleanup,
  getModificationDetailedChangesFromInstances,
  microsoftSecurityCleanupChangeErrorFilter,
  microsoftSecurityCleanupValidationFilter,
  microsoftSecurityDeployChangeErrorFilter,
  verifyInstanceValues,
} from './helpers'
import { modificationChangesBeforeAndAfterOverrides } from './mock_elements'

const log = logger(module)
const { sleep } = promises.timeout

// Set long timeout as we communicate with Microsoft Graph APIs
jest.setTimeout(1000 * 60 * 15)

const adapterCreators = {
  microsoft_security: adapter,
}

const fetchDefinitions = e2eUtils.createFetchDefinitions({
  Entra: true,
  Intune: true,
  Defender: true,
})

const microsoftSecurityCleanUp = async (instances: InstanceElement[], workspace: Workspace): Promise<void> => {
  const instancesToClean = instances.filter(instance => instance.elemID.name.includes(UNIQUE_NAME))
  const typesToModify = Object.keys(modificationChangesBeforeAndAfterOverrides)
  const [instancesToModify, instancesToRemove] = _.partition(instancesToClean, instance =>
    typesToModify.includes(instance.elemID.typeName),
  )
  const detailedChangesToRemove = e2eHelpers.getDeletionDetailedChangesFromInstances(instancesToRemove)
  const detailedChangesToModify = getModificationDetailedChangesForCleanup(instancesToModify)
  const detailedChangesToClean = detailedChangesToRemove.concat(detailedChangesToModify)
  if (detailedChangesToClean.length > 0) {
    await e2eDeploy({
      workspace,
      detailedChanges: detailedChangesToClean,
      adapterCreators,
      changeErrorFilter: microsoftSecurityCleanupChangeErrorFilter,
      validationFilter: microsoftSecurityCleanupValidationFilter,
    })
  }
}

const fetchBaseInstances = async (
  workspace: Workspace,
): Promise<{ types: ObjectType[]; firstFetchInstances: InstanceElement[] }> => {
  await fetchWorkspace({ workspace, adapterCreators })
  const elements = await getElementsFromWorkspace(workspace)
  const firstFetchInstances = elements.filter(isInstanceElement)
  const types = elements.filter(isObjectType)
  await microsoftSecurityCleanUp(firstFetchInstances, workspace)
  return { firstFetchInstances, types }
}

describe('Microsoft Security adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<e2eUtils.Credentials>
    let elements: Element[] = []
    let workspace: Workspace
    let instancesToAdd: InstanceElement[]
    let instancesToModify: InstanceElement[]

    afterAll(async () => {
      await microsoftSecurityCleanUp(elements.filter(isInstanceElement), workspace)
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Microsoft Security adapter E2E: Log counts = %o', log.getLogCount())
    })

    // Needs to be after the afterAll because setupWorkspace has an afterAll of itself which closes the workspace
    const getWorkspace = setupWorkspace()

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      const { credentialsType } = adapter.authenticationMethods.basic
      workspace = await getWorkspace({
        envName: 'microsoft-security-env',
        adapterName: 'microsoft_security',
        credLease,
        configOverride: e2eUtils.DEFAULT_CONFIG,
        adapterCreators,
        credentialsType,
      })
      const { types, firstFetchInstances } = await fetchBaseInstances(workspace)
      ;({ instancesToAdd, instancesToModify } = await getAllInstancesToDeploy({
        types,
      }))

      const additionChanges = e2eHelpers.getAdditionDetailedChangesFromInstances(instancesToAdd)
      const modificationChanges = getModificationDetailedChangesFromInstances({
        firstFetchInstances,
        instancesToModify,
      })

      await e2eDeploy({
        workspace,
        detailedChanges: [...additionChanges, ...modificationChanges],
        adapterCreators,
        changeErrorFilter: microsoftSecurityDeployChangeErrorFilter,
      })

      // TODO SALTO-7618: this is temporary workaround, to wait for the conditional access policy to be available
      await sleep(1000 * 60 * 2)

      await fetchWorkspace({ workspace, adapterCreators })
      elements = await getElementsFromWorkspace(workspace)
    })

    it('should fetch the regular instances and types', async () => {
      const instances = elements.filter(isInstanceElement)
      const expectedTopLevelTypeNames = Object.entries(
        definitions.queryWithDefault(fetchDefinitions.instances).getAll(),
      )
        .filter(([_typeName, def]) => def.element?.topLevel?.isTopLevel)
        .map(([typeName]) => typeName)
      const fetchedInstancesTypeNames = instances.map(e => e.elemID.typeName)
      const missingTypes = new Set(
        expectedTopLevelTypeNames.filter(typeName => !fetchedInstancesTypeNames.includes(typeName)),
      )
      const unexpectedTypes = new Set(
        fetchedInstancesTypeNames.filter(typeName => !expectedTopLevelTypeNames.includes(typeName)),
      )
      expect(Array.from(missingTypes)).toEqual([])
      expect(Array.from(unexpectedTypes)).toEqual([])
    })

    it('should fetch the newly deployed instances', async () => {
      const instances = instancesToAdd
      const fetchedInstances = elements.filter(isInstanceElement)
      instances.forEach(instanceToAdd => {
        const fetchedInstance = fetchedInstances.find(e => e.elemID.isEqual(instanceToAdd.elemID))
        verifyInstanceValues({ fetchDefinitions, fetchedInstance, originalInstance: instanceToAdd })
      })
    })
  })
})
