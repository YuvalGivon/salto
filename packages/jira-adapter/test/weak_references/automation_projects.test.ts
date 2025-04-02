/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../src/constants'
import { automationProjectsHandler } from '../../src/weak_references/automation_projects'

describe('automation_projects', () => {
  let projectInstance: InstanceElement
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    projectInstance = new InstanceElement('proj1', new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) }))

    elementsSource = buildElementsSourceFromElements([projectInstance])

    instance = new InstanceElement('inst', new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) }), {
      projects: [
        { projectId: 'proj1' },
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')) },
        { projectType: 'software' },
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references projects', async () => {
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('1', 'projectId'), target: projectInstance.elemID, type: 'weak' },
        {
          source: instance.elemID.createNestedID('2', 'projectId'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2'),
          type: 'weak',
        },
      ])
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.projects = 'invalid'
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.projects
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid projects', async () => {
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('projects'),
          severity: 'Info',
          message: 'Some attached projects were removed from this automation',
          detailedMessage:
            'Some projects that were attached to this automation were removed, as they do not exist in the target environment.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.projects).toEqual([
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectType: 'software' },
      ])
    })

    it('should remove all projects (they are all invalid)', async () => {
      instance.value.projects = [
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')) },
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj3')) },
      ]
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('projects'),
          severity: 'Info',
          message: 'Attached projects do not exist in the target environment',
          detailedMessage:
            'All projects attached to this automation do not exist in the target environment, and were removed during the deployment. The automation will not be able to be deployed until these projects are deployed to the target environment, or the automation is configured as global.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.projects).toEqual([])
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.projects = 'invalid'
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.projects
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all projects are valid', async () => {
      instance.value.projects = [
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectType: 'software' },
      ]
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
