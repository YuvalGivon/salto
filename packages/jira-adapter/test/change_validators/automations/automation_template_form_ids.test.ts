/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { automationTemplateFormIdsValidator } from '../../../src/change_validators/automation/automation_template_form_ids'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'

describe('automationTemplateFormIdsValidator', () => {
  let automationType: ObjectType
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    elementsSource = buildElementsSourceFromElements([])

    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement('instance', automationType, {
      name: 'someName',
      components: [
        {
          component: 'ACTION',
          schemaVersion: 1,
          type: 'jira.proforma.form.add.action',
          value: {
            templateFormsConfig: {
              projectId: 'jira.Project.instance.AlonITSM3',
              templateFormIds: [5, 4],
            },
            formVisibility: 'internal',
            allowDuplicates: false,
          },
          children: [],
          conditions: [],
        },
        {
          component: 'CONDITION',
          schemaVersion: 3,
          type: 'jira.issue.condition',
          value: {
            selectedField: {
              type: 'NAME',
              value: 'jira.Field.instance.Request_Type__vp_origin__c@suubuu.name',
            },
            selectedFieldType: 'com.atlassian.servicedesk:vp-origin',
            comparison: 'EQUALS',
            compareFieldValue: {
              type: 'NAME',
              value: 'Waiting for support',
              multiValue: false,
            },
          },
          children: [],
          conditions: [],
        },
        {
          component: 'ACTION',
          schemaVersion: 1,
          type: 'jira.proforma.form.add.action',
          value: {
            templateFormsConfig: {
              projectId: 'jira.Project.instance.AlonITSM3',
              templateFormIds: [1, 4],
            },
            formVisibility: 'internal',
            allowDuplicates: false,
          },
          children: [],
          conditions: [],
        },
      ],
    })
  })

  it('should raise a warning on addition of an automation that is referencing forms by ids', async () => {
    expect(await automationTemplateFormIdsValidator([toChange({ after: instance })], elementsSource)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Deploying automation with template form internal IDs.',
        detailedMessage:
          "This automation might reference forms by internal IDs that don't exist in the target Jira environment. Review and edit them if required. Learn More: https://help.salto.io/en/articles/11087953-automation-reference-forms-by-internal-ids-that-do-not-match-the-target-environment",
      },
    ])
  })

  it('should not raise a warning on addition of an automation that is not referencing forms by ids', async () => {
    instance.value.components = [instance.value.components[1]]
    expect(await automationTemplateFormIdsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })

  it('should raise a warning on modification an automation that is referencing forms by ids and there is a change in that area (a new form was added to the set of referenced forms)', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components[0].value.templateFormsConfig.templateFormIds = [3]
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Deploying automation with template form internal IDs.',
        detailedMessage:
          "This automation might reference forms by internal IDs that don't exist in the target Jira environment. Review and edit them if required. Learn More: https://help.salto.io/en/articles/11087953-automation-reference-forms-by-internal-ids-that-do-not-match-the-target-environment",
      },
    ])
  })

  it('should raise a warning on modification an automation that is referencing forms by ids and there is a change in that area (a form was removed)', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components[0].value.templateFormsConfig.templateFormIds = [3]
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Deploying automation with template form internal IDs.',
        detailedMessage:
          "This automation might reference forms by internal IDs that don't exist in the target Jira environment. Review and edit them if required. Learn More: https://help.salto.io/en/articles/11087953-automation-reference-forms-by-internal-ids-that-do-not-match-the-target-environment",
      },
    ])
  })

  it('should not raise a warning on modification an automation that is referencing forms by ids but no form was removed from  the set of referenced forms', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components[0].value.templateFormsConfig.templateFormIds = [5]
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([])
  })

  it('should not raise a warning on modification an automation that is referencing forms by ids and all forms where removed', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components[0].value.templateFormsConfig.templateFormIds = []
    instanceAfter.value.components[2].value.templateFormsConfig.templateFormIds = []
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([])
  })

  it('should not raise a warning on modification an automation that is referencing forms by ids and all the form components were removed', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components = [instance.value.components[1]]
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([])
  })

  it('should not raise a warning on modification an automation that is referencing forms by ids and there is no change in that area', async () => {
    const instanceAfter = instance.clone()
    instanceAfter.value.components[0].component = 'CONDITION'
    expect(
      await automationTemplateFormIdsValidator([toChange({ before: instance, after: instanceAfter })], elementsSource),
    ).toEqual([])
  })

  it('should not raise a warning on deletion of an automation', async () => {
    expect(await automationTemplateFormIdsValidator([toChange({ before: instance })], elementsSource)).toEqual([])
  })
})
