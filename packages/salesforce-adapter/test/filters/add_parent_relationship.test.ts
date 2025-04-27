/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockTypes } from '../mock_elements'
import { defaultFilterContext } from '../utils'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/add_parent_relationship'
import { buildContext } from '../../src/config/context/context'

describe('addParentRelationship', () => {
  let filter: FilterWith<'onFetch'>
  describe('onFetch', () => {
    describe('record triggered flows', () => {
      let updateOpportunityFlow: Element
      let updateLeadFlow: Element
      describe('when all parents exist in the workspace', () => {
        beforeEach(async () => {
          const elements = [
            (updateOpportunityFlow = createInstanceElement(
              { fullName: 'UpdateOpportunity', start: { object: 'Opportunity' } },
              mockTypes.Flow,
            )),
            (updateLeadFlow = createInstanceElement(
              { fullName: 'UpdateLead', start: { object: 'Lead' } },
              mockTypes.Flow,
            )),
            mockTypes.Lead,
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
              elementsSource: buildElementsSourceFromElements([mockTypes.Opportunity]),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation when the parent was not fetched in the current partial fetch', async () => {
          expect(updateOpportunityFlow.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Opportunity.elemID, mockTypes.Opportunity),
          )
        })
        it('should add parent annotation when the parent was fetched in the current partial fetch', async () => {
          expect(updateLeadFlow.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Lead.elemID, mockTypes.Lead),
          )
        })
      })
      describe('when parent does not exist', () => {
        beforeEach(async () => {
          const elements = [
            (updateOpportunityFlow = createInstanceElement(
              { fullName: 'UpdateOpportunity', start: { object: 'Opportunity' } },
              mockTypes.Flow,
            )),
            (updateLeadFlow = createInstanceElement(
              { fullName: 'UpdateLead', start: { object: 'Lead' } },
              mockTypes.Flow,
            )),
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should not create parent annotation', () => {
          expect(updateOpportunityFlow.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(updateLeadFlow.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        })
      })
    })
    describe('approval process', () => {
      let accountApprovalProcess: Element
      let leadApprovalProcess: Element
      describe('when all parents exist in the workspace', () => {
        beforeEach(async () => {
          const elements = [
            (accountApprovalProcess = createInstanceElement(
              { fullName: 'Account.AccountApporvalProcess' },
              mockTypes.ApprovalProcess,
            )),
            (leadApprovalProcess = createInstanceElement(
              { fullName: 'Lead.leadApprovalProcess' },
              mockTypes.ApprovalProcess,
            )),
            mockTypes.Lead,
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
              elementsSource: buildElementsSourceFromElements([mockTypes.Account]),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation when the parent was not fetched in the current partial fetch', async () => {
          expect(accountApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Account.elemID, mockTypes.Account),
          )
        })
        it('should add parent annotation when the parent was fetched in the current partial fetch', async () => {
          expect(leadApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Lead.elemID, mockTypes.Lead),
          )
        })
      })
      describe('when parent does not exist', () => {
        beforeEach(async () => {
          const elements = [
            (accountApprovalProcess = createInstanceElement(
              { fullName: 'Account.AccountApporvalProcess' },
              mockTypes.ApprovalProcess,
            )),
            (leadApprovalProcess = createInstanceElement(
              { fullName: 'Lead.leadApprovalProcess' },
              mockTypes.ApprovalProcess,
            )),
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should not create parent annotation', () => {
          expect(accountApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(leadApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        })
      })
    })
    describe('instances within folder', () => {
      let elements: Element[]
      let emailTemplateInstance: Element
      let emailFolderInstance: Element
      let reportInstance: Element
      let reportFolderInstance: Element
      let documentInstance: Element
      let documentFolderInstance: Element
      let dashboardInstance: Element
      let dashboardFolderInstance: Element
      beforeEach(() => {
        emailFolderInstance = createInstanceElement({ fullName: 'MarketingFolder' }, mockTypes.EmailFolder)
        elements = [
          (emailTemplateInstance = createInstanceElement(
            { fullName: 'MarketingFolder/WelcomeEmail' },
            mockTypes.EmailTemplate,
          )),
          (reportInstance = createInstanceElement({ fullName: 'SalesFolder/QuarterlySales' }, mockTypes.Report)),
          (reportFolderInstance = createInstanceElement({ fullName: 'SalesFolder' }, mockTypes.ReportFolder)),
          (documentInstance = createInstanceElement({ fullName: 'SharedDocs/Policy' }, mockTypes.Document)),
          (documentFolderInstance = createInstanceElement({ fullName: 'SharedDocs' }, mockTypes.DocumentFolder)),
          (dashboardInstance = createInstanceElement(
            { fullName: 'Dashboards/PerformanceDashboard' },
            mockTypes.Dashboard,
          )),
          (dashboardFolderInstance = createInstanceElement({ fullName: 'Dashboards' }, mockTypes.DashboardFolder)),
          ...Object.values(mockTypes),
        ]
      })
      describe('when the instances are within folder', () => {
        beforeEach(async () => {
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
              elementsSource: buildElementsSourceFromElements([emailFolderInstance]),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation to email template', async () => {
          expect(emailTemplateInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(emailFolderInstance.elemID, emailFolderInstance),
          )
        })
        it('should add parent annotation to report', () => {
          expect(reportInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(reportFolderInstance.elemID, reportFolderInstance),
          )
        })
        it('should add parent annotation to document', () => {
          expect(documentInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(documentFolderInstance.elemID, documentFolderInstance),
          )
        })
        it('should add parent annotation to dashboard', () => {
          expect(dashboardInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(dashboardFolderInstance.elemID, dashboardFolderInstance),
          )
        })
      })
    })
    describe('gen ai prompt template', () => {
      let updateAccountPromptTemplate: Element
      let updateOpportunityPromptTemplate: Element
      describe('when all parents exist in the workspace', () => {
        beforeEach(async () => {
          const elements = [
            (updateAccountPromptTemplate = createInstanceElement(
              { fullName: 'UpdateAccount', relatedEntity: 'Account' },
              mockTypes.GenAiPromptTemplate,
            )),
            (updateOpportunityPromptTemplate = createInstanceElement(
              { fullName: 'UpdateOpportunity', relatedEntity: 'Opportunity' },
              mockTypes.GenAiPromptTemplate,
            )),
            mockTypes.Account,
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
              elementsSource: buildElementsSourceFromElements([mockTypes.Opportunity]),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation when the parent was not fetched in the current partial fetch', async () => {
          expect(updateOpportunityPromptTemplate.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Opportunity.elemID, mockTypes.Opportunity),
          )
        })
        it('should add parent annotation when the parent was fetched in the current partial fetch', async () => {
          expect(updateAccountPromptTemplate.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(mockTypes.Account.elemID, mockTypes.Account),
          )
        })
      })
      describe('when parent does not exist', () => {
        beforeEach(async () => {
          const elements = [
            (updateOpportunityPromptTemplate = createInstanceElement(
              { fullName: 'UpdateOpportunity', relatedEntity: 'Opportunity' },
              mockTypes.GenAiPromptTemplate,
            )),
            (updateAccountPromptTemplate = createInstanceElement(
              { fullName: 'UpdateAccount', relatedEntity: 'Account' },
              mockTypes.GenAiPromptTemplate,
            )),
          ]
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              context: buildContext({
                fetchParams: { target: [] },
              }),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should not create parent annotation', () => {
          expect(updateOpportunityPromptTemplate.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(updateAccountPromptTemplate.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        })
      })
    })
  })
})
