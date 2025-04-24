/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { v4 as uuid } from 'uuid'
import { FieldDefinition, InstanceElement, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { e2eUtils } from '@salto-io/adapter-components'
import { e2eUtils as microsoftSecurityE2EUtils } from '@salto-io/microsoft-security-adapter'
import { mockDefaultValues, modificationChangesBeforeAndAfterOverrides } from './mock_elements'

const {
  entraConstants: { TOP_LEVEL_TYPES: entraTopLevelTypes, ...entraConstants },
  ODATA_TYPE_FIELD_NACL_CASE,
  createFetchDefinitions,
} = microsoftSecurityE2EUtils

export const UNIQUE_NAME = 'E2ETest'

const fetchDefinitions = createFetchDefinitions({
  Entra: true,
  Intune: true,
  Defender: true,
})

const testSuffix = uuid().slice(0, 8)

const createName = (type: string, maxChars?: number): string =>
  `${UNIQUE_NAME}${type.slice(0, maxChars ? maxChars - (UNIQUE_NAME.length + testSuffix.length + 1) : undefined)}_${testSuffix}`

const createGroupMailProperties = (
  mailNickname: string,
): { mailNickname: string; mail: string; proxyAddresses: string[] } => {
  const uniqueMailNickname = createName(mailNickname)
  const mail = `${uniqueMailNickname}@e2eAdapter.onmicrosoft.com`
  return {
    mailNickname: uniqueMailNickname,
    mail,
    proxyAddresses: [`SMTP:${mail}`],
  }
}

const createInstanceElementFunc =
  (types: ObjectType[]) =>
  ({
    typeName,
    valuesOverride,
    parent,
    singleton,
  }: {
    typeName: string
    valuesOverride?: Values
    fields?: Record<string, FieldDefinition>
    parent?: InstanceElement
    singleton?: boolean
  }): InstanceElement => {
    const instValues = _.merge(
      {},
      mockDefaultValues[typeName],
      modificationChangesBeforeAndAfterOverrides[typeName]?.after,
      valuesOverride,
    )

    return e2eUtils.createInstance({
      fetchDefinitions,
      typeName,
      types,
      values: instValues,
      parent,
      singleton,
    })
  }

// ******************* create all elements for deploy *******************
const getApplicationFromTemplateInstancesToAdd = (
  createInstanceElement: ReturnType<typeof createInstanceElementFunc>,
): InstanceElement[] => {
  // The following should already exist in the service, we only create it to be used as reference
  const entraApplicationTemplate = createInstanceElement({
    typeName: entraTopLevelTypes.APPLICATION_TEMPLATE_TYPE_NAME,
    valuesOverride: {
      displayName: 'Workday',
      publisher: 'Workday',
    },
  })
  const entraApplicationFromTemplate = createInstanceElement({
    typeName: entraTopLevelTypes.APPLICATION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(`${entraTopLevelTypes.APPLICATION_TYPE_NAME}FromTemplate`),
      applicationTemplateId: new ReferenceExpression(entraApplicationTemplate.elemID, entraApplicationTemplate),
      isFallbackPublicClient: true, // This value is not the default that is created by the template application
      publisherDomain: 'e2eAdapter.onmicrosoft.com',
      signInAudience: 'AzureADMyOrg',
      parentalControlSettings: {
        legalAgeGroupRule: 'Allow',
      },
      web: {
        homePageUrl: 'https://impl.workday.com/*?metadata=workday|ISV9.2|primary|z',
        redirectUris: [
          'https://*.myworkday.com/*',
          'https://*.workday.com',
          'https://*.workday.com/*',
          'https://impl.workday.com/*',
          'https://myworkday.com/*',
          'https://www.myworkday.com/*',
        ],
        implicitGrantSettings: {
          enableAccessTokenIssuance: false,
          enableIdTokenIssuance: true,
        },
        redirectUriSettings: [
          {
            uri: 'https://*.myworkday.com/*',
          },
          {
            uri: 'https://*.workday.com',
          },
          {
            uri: 'https://*.workday.com/*',
          },
          {
            uri: 'https://impl.workday.com/*',
          },
          {
            uri: 'https://myworkday.com/*',
          },
          {
            uri: 'https://www.myworkday.com/*',
          },
        ],
      },
    },
  })
  const defaultAppRole = createInstanceElement({
    typeName: entraTopLevelTypes.APP_ROLE_TYPE_NAME,
    valuesOverride: {
      allowedMemberTypes: ['User'],
      description: 'msiam_access',
      displayName: 'msiam_access',
      isEnabled: true,
      origin: 'Application',
    },
    parent: entraApplicationFromTemplate,
  })
  const additionalAppRole = createInstanceElement({
    typeName: entraTopLevelTypes.APP_ROLE_TYPE_NAME,
    valuesOverride: {
      allowedMemberTypes: ['User'],
      description: 'custom_app_role',
      displayName: 'custom_app_role',
      isEnabled: true,
      origin: 'Application',
    },
    parent: entraApplicationFromTemplate,
  })
  const defaultOauth2PermissionScope = createInstanceElement({
    typeName: entraTopLevelTypes.OAUTH2_PERMISSION_SCOPE_TYPE_NAME,
    valuesOverride: {
      adminConsentDescription: 'Allow the application to access Workday on behalf of the signed-in user.',
      adminConsentDisplayName: 'Access Workday',
      isEnabled: true,
      type: 'User',
      userConsentDescription: 'Allow the application to access Workday on your behalf.',
      userConsentDisplayName: 'Access Workday',
      value: 'user_impersonation',
    },
    parent: entraApplicationFromTemplate,
  })
  const additionalOauth2PermissionScope = createInstanceElement({
    typeName: entraTopLevelTypes.OAUTH2_PERMISSION_SCOPE_TYPE_NAME,
    valuesOverride: {
      value: 'custom_oauth2_permission_scope',
      adminConsentDescription: 'Allow the application to access Workday on behalf of the signed-in user.',
      adminConsentDisplayName: 'Access Workday',
      isEnabled: true,
      type: 'User',
      userConsentDescription: 'Allow the application to access Workday on your behalf.',
      userConsentDisplayName: 'Access Workday',
    },
    parent: entraApplicationFromTemplate,
  })
  const servicePrincipalOfTemplateApplication = createInstanceElement({
    typeName: entraTopLevelTypes.SERVICE_PRINCIPAL_TYPE_NAME,
    valuesOverride: {
      appId: new ReferenceExpression(entraApplicationFromTemplate.elemID, entraApplicationFromTemplate),
      // The displayName should be the same as the referenced application displayName
      displayName: entraApplicationFromTemplate.value.displayName,
      accountEnabled: true,
      appRoleAssignmentRequired: false,
      notes: 'some custom notes',
      servicePrincipalType: 'Application',
      tags: ['WindowsAzureActiveDirectoryIntegratedApp'],
    },
  })

  return [
    entraApplicationFromTemplate,
    defaultAppRole,
    additionalAppRole,
    defaultOauth2PermissionScope,
    additionalOauth2PermissionScope,
    servicePrincipalOfTemplateApplication,
  ]
}

export const getAllInstancesToDeploy = async ({
  types,
}: {
  types: ObjectType[]
}): Promise<{
  instancesToAdd: InstanceElement[]
  instancesToModify: InstanceElement[]
}> => {
  const createInstanceElement = createInstanceElementFunc(types)
  const lifeCyclePolicy = createInstanceElement({
    typeName: entraTopLevelTypes.LIFE_CYCLE_POLICY_TYPE_NAME,
    singleton: true,
  })
  const group = createInstanceElement({
    typeName: entraTopLevelTypes.GROUP_TYPE_NAME,
    valuesOverride: {
      displayName: createName(`${entraTopLevelTypes.GROUP_TYPE_NAME}A`),
      ...createGroupMailProperties('mailNicknameA'),
    },
  })
  // TODO SALTO-7443: Uncomment this when we fix the flakiness in assigning a group to a life cycle policy
  // const groupWithLifeCyclePolicy = createInstanceElement({
  //   typeName: entraTopLevelTypes.GROUP_TYPE_NAME,
  //   valuesOverride: {
  //     displayName: createName(`${entraTopLevelTypes.GROUP_TYPE_NAME}B`),
  //     ...createGroupMailProperties('mailNicknameB'),
  //     [entraConstants.GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]: new ReferenceExpression(
  //       lifeCyclePolicy.elemID,
  //       lifeCyclePolicy,
  //     ),
  //   },
  // })
  const administrativeUnit = createInstanceElement({
    typeName: entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME),
      members: [
        { id: new ReferenceExpression(group.elemID, group), [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.group' },
      ],
    },
  })
  const entraApplication = createInstanceElement({
    typeName: entraTopLevelTypes.APPLICATION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.APPLICATION_TYPE_NAME),
    },
  })
  const entraServicePrincipal = createInstanceElement({
    typeName: entraTopLevelTypes.SERVICE_PRINCIPAL_TYPE_NAME,
    valuesOverride: {
      appId: new ReferenceExpression(entraApplication.elemID, entraApplication),
      // The displayName should be the same as the referenced application displayName
      displayName: entraApplication.value.displayName,
    },
  })
  const authenticationMethodConfiguration = createInstanceElement({
    typeName: entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 57),
      appId: new ReferenceExpression(entraApplication.elemID, entraApplication),
    },
  })
  const authenticationMethodPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
    singleton: true,
  })
  const authenticationStrengthPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, 30),
    },
  })
  const conditionalAccessPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
    },
  })
  const customSecurityAttributeSet = createInstanceElement({
    typeName: entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
    valuesOverride: {
      id: `attributeSet${UNIQUE_NAME}`,
    },
  })
  const customSecurityAttributeDefinition = createInstanceElement({
    typeName: entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
    valuesOverride: {
      name: `attributeDefinition${UNIQUE_NAME}`,
      attributeSet: new ReferenceExpression(customSecurityAttributeSet.elemID, customSecurityAttributeSet),
    },
  })
  const customSecurityAttributeAllowedValueA = createInstanceElement({
    typeName: entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
    valuesOverride: {
      id: `${UNIQUE_NAME}AllowedValueA`,
    },
    parent: customSecurityAttributeDefinition,
  })
  const customSecurityAttributeAllowedValueB = createInstanceElement({
    typeName: entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
    valuesOverride: {
      id: `${UNIQUE_NAME}AllowedValueB`,
    },
    parent: customSecurityAttributeDefinition,
  })
  const roleDefinition = createInstanceElement({
    typeName: entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME),
    },
  })
  const authorizationPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.AUTHORIZATION_POLICY_TYPE_NAME,
    singleton: true,
  })

  const applicationFromTemplateInstances = getApplicationFromTemplateInstancesToAdd(createInstanceElement)
  const instancesToAdd = applicationFromTemplateInstances.concat([
    group,
    // TODO SALTO-7443: Uncomment this when we fix the flakiness in assigning a group to a life cycle policy
    // groupWithLifeCyclePolicy,
    administrativeUnit,
    entraApplication,
    entraServicePrincipal,
    authenticationMethodConfiguration,
    authenticationStrengthPolicy,
    conditionalAccessPolicy,
    roleDefinition,
  ])

  // Some instances cannot be deleted, so we only modify them.
  // The instances to modify should include the fields that define the elemID and some extra fields that should be modified
  // They do not need to include all the fields, since we merge them with the existing instance in the service
  const instancesToModify = [
    lifeCyclePolicy,
    authenticationMethodPolicy,
    authorizationPolicy,
    customSecurityAttributeSet,
    customSecurityAttributeDefinition,
    customSecurityAttributeAllowedValueA,
    customSecurityAttributeAllowedValueB,
  ]

  return { instancesToAdd, instancesToModify }
}
