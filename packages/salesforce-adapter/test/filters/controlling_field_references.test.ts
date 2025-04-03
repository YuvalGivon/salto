/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, Field, ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, API_NAME } from '../../src/constants'
import filter from '../../src/filters/controlling_field_reference'
import { Types } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import { defaultFilterContext } from '../utils'

const parentObj = new ObjectType({ elemID: new ElemID('salesforce', 'TestObj') })

describe('controllingFieldReference filter', () => {
  describe('onFetch', () => {
    let obj: ObjectType
    let filterFunc: FilterWith<'onFetch'>
    const createObjectWithFieldDependency = ({
      createFieldDependency = true,
      validControllingField = true,
    }: {
      createFieldDependency?: boolean
      validControllingField?: boolean
    } = {}): ObjectType =>
      new ObjectType({
        elemID: new ElemID('salesforce', 'TestObj'),
        fields: {
          controllingField: new Field(parentObj, 'controllingField', Types.primitiveDataTypes.Picklist, {
            [API_NAME]: 'TestObj.controllingField',
          }),
          dependentField: new Field(parentObj, 'dependentField', Types.primitiveDataTypes.Picklist, {
            [API_NAME]: 'TestObj.dependentField',
            ...(createFieldDependency && {
              [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
                [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: validControllingField
                  ? 'controllingField'
                  : 'controllingFieldFake',
                [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
                  {
                    valueName: 'valueName',
                    controllingFieldValue: ['controllingFieldValue'],
                  },
                ],
              },
            }),
          }),
        },
      })
    beforeEach(() => {
      filterFunc = filter({ config: defaultFilterContext }) as FilterWith<'onFetch'>
    })
    describe('should create reference for controllingField when controllingField is a name of field in the objectType', () => {
      it('should create reference for controllingField', async () => {
        obj = createObjectWithFieldDependency()
        await filterFunc.onFetch([obj])

        const fieldDependency = obj.fields.dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBeInstanceOf(ReferenceExpression)
        expect((controllingFieldValue as ReferenceExpression).elemID).toEqual(obj.fields.controllingField.elemID)
      })
    })
    describe('should not create reference for controllingField when controllingField is not a name of field in the objectType', () => {
      it('should not create reference', async () => {
        obj = createObjectWithFieldDependency({ validControllingField: false })
        await filterFunc.onFetch([obj])

        const fieldDependency = obj.fields.dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toEqual('controllingFieldFake')
      })
    })
    describe('should not create reference when field dependency does not exist', () => {
      it('should not create reference when field dependency does not exist', async () => {
        obj = createObjectWithFieldDependency({ createFieldDependency: false })
        await filterFunc.onFetch([obj])

        const fieldDependency = obj.fields.dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeUndefined()
      })
    })
    describe('when fields annotations are empty', () => {
      it('should not do anything', async () => {
        obj = new ObjectType({
          elemID: new ElemID('salesforce', 'TestObj'),
          fields: {
            field: new Field(parentObj, 'field', Types.primitiveDataTypes.Picklist, {}),
          },
        })
        const clonedObj = obj.clone()
        await filterFunc.onFetch([obj])
        expect(obj).toEqual(clonedObj)
      })
    })
  })

  describe('preDeploy', () => {
    let filterFunc: FilterWith<'preDeploy'>
    const createFieldWithDependency = ({
      createDependency = true,
      validControllingField = true,
    }: {
      createDependency?: boolean
      validControllingField?: boolean
    } = {}): Field =>
      new Field(parentObj, 'dependentField', Types.primitiveDataTypes.Picklist, {
        [API_NAME]: 'TestObj.dependentField',
        ...(createDependency && {
          [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: validControllingField ? 'TestObj.controllingField' : 5,
            [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
              {
                valueName: 'valueName',
                controllingFieldValue: ['controllingFieldValue'],
              },
            ],
          },
        }),
      })
    beforeEach(() => {
      filterFunc = filter({ config: defaultFilterContext }) as FilterWith<'preDeploy'>
    })
    describe('when controllingField is a valid', () => {
      it('should convert reference back to string in preDeploy', async () => {
        const dependentField = createFieldWithDependency()
        await filterFunc.preDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe('controllingField')
      })
    })
    describe('when there is no dependency', () => {
      it('do nothing', async () => {
        const dependentField = createFieldWithDependency({ createDependency: false })
        await filterFunc.preDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).not.toBeDefined()
        expect(dependentField).toEqual(createFieldWithDependency({ createDependency: false }))
      })
    })
    describe('when controllingField is a invalid', () => {
      it('should do nothing', async () => {
        const dependentField = createFieldWithDependency({ validControllingField: false })
        await filterFunc.preDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe(5)
      })
    })
  })
  describe('onDeploy', () => {
    let filterFunc: FilterWith<'onDeploy'>
    const createFieldWithDependency = ({
      createDependency = true,
      validControllingField = true,
      createApiName = true,
    }: {
      createDependency?: boolean
      validControllingField?: boolean
      createApiName?: boolean
    } = {}): Field =>
      new Field(parentObj, 'dependentField', Types.primitiveDataTypes.Picklist, {
        ...(createApiName && { [API_NAME]: 'TestObj.dependentField' }),
        ...(createDependency && {
          [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: validControllingField ? 'controllingField' : 5,
            [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
              {
                valueName: 'valueName',
                controllingFieldValue: ['controllingFieldValue'],
              },
            ],
          },
        }),
      })
    beforeEach(() => {
      filterFunc = filter({ config: defaultFilterContext }) as FilterWith<'onDeploy'>
    })
    describe('when controllingField is valid', () => {
      it('should convert reference back to string in preDeploy', async () => {
        const dependentField = createFieldWithDependency()
        await filterFunc.onDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe('TestObj.controllingField')
      })
    })
    describe('when there is no dependency', () => {
      it('do nothing', async () => {
        const dependentField = createFieldWithDependency({ createDependency: false })
        await filterFunc.onDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).not.toBeDefined()
        expect(dependentField).toEqual(createFieldWithDependency({ createDependency: false }))
      })
    })
    describe('when controllingField is a invalid', () => {
      it('should do nothing', async () => {
        const dependentField = createFieldWithDependency({ validControllingField: false })
        await filterFunc.onDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe(5)
      })
    })
    describe('when there is no apiName', () => {
      it('should do nothing', async () => {
        const dependentField = createFieldWithDependency({ createApiName: false })
        await filterFunc.onDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe('controllingField')
      })
    })

    describe('when apiName is not a string', () => {
      it('should handle non-string apiName', async () => {
        const dependentField = new Field(parentObj, 'dependentField', Types.primitiveDataTypes.Picklist, {
          [API_NAME]: 123,
          [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
            [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'controllingField',
          },
        })
        await filterFunc.onDeploy([{ action: 'add', data: { after: dependentField } }])
        const fieldDependency = dependentField.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        expect(fieldDependency).toBeDefined()
        const controllingFieldValue = fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        expect(controllingFieldValue).toBe('controllingField')
      })
    })
  })
})
