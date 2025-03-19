/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  PlaceholderObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  TypeReference,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '../src/element_source'
import {
  getImportantValues,
  getImportantValuesDefinitions,
  ImportantValues,
  toImportantValues,
} from '../src/important_values'

const userType = new ObjectType({
  elemID: new ElemID('salto', 'user'),
  fields: {
    id: {
      refType: BuiltinTypes.NUMBER,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
      {
        value: 'label',
        indexed: true,
        highlighted: true,
      },
    ],
  },
})

const obj = new ObjectType({
  elemID: new ElemID('salto', 'obj'),
  fields: {
    active: {
      refType: BuiltinTypes.BOOLEAN,
    },
    name: {
      refType: BuiltinTypes.STRING,
    },
    user: {
      refType: userType,
      annotations: {
        label: 'Active',
      },
    },
  },
  annotations: {
    name: 'test',
    apiName: 123,
    other: 'bla',
    [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
      {
        value: 'name',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'active',
        indexed: true,
        highlighted: false,
      },
      {
        value: 'doesNotExist',
        indexed: true,
        highlighted: true,
      },
    ],
    [CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES]: [
      {
        value: 'name',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'apiName',
        indexed: true,
        highlighted: false,
      },
      {
        value: 'doesNotExist',
        indexed: true,
        highlighted: true,
      },
    ],
  },
})
const inst = new InstanceElement('test inst', obj, {
  active: true,
  name: 'test inst',
  user: {
    id: 12345,
  },
})

describe('toImportantValues', () => {
  it('should return only existing fields', () => {
    expect(toImportantValues(obj, ['name', 'description'], { indexed: true })).toEqual([
      {
        value: 'name',
        indexed: true,
        highlighted: false,
      },
    ])
  })
  it('should return fields in the given order', () => {
    expect(toImportantValues(obj, ['user', 'name', 'active'], { highlighted: true })).toEqual([
      {
        value: 'user',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'name',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'active',
        indexed: false,
        highlighted: true,
      },
    ])
  })
})

describe('getImportantValues', () => {
  let elementSource: ReadOnlyElementsSource
  beforeEach(() => {
    elementSource = buildElementsSourceFromElements([obj, userType])
  })
  it('should get the right important values for an object type', async () => {
    const res = await getImportantValues({
      element: obj,
      elementSource,
    })
    expect(res).toEqual([
      { key: 'name', value: 'test' },
      { key: 'apiName', value: 123 },
      { key: 'doesNotExist', value: undefined },
    ])
  })
  it('should get the right important values for an instance', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
    })
    expect(res).toEqual([
      { key: 'name', value: 'test inst' },
      { key: 'active', value: true },
      { key: 'doesNotExist', value: undefined },
    ])
  })
  it('should get the right important values for an instance when obj is PlaceholderObjectType', async () => {
    const otherInst = new InstanceElement(
      'test inst',
      new PlaceholderObjectType({
        elemID: obj.elemID,
      }),
      {
        active: true,
        name: 'test inst',
        user: {
          id: 12345,
        },
      },
    )
    const res = await getImportantValues({
      element: otherInst,
      elementSource,
    })
    expect(res).toEqual([
      { key: 'name', value: 'test inst' },
      { key: 'active', value: true },
      { key: 'doesNotExist', value: undefined },
    ])
  })
  it('should get the right important values for a field', async () => {
    const field = new Field(obj, 'test field', userType, {
      label: 'Active',
    })
    const res = await getImportantValues({
      element: field,
      elementSource,
      indexedOnly: false,
    })
    expect(res).toEqual([{ key: 'label', value: 'Active' }])
  })
  it('should return an empty object if no important values are defined', async () => {
    const objNoImportant = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
      fields: {
        active: {
          refType: BuiltinTypes.BOOLEAN,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        user: {
          refType: userType,
          annotations: {
            label: 'Active',
          },
        },
      },
      annotations: {
        name: 'test',
        apiName: 123,
        other: 'bla',
      },
    })
    const instNoImportant = inst.clone()
    instNoImportant.refType = new TypeReference(objNoImportant.elemID, objNoImportant)
    const elementSourceNoImportant = buildElementsSourceFromElements([objNoImportant, userType])
    expect(
      await getImportantValues({
        element: instNoImportant,
      }),
    ).toEqual([])
    instNoImportant.refType = new TypeReference(objNoImportant.elemID)
    expect(
      await getImportantValues({
        element: instNoImportant,
        elementSource: elementSourceNoImportant,
      }),
    ).toEqual([])
  })
  it('should return only indexed values', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
      indexedOnly: true,
    })
    expect(res).toEqual([
      { key: 'active', value: true },
      { key: 'doesNotExist', value: undefined },
    ])
  })
  it('should return only highlighted values', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
      highlightedOnly: true,
    })
    expect(res).toEqual([
      { key: 'name', value: 'test inst' },
      { key: 'doesNotExist', value: undefined },
    ])
  })
  it('should not return inner values if highlighted', async () => {
    const obj2 = new ObjectType({
      elemID: new ElemID('salto', 'obj2'),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
        user: {
          refType: userType,
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'name',
            indexed: false,
            highlighted: true,
          },
          {
            value: 'user.id',
            indexed: true,
            highlighted: true,
          },
        ],
      },
    })
    const inst2 = new InstanceElement('test inst2', obj2, {
      name: 'test inst',
      user: {
        id: 12345,
      },
    })
    elementSource = buildElementsSourceFromElements([obj2])
    const res = await getImportantValues({
      element: inst2,
      elementSource,
      highlightedOnly: true,
    })
    expect(res).toEqual([{ key: 'name', value: 'test inst' }])
  })
  it('should return only primitive values if indexed is true', async () => {
    // check undefined, number, array of primitive, string --> need to return
    // reference, other obj --> should not return
    const obj2 = new ObjectType({
      elemID: new ElemID('salto', 'obj2'),
      fields: {
        string: {
          refType: BuiltinTypes.STRING,
        },
        number: {
          refType: BuiltinTypes.NUMBER,
        },
        boolean: {
          refType: BuiltinTypes.BOOLEAN,
        },
        stringArray: {
          refType: BuiltinTypes.UNKNOWN,
        },
        undefinedVal: {
          refType: BuiltinTypes.UNKNOWN,
        },
        reference: {
          refType: BuiltinTypes.UNKNOWN,
        },
        obj: {
          refType: userType,
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'string',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'number',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'boolean',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'stringArray',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'undefinedVal',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'reference',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'obj.id',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'obj',
            indexed: true,
            highlighted: false,
          },
        ],
      },
    })
    const inst2 = new InstanceElement('test inst2', obj2, {
      string: 'test inst',
      number: 1,
      boolean: true,
      stringArray: ['1', '2'],
      undefinedVal: undefined,
      reference: new ReferenceExpression(inst.elemID),
      obj: {
        id: 12345,
      },
    })
    const res = await getImportantValues({
      element: inst2,
      elementSource,
      indexedOnly: true,
    })
    expect(res).toEqual([
      { key: 'string', value: 'test inst' },
      { key: 'number', value: 1 },
      { key: 'boolean', value: true },
      { key: 'stringArray', value: ['1', '2'] },
      { key: 'undefinedVal', value: undefined },
      { key: 'reference', value: new ReferenceExpression(inst.elemID) },
      { key: 'obj.id', value: 12345 },
    ])
  })
})

describe('getImportantValuesDefinitions', () => {
  let elementSource: ReadOnlyElementsSource
  let objectTypeWithHiddenImportantValue: ObjectType
  let instanceWithHiddenValue: InstanceElement
  let result: { importantValuesDefinitions: ImportantValues; isHiddenImportantValue: boolean }

  beforeEach(async () => {
    objectTypeWithHiddenImportantValue = new ObjectType({
      elemID: new ElemID('salto', 'obj1'),
      fields: {
        active: {
          refType: BuiltinTypes.BOOLEAN,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        user: {
          refType: userType,
          annotations: {
            label: 'Active',
          },
        },
        hiddenField: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
      },
      annotations: {
        name: 'test',
        apiName: 123,
        other: 'bla',
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'name',
            indexed: false,
            highlighted: true,
          },
          {
            value: 'active',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'doesNotExist',
            indexed: true,
            highlighted: true,
          },
          {
            value: 'hiddenField',
            indexed: true,
            highlighted: true,
          },
        ],
      },
    })

    instanceWithHiddenValue = new InstanceElement('test inst', objectTypeWithHiddenImportantValue, {
      active: true,
      name: 'test inst',
      user: {
        id: 12345,
      },
      hiddenField: 'hiddenField',
    })

    elementSource = buildElementsSourceFromElements([objectTypeWithHiddenImportantValue, instanceWithHiddenValue])
  })

  describe('when the element is an object type', () => {
    let objectTypeWithSelfImportantValues: ObjectType
    beforeEach(async () => {
      objectTypeWithSelfImportantValues = new ObjectType({
        elemID: new ElemID('salto', 'obj1'),
        fields: {
          active: {
            refType: BuiltinTypes.BOOLEAN,
          },
          name: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotations: {
          name: 'test',
          apiName: 123,
          other: 'bla',
          [CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES]: [
            {
              value: 'name',
              indexed: false,
              highlighted: true,
            },
            {
              value: 'apiName',
              indexed: true,
              highlighted: false,
            },
            {
              value: 'doesNotExist',
              indexed: true,
              highlighted: true,
            },
            {
              value: 'hiddenField',
              indexed: true,
              highlighted: true,
            },
          ],
        },
      })
      elementSource = buildElementsSourceFromElements([objectTypeWithSelfImportantValues])
      result = await getImportantValuesDefinitions({
        element: objectTypeWithSelfImportantValues,
        elementSource,
      })
    })
    it('should return the self important values definitions from the type', async () => {
      expect(result.importantValuesDefinitions).toEqual(
        objectTypeWithSelfImportantValues.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES],
      )
    })
    it('should return isHiddenImportantValue false', async () => {
      expect(result.isHiddenImportantValue).toEqual(false)
    })
  })
  describe('when there is hidden important value', () => {
    beforeEach(async () => {
      elementSource = buildElementsSourceFromElements([objectTypeWithHiddenImportantValue, instanceWithHiddenValue])
      result = await getImportantValuesDefinitions({
        element: instanceWithHiddenValue,
        elementSource,
      })
    })
    it('should return important values definitions from the type', async () => {
      expect(result.importantValuesDefinitions).toEqual(
        objectTypeWithHiddenImportantValue.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES],
      )
    })
    it('should return isHiddenImportantValue true', async () => {
      expect(result.isHiddenImportantValue).toEqual(true)
    })
  })

  describe('when there is no hidden important value', () => {
    beforeEach(async () => {
      elementSource = buildElementsSourceFromElements([inst, obj])
      result = await getImportantValuesDefinitions({
        element: inst,
        elementSource,
      })
    })
    it('should return important values definitions from the type', async () => {
      expect(result.importantValuesDefinitions).toEqual(obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES])
    })
    it('should return isHiddenImportantValue false', async () => {
      expect(result.isHiddenImportantValue).toEqual(false)
    })
  })

  describe('when there are no important values definitions', () => {
    let instanceWithoutImportantValues: InstanceElement
    let objectTypeWithoutImportantValues: ObjectType
    beforeEach(async () => {
      objectTypeWithoutImportantValues = new ObjectType({
        elemID: new ElemID('salto', 'obj2'),
        fields: {
          active: {
            refType: BuiltinTypes.BOOLEAN,
          },
        },
      })
      instanceWithoutImportantValues = new InstanceElement('test inst', objectTypeWithoutImportantValues, {
        active: true,
      })
      elementSource = buildElementsSourceFromElements([
        objectTypeWithoutImportantValues,
        instanceWithoutImportantValues,
      ])
      result = await getImportantValuesDefinitions({
        element: instanceWithoutImportantValues,
        elementSource,
      })
    })

    it('should return empty important values definitions', async () => {
      expect(result.importantValuesDefinitions).toEqual([])
    })
    it('should return isHiddenImportantValue false', async () => {
      expect(result.isHiddenImportantValue).toEqual(false)
    })
  })

  describe('when there are not visible important values', () => {
    let instanceWithoutVisibleImportantValues: InstanceElement
    let objectTypeWithoutVisibleImportantValues: ObjectType
    beforeEach(async () => {
      objectTypeWithoutVisibleImportantValues = new ObjectType({
        elemID: new ElemID('salto', 'obj3'),
        fields: {
          hiddenField: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
            },
          },
        },
        annotations: {
          [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
            {
              value: 'hiddenField',
              indexed: true,
              highlighted: true,
            },
          ],
        },
      })
      instanceWithoutVisibleImportantValues = new InstanceElement(
        'test inst',
        objectTypeWithoutVisibleImportantValues,
        {
          hiddenField: 'hiddenField',
        },
      )
      elementSource = buildElementsSourceFromElements([
        objectTypeWithoutVisibleImportantValues,
        instanceWithoutVisibleImportantValues,
      ])
      result = await getImportantValuesDefinitions({
        element: instanceWithoutVisibleImportantValues,
        elementSource,
      })
    })

    it('should return important values definitions from the type', async () => {
      expect(result.importantValuesDefinitions).toEqual(
        objectTypeWithoutVisibleImportantValues.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES],
      )
    })
    it('should return isHiddenImportantValue true', async () => {
      expect(result.isHiddenImportantValue).toEqual(true)
    })
  })

  describe('when the object type is not resolved', () => {
    let instanceWithoutObjectType: InstanceElement
    beforeEach(async () => {
      instanceWithoutObjectType = new InstanceElement(
        'test inst',
        new TypeReference(objectTypeWithHiddenImportantValue.elemID),
        {
          active: true,
          name: 'test inst',
          user: {
            id: 12345,
          },
        },
      )
    })
    describe('when there is an elementSource', () => {
      beforeEach(async () => {
        elementSource = buildElementsSourceFromElements([objectTypeWithHiddenImportantValue, instanceWithoutObjectType])
        result = await getImportantValuesDefinitions({
          element: instanceWithoutObjectType,
          elementSource,
        })
      })
      it('should return important values definitions from the type', async () => {
        expect(result.importantValuesDefinitions).toEqual(
          objectTypeWithHiddenImportantValue.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES],
        )
      })
      it('should return isHiddenImportantValue true', async () => {
        expect(result.isHiddenImportantValue).toEqual(true)
      })
    })
    describe('when there is no elementSource', () => {
      beforeEach(async () => {
        result = await getImportantValuesDefinitions({
          element: instanceWithoutObjectType,
        })
      })
      it('should return empty important values definitions when there is no elementSource', async () => {
        const { importantValuesDefinitions } = await getImportantValuesDefinitions({
          element: instanceWithoutObjectType,
        })
        expect(importantValuesDefinitions).toEqual([])
      })
      it('should return isHiddenImportantValue true when false is no elementSource', async () => {
        const { isHiddenImportantValue } = await getImportantValuesDefinitions({
          element: instanceWithoutObjectType,
        })
        expect(isHiddenImportantValue).toEqual(false)
      })
    })
  })

  describe('when the element is a field', () => {
    let field: Field
    beforeEach(async () => {
      field = new Field(obj, 'test field', userType, {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [{ value: 'label', indexed: true, highlighted: true }],
      })
      result = await getImportantValuesDefinitions({
        element: field,
      })
    })
    it('should return important values definitions from the field', async () => {
      expect(result.importantValuesDefinitions).toEqual(field.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES])
    })

    it('should return isHiddenImportantValue false', async () => {
      expect(result.isHiddenImportantValue).toEqual(false)
    })
  })

  describe('when the element is an object type without annotations', () => {
    let objectTypeWithoutAnnotations: ObjectType
    beforeEach(async () => {
      objectTypeWithoutAnnotations = new ObjectType({
        elemID: new ElemID('salto', 'obj4'),
        fields: {
          active: {
            refType: BuiltinTypes.BOOLEAN,
          },
        },
      })
      elementSource = buildElementsSourceFromElements([objectTypeWithoutAnnotations])
      result = await getImportantValuesDefinitions({
        element: objectTypeWithoutAnnotations,
        elementSource,
      })
    })

    it('should return empty important values definition', async () => {
      expect(result.importantValuesDefinitions).toEqual([])
    })
    it('should return isHiddenImportantValue false', async () => {
      expect(result.isHiddenImportantValue).toEqual(false)
    })
  })

  describe('when there is no elementSource', () => {
    describe('when the instance reference is resolved', () => {
      beforeEach(async () => {
        result = await getImportantValuesDefinitions({
          element: instanceWithHiddenValue,
        })
      })
      it('should return important values definitions from the type', async () => {
        expect(result.importantValuesDefinitions).toEqual(
          objectTypeWithHiddenImportantValue.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES],
        )
      })
      it('should return isHiddenImportantValue true', async () => {
        expect(result.isHiddenImportantValue).toEqual(true)
      })
    })
    describe('when the instance reference is not resolved', () => {
      let instanceWithoutObjectType: InstanceElement
      beforeEach(async () => {
        instanceWithoutObjectType = new InstanceElement(
          'test inst',
          new TypeReference(objectTypeWithHiddenImportantValue.elemID),
          {
            active: true,
            name: 'test inst',
          },
        )
        result = await getImportantValuesDefinitions({
          element: instanceWithoutObjectType,
        })
      })
      it('should return empty important values definition', async () => {
        expect(result.importantValuesDefinitions).toEqual([])
      })
      it('should return isHiddenImportantValue false', async () => {
        expect(result.isHiddenImportantValue).toEqual(false)
      })
    })
  })
})
