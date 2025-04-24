/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { setupEnvVar } from '@salto-io/test-utils'
import { Change, ElemID, Element, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { Workspace } from '../../src/workspace/workspace'
import { mockDirStore } from '../common/nacl_file_store'
import { createWorkspace, createState } from '../common/workspace'
import { getDependents } from '../../src/workspace/dependents'
import { naclFilesSource, NaclFilesSource } from '../../src/workspace/nacl_files'
import { mockStaticFilesSource } from '../utils'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { inMemRemoteMapCreator } from '../../src/workspace/remote_map'
import { WORKSPACE_FLAGS } from '../../src/flags'

describe('dependents', () => {
  let workspace: Workspace
  let naclFiles: NaclFilesSource

  const primFile = `
  type salto.prim is string {
  }
`

  const baseFile = `
  type salto.base {
    salto.prim str {
    }
  }
`

  const baseInstFile = `
  salto.base aBaseInst {
    str = "test"
  }
`

  const refBaseInstFile = `
  salto.base bBaseInst {
    str = salto.base.instance.aBaseInst.str
  }
`

  const anotherRefBaseInstFile = `
  salto.base cBaseInst {
    str = salto.base.instance.bBaseInst.str
  }
`

  const topLevelRefBaseInstFile = `
  salto.base topLevelRefBaseInst {
    str = salto.base.instance.aBaseInst
  }
`

  const refTopLevelRefBaseInstFile = `
  salto.base refTopLevelRefBaseInst {
    str = salto.base.instance.topLevelRefBaseInst.str
  }
`

  const objFile = `
  type salto.obj {
    salto.base base {
    }
  }
`

  const objInstFile = `
  salto.obj objInst {
    base = {
      str = "test"
    }
  }
`

  const files = {
    primFile,
    baseFile,
    objFile,
    baseInstFile,
    refBaseInstFile,
    anotherRefBaseInstFile,
    topLevelRefBaseInstFile,
    refTopLevelRefBaseInstFile,
    objInstFile,
  }

  describe.each([false, true])(
    'getDependents (skipValidationDependentElementsFiltering: %s)',
    skipValidationDependentElementsFiltering => {
      setupEnvVar(
        `SALTO_${WORKSPACE_FLAGS.skipValidationDependentElementsFiltering}`,
        skipValidationDependentElementsFiltering ? 'true' : 'false',
        'all',
      )
      const getDependentIDs = async (change: Change<Element>): Promise<ElemID[]> => {
        const dependents = await getDependents(
          [change],
          await workspace.elements(),
          await workspace.getReferenceSourcesIndex(),
        )
        return dependents.map(element => element.elemID)
      }

      beforeAll(async () => {
        naclFiles = await naclFilesSource(
          '',
          mockDirStore(undefined, undefined, files),
          mockStaticFilesSource(),
          inMemRemoteMapCreator(),
          true,
        )
        workspace = await createWorkspace(undefined, undefined, undefined, undefined, undefined, undefined, {
          '': {
            naclFiles,
          },
          default: {
            naclFiles: createMockNaclFileSource([]),
            state: createState([], true),
          },
        })
      })

      describe('type dependents', () => {
        let dependentIDs: ElemID[]

        beforeAll(async () => {
          dependentIDs = await getDependentIDs(
            toChange({ after: new ObjectType({ elemID: new ElemID('salto', 'base') }) }),
          )
        })
        it('should have the correct amount of dependents', () => {
          expect(dependentIDs).toHaveLength(7)
        })
        it('should have dependent instances', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'aBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'bBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'cBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'topLevelRefBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'refTopLevelRefBaseInst'))
        })
        it('should have dependent type because of a field type', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'obj'))
        })
        it('should have dependent instances that their type is a dependent too', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'obj', 'instance', 'objInst'))
        })
      })

      describe('field type dependents', () => {
        let dependentIDs: ElemID[]

        beforeAll(async () => {
          dependentIDs = await getDependentIDs(
            toChange({ after: new ObjectType({ elemID: new ElemID('salto', 'prim') }) }),
          )
        })
        it('should have the correct amount of dependents', () => {
          expect(dependentIDs).toHaveLength(8)
        })
        it('should have dependent type because of a field type', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base'))
        })
        it('should have dependent type because of a field type that is dependent too', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'obj'))
        })
        it('should have dependent instances that their type is a dependent too', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'aBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'bBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'cBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'topLevelRefBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'refTopLevelRefBaseInst'))
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'obj', 'instance', 'objInst'))
        })
      })

      describe('reference dependents', () => {
        let dependentIDs: ElemID[]

        beforeAll(async () => {
          dependentIDs = await getDependentIDs(
            toChange({
              after: new InstanceElement('aBaseInst', new ObjectType({ elemID: new ElemID('salto', 'base') })),
            }),
          )
        })
        it('should have the correct amount of dependents', () => {
          expect(dependentIDs).toHaveLength(skipValidationDependentElementsFiltering ? 4 : 2)
        })
        it('should have a dependent that have a reference to the input ID', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'bBaseInst'))
        })
        it('should have a dependent that have a reference to another dependent ID', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'cBaseInst'))
        })
        if (!skipValidationDependentElementsFiltering) {
          it('should not have a dependent that have a top level reference to the input ID', () => {
            expect(dependentIDs).not.toContainEqual(new ElemID('salto', 'base', 'instance', 'topLevelRefBaseInst'))
          })
          it('should not have a dependent that have a reference to a dependent that have a top level reference to the input ID', () => {
            expect(dependentIDs).not.toContainEqual(new ElemID('salto', 'base', 'instance', 'refTopLevelRefBaseInst'))
          })
        }
      })

      describe('when an element is removed', () => {
        let dependentIDs: ElemID[]

        beforeAll(async () => {
          dependentIDs = await getDependentIDs(
            toChange({
              before: new InstanceElement('aBaseInst', new ObjectType({ elemID: new ElemID('salto', 'base') })),
            }),
          )
        })
        it('should have a dependent that have a top level reference to the input ID', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'topLevelRefBaseInst'))
        })
        it('should have a dependent that have a reference to a dependent that have a top level reference to the input ID', () => {
          expect(dependentIDs).toContainEqual(new ElemID('salto', 'base', 'instance', 'refTopLevelRefBaseInst'))
        })
      })

      describe('when element is not referenced', () => {
        let dependentIDs: ElemID[]

        beforeAll(async () => {
          dependentIDs = await getDependentIDs(
            toChange({
              after: new InstanceElement('objInst', new ObjectType({ elemID: new ElemID('salto', 'obj') })),
            }),
          )
        })
        it('should have no dependents', () => {
          expect(dependentIDs).toHaveLength(0)
        })
      })
    },
  )
})
