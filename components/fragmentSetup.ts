import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'

export function fragmentSetup(
  components: OBC.Components,
  world: {
    scene: OBC.SimpleScene
    camera: OBC.OrthoPerspectiveCamera
    renderer: OBF.PostproductionRenderer
  }
) {
  const fragments = components.get(OBC.FragmentsManager)
  fragments.init('/workers/worker.mjs')

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    const isLod = 'isLodMaterial' in material && material.isLodMaterial
    if (isLod) {
      world.renderer!.postproduction.basePass.isolatedMaterials.push(material)
    }
  })

  return { fragments }
}
