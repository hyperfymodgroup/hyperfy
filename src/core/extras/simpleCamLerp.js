import * as THREE from './three'
import { Layers } from './Layers'

const CAM_MAX_DISTANCE = 0.5 // max distance between camera and target
const CAM_MIN_FACTOR = 5 // min lerp factor (slowest speed)
const CAM_MAX_FACTOR = 16 // max lerp factor (fastest speed) note: it gets jittery for some reason when higher

const BACKWARD = new THREE.Vector3(0, 0, 1)

const v1 = new THREE.Vector3()

let sweepGeometry

export function simpleCamLerp(world, camera, target, delta) {
  // interpolate camera rig to target transform with a slight lag
  const distanceToTarget = camera.position.distanceTo(target.position) // prettier-ignore
  const t = Math.min(distanceToTarget / CAM_MAX_DISTANCE, 1)
  const lerpFactor = CAM_MAX_FACTOR - (CAM_MAX_FACTOR - CAM_MIN_FACTOR) * (1 - Math.pow(t, 2)) // prettier-ignore
  camera.position.lerp(target.position, lerpFactor * delta)
  camera.quaternion.slerp(target.quaternion, 16 * delta)

  // raycast backward to check for zoom collision
  if (!sweepGeometry) sweepGeometry = new PHYSX.PxSphereGeometry(0.2)
  const origin = camera.position
  const direction = v1.copy(BACKWARD).applyQuaternion(camera.quaternion)
  const layerMask = Layers.camera.mask // hit everything the camera should hit
  const hit = world.physics.sweep(sweepGeometry, origin, direction, 200, layerMask)

  // lerp to target zoom distance
  let distance = target.zoom
  // but if we hit something snap it in so we don't end up in the wall
  if (hit && hit.distance < distance) {
    camera.zoom = hit.distance
  } else {
    const alpha = 6 * delta
    camera.zoom += (distance - camera.zoom) * alpha // regular lerp
    // camera.position.lerp(v1.set(0, 0, distance), 6 * delta)
  }
}
