import * as THREE from '../extras/three'
import { System } from './System'
import { ControlPriorities } from '../extras/ControlPriorities'

const CAMERA_SPEED = 10 // units per second
const CAMERA_ROTATION_SPEED = 2

export class BuildMode extends System {
	constructor(world) {
		super(world)
		this.active = false
		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
		this.camera.position.set(0, 5, 10)
		this.camera.lookAt(0, 0, 0)

		// Store original camera position when entering build mode
		this.originalCameraPosition = new THREE.Vector3()
		this.originalCameraQuaternion = new THREE.Quaternion()
	}

	start() {
		this.control = this.world.controls.bind({
			priority: ControlPriorities.EDITOR,
			onPress: code => {
				if (code === 'Tab') {
					this.toggleBuildMode()
				}
			},
		})

		// Handle window resize
		window.addEventListener('resize', this.onResize)
		this.onResize()
	}

	onResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight
		this.camera.updateProjectionMatrix()
	}

	toggleBuildMode() {
		this.active = !this.active

		if (this.active) {
			// Store current camera state
			this.originalCameraPosition.copy(this.world.camera.position)
			this.originalCameraQuaternion.copy(this.world.camera.quaternion)

			// Take control of the camera
			this.control.camera.claim()
			this.camera.position.copy(this.world.camera.position)
			this.camera.quaternion.copy(this.world.camera.quaternion)
		} else {
			// Return control and restore original camera
			this.control.camera.unclaim()
			this.world.camera.position.copy(this.originalCameraPosition)
			this.world.camera.quaternion.copy(this.originalCameraQuaternion)
		}
	}

	update(delta) {
		if (!this.active) return

		const moveSpeed = CAMERA_SPEED * delta
		const rotateSpeed = CAMERA_ROTATION_SPEED * delta

		// Handle camera movement
		if (this.control.buttons.KeyW) this.moveForward(moveSpeed)
		if (this.control.buttons.KeyS) this.moveBackward(moveSpeed)
		if (this.control.buttons.KeyA) this.moveLeft(moveSpeed)
		if (this.control.buttons.KeyD) this.moveRight(moveSpeed)
		if (this.control.buttons.Space) this.moveUp(moveSpeed)
		if (this.control.buttons.ShiftLeft) this.moveDown(moveSpeed)

		// Handle camera rotation with right mouse button
		if (this.control.buttons.MouseRight) {
			const deltaX = -this.control.pointer.delta.x * rotateSpeed
			const deltaY = -this.control.pointer.delta.y * rotateSpeed

			// Rotate camera
			this.rotateCamera(deltaX, deltaY)
		}

		// Update the control camera
		this.control.camera.position.copy(this.camera.position)
		this.control.camera.quaternion.copy(this.camera.quaternion)
	}

	moveForward(distance) {
		const direction = new THREE.Vector3(0, 0, -1)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveBackward(distance) {
		const direction = new THREE.Vector3(0, 0, 1)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveLeft(distance) {
		const direction = new THREE.Vector3(-1, 0, 0)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveRight(distance) {
		const direction = new THREE.Vector3(1, 0, 0)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveUp(distance) {
		this.camera.position.y += distance
	}

	moveDown(distance) {
		this.camera.position.y -= distance
	}

	rotateCamera(deltaX, deltaY) {
		const euler = new THREE.Euler(0, 0, 0, 'YXZ')
		euler.setFromQuaternion(this.camera.quaternion)

		euler.y += deltaX
		euler.x += deltaY

		// Clamp vertical rotation to prevent camera flipping
		euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))

		this.camera.quaternion.setFromEuler(euler)
	}

	destroy() {
		window.removeEventListener('resize', this.onResize)
		if (this.active) {
			this.toggleBuildMode()
		}
	}
} 