import * as THREE from '../extras/three'
import { System } from './System'
import { ControlPriorities } from '../extras/ControlPriorities'

const MIN_CAMERA_SPEED = 1
const MAX_CAMERA_SPEED = 50
const ROTATION_SPEED = 2 // Fixed rotation speed
const SPEED_ADJUST_FACTOR = 1.2
const GRID_SIZE = 20
const GRID_DIVISIONS = 20

export class BuildMode extends System {
	constructor(world) {
		super(world)
		this.active = false
		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

		// Initialize speeds
		this.moveSpeed = 10
		this.rotateSpeed = ROTATION_SPEED // Use constant rotation speed

		// Add smooth camera rotation
		this.targetRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.currentRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.rotationVelocity = new THREE.Vector2(0, 0)
		this.lastMousePosition = new THREE.Vector2()

		// Store original camera position when entering build mode
		this.originalCameraPosition = new THREE.Vector3()
		this.originalCameraQuaternion = new THREE.Quaternion()

		// Store original player velocity
		this.originalPlayerVelocity = new THREE.Vector3()

		// Create build grid
		this.initializeGrid()

		// Bind methods
		this.onMouseMove = this.onMouseMove.bind(this)
	}

	initializeGrid() {
		// Create an infinite grid that's much larger
		const size = 10000 // Extremely large size for infinite appearance
		const divisions = 500 // More divisions for finer grid
		this.grid = new THREE.GridHelper(size, divisions)

		// Create custom material for the grid with gradient colors
		const gradientTexture = new THREE.CanvasTexture(this.createGradientCanvas())
		gradientTexture.wrapS = THREE.RepeatWrapping
		gradientTexture.wrapT = THREE.RepeatWrapping
		gradientTexture.repeat.set(50, 50) // Repeat the gradient more times

		// Create custom grid material with improved shader
		const material = new THREE.ShaderMaterial({
			uniforms: {
				gradientMap: { value: gradientTexture },
				time: { value: 0 },
				opacity: { value: 0.85 }, // Increased opacity further
				fadeDistance: { value: 200.0 },
				gridScale: { value: 1.0 }
			},
			vertexShader: `
				varying vec2 vUv;
				varying float vDistance;
				void main() {
					vUv = uv;
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					vDistance = -mvPosition.z;
					
					// Scale vertices to make lines thicker
					vec3 pos = position;
					float scale = 1.5; // Increase line thickness
					pos *= scale;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
					gl_PointSize = 3.0; // Increased point size
				}
			`,
			fragmentShader: `
				uniform sampler2D gradientMap;
				uniform float time;
				uniform float opacity;
				uniform float fadeDistance;
				uniform float gridScale;
				varying vec2 vUv;
				varying float vDistance;

				void main() {
					vec2 uv = vUv;
					uv.x = (uv.x + time * 0.1) * gridScale;
					vec4 gradientColor = texture2D(gradientMap, uv);
					
					// Improved distance fade calculation
					float fade = 1.0 - smoothstep(0.0, fadeDistance, vDistance);
					// Increased minimum opacity for better visibility
					fade = max(fade, 0.2);
					
					// Make lines more prominent
					float lineIntensity = 1.5; // Increased line brightness
					vec3 brightColor = gradientColor.rgb * lineIntensity;
					
					// Apply fade and opacity with enhanced visibility
					gl_FragColor = vec4(brightColor, gradientColor.a * opacity * fade);
				}
			`,
			transparent: true,
			side: THREE.DoubleSide,
			linewidth: 3, // Increased line width
		})

		// Create the grid lines with thicker LineSegments
		const gridGeometry = this.grid.geometry;
		const lineSegments = new THREE.LineSegments(gridGeometry, material);
		lineSegments.material.linewidth = 3; // Increased line width

		// Make the lines more visible by scaling them
		lineSegments.scale.multiplyScalar(1.02); // Slightly scale up the entire grid

		// Clear the original grid and add the new line segments
		this.gridContainer = new THREE.Object3D();
		this.gridContainer.add(lineSegments);
		this.grid = lineSegments;

		// Initialize grid state
		this.lastGridHeight = 0;
		this.targetGridHeight = 0;
		this.gridHeightVelocity = 0;
		this.gridSnapPoints = new THREE.Vector3(1, 1, 1); // Snap intervals

		// Initialize raycaster for grid placement
		this.raycaster = new THREE.Raycaster();
		this.mousePosition = new THREE.Vector2();
	}

	createGradientCanvas() {
		const canvas = document.createElement('canvas')
		canvas.width = 512
		canvas.height = 1
		const ctx = canvas.getContext('2d')

		// Create gradient with Hyperfy brand colors
		const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
		gradient.addColorStop(0, '#D90479')
		gradient.addColorStop(0.25, '#A61C81')
		gradient.addColorStop(0.5, '#8E37A6')
		gradient.addColorStop(0.75, '#2975D9')
		gradient.addColorStop(1, '#D90479') // Repeat first color for seamless loop

		ctx.fillStyle = gradient
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		return canvas
	}

	start() {
		this.control = this.world.controls.bind({
			priority: ControlPriorities.EDITOR,
			onPress: code => {
				if (code === 'KeyB') {
					this.toggleBuildMode()
				}
			},
			onScroll: () => {
				if (!this.active) return false

				// Only adjust movement speed with scroll wheel
				const delta = this.control.scroll.delta
				if (delta < 0) {
					this.moveSpeed = Math.min(MAX_CAMERA_SPEED, this.moveSpeed * SPEED_ADJUST_FACTOR)
				} else if (delta > 0) {
					this.moveSpeed = Math.max(MIN_CAMERA_SPEED, this.moveSpeed / SPEED_ADJUST_FACTOR)
				}
				return true
			}
		})

		// Handle window resize
		window.addEventListener('resize', this.onResize)
		this.onResize()

		// Add grid to scene
		if (this.active) {
			this.world.stage.scene.add(this.gridContainer)
		}
	}

	onResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight
		this.camera.updateProjectionMatrix()
	}

	onMouseMove(event) {
		if (!this.active) return

		const deltaX = -event.movementX * 0.002 * this.rotateSpeed
		const deltaY = -event.movementY * 0.002 * this.rotateSpeed

		// Update target rotation
		this.targetRotation.y += deltaX
		this.targetRotation.x += deltaY

		// Clamp vertical rotation to prevent camera flipping
		this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x))
	}

	toggleBuildMode() {
		this.active = !this.active
		const player = this.world.entities.player

		if (this.active) {
			// Add mouse move listener for camera rotation
			document.addEventListener('mousemove', this.onMouseMove)

			// Request pointer lock
			document.body.requestPointerLock()

			// Store current camera state
			this.originalCameraPosition.copy(this.world.camera.position)
			this.originalCameraQuaternion.copy(this.world.camera.quaternion)

			// Initialize rotations
			this.currentRotation.setFromQuaternion(this.world.camera.quaternion)
			this.targetRotation.copy(this.currentRotation)

			// Position camera above player
			const playerPosition = player.base.position.clone()
			this.camera.position.copy(playerPosition).add(new THREE.Vector3(0, 5, 0))
			this.camera.lookAt(playerPosition)

			// Take control of the camera
			this.control.camera.claim()

			// Disable player movement and camera control
			player.control.camera.unclaim()

			// Disable all player controls by removing their priority
			player.control.priority = -1

			// Store and zero out player velocity
			this.originalPlayerVelocity.copy(player.capsule.getLinearVelocity())
			player.capsule.setLinearVelocity({ x: 0, y: 0, z: 0 })

			// Lock the player in place
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

			// Disable player's movement-related flags
			player.moving = false
			player.running = false
			player.jumping = false
			player.falling = false
			player.emote = 'idle'

			// Add grid container to scene instead of gridRotation
			this.world.stage.scene.add(this.gridContainer)
		} else {
			// Remove mouse move listener
			document.removeEventListener('mousemove', this.onMouseMove)

			// Exit pointer lock
			if (document.pointerLockElement) {
				document.exitPointerLock()
			}

			// Return control and restore original camera
			this.control.camera.unclaim()
			this.world.camera.position.copy(this.originalCameraPosition)
			this.world.camera.quaternion.copy(this.originalCameraQuaternion)

			// Re-enable player movement and camera control
			player.control.camera.claim()

			// Restore player control priority
			player.control.priority = ControlPriorities.PLAYER

			// Unlock the player and restore velocity
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
			player.capsule.setLinearVelocity(this.originalPlayerVelocity)

			// Remove grid container from scene
			this.world.stage.scene.remove(this.gridContainer)
		}
	}

	updateGridPosition() {
		if (!this.active) return

		// Get mouse position in normalized device coordinates (-1 to +1)
		const pointer = this.control.pointer
		this.mousePosition.x = (pointer.coords.x * 2) - 1
		this.mousePosition.y = -(pointer.coords.y * 2) + 1

		// Update the picking ray with the camera and mouse position
		this.raycaster.setFromCamera(this.mousePosition, this.camera)

		// Perform raycast
		const hits = this.world.stage.raycastPointer(pointer.position)
		const hit = hits[0]

		if (hit) {
			// Update target height based on terrain hit
			this.targetGridHeight = hit.point.y
		} else {
			// If no hit, maintain last known height
			this.targetGridHeight = this.lastGridHeight
		}

		// Smooth height transition using spring physics
		const springStrength = 15.0
		const damping = 0.8

		// Calculate spring force
		const heightDiff = this.targetGridHeight - this.lastGridHeight
		const springForce = heightDiff * springStrength

		// Update velocity with spring force and damping
		this.gridHeightVelocity += springForce * 0.016 // Assuming 60fps
		this.gridHeightVelocity *= damping

		// Update grid height
		this.lastGridHeight += this.gridHeightVelocity

		// Update grid container position
		this.gridContainer.position.y = this.lastGridHeight

		// Keep grid centered on camera horizontally
		this.gridContainer.position.x = Math.floor(this.camera.position.x)
		this.gridContainer.position.z = Math.floor(this.camera.position.z)
	}

	// Add method to get snapped position
	getSnappedPosition(position) {
		return new THREE.Vector3(
			Math.round(position.x / this.gridSnapPoints.x) * this.gridSnapPoints.x,
			Math.round(position.y / this.gridSnapPoints.y) * this.gridSnapPoints.y,
			Math.round(position.z / this.gridSnapPoints.z) * this.gridSnapPoints.z
		)
	}

	update(delta) {
		if (!this.active) return

		// Update grid animation
		if (this.grid.material.uniforms) {
			this.grid.material.uniforms.time.value += delta
		}

		// Smoothly interpolate current rotation to target rotation
		const rotationLerp = 1 - Math.pow(0.001, delta) // Smooth interpolation factor
		this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * rotationLerp
		this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * rotationLerp
		this.camera.quaternion.setFromEuler(this.currentRotation)

		// Handle camera movement
		if (this.control.buttons.KeyW) this.moveForward(this.moveSpeed * delta)
		if (this.control.buttons.KeyS) this.moveBackward(this.moveSpeed * delta)
		if (this.control.buttons.KeyA) this.moveLeft(this.moveSpeed * delta)
		if (this.control.buttons.KeyD) this.moveRight(this.moveSpeed * delta)
		if (this.control.buttons.KeyQ) this.moveDown(this.moveSpeed * delta)
		if (this.control.buttons.KeyE) this.moveUp(this.moveSpeed * delta)

		// Update the control camera
		this.control.camera.position.copy(this.camera.position)
		this.control.camera.quaternion.copy(this.camera.quaternion)

		// Update grid position
		this.updateGridPosition()
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

	destroy() {
		window.removeEventListener('resize', this.onResize)
		document.removeEventListener('mousemove', this.onMouseMove)
		if (document.pointerLockElement) {
			document.exitPointerLock()
		}
		if (this.active) {
			this.toggleBuildMode()
		}
		// Cleanup grid resources
		if (this.grid.material.uniforms.gradientMap.value) {
			this.grid.material.uniforms.gradientMap.value.dispose()
		}
		this.grid.material.dispose()
	}
}