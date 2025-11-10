// Placeholder for 3D cell preview component
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

export function CellPreview3D({ formFactor, dims }: { formFactor: 'cylindrical' | 'prismatic', dims: { radius?: number; length?: number; width?: number; height: number } }) {
  const realHeight = (dims.height || 0) / 1000
  let geometry
  const rotation: [number, number, number] = formFactor === 'cylindrical' ? [0, 0, 0] : [Math.PI / 2, 0, 0]
  if (formFactor === 'cylindrical') {
    const realRadius = (dims.radius || 0) / 1000
    geometry = <cylinderGeometry args={[realRadius, realRadius, realHeight, 32]} />
  } else {
    const realLength = (dims.length || 0) / 1000
    const realWidth = (dims.width || 0) / 1000
    geometry = <boxGeometry args={[realLength, realWidth, realHeight]} />
  }

  return (
    <div className="w-full h-64 bg-gray-100 rounded-md overflow-hidden">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 0.5]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[1, 1, 1]} />
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {geometry}
          <meshStandardMaterial color="steelblue" />
        </mesh>
        <OrbitControls />
      </Canvas>
      </div>
  )
}
