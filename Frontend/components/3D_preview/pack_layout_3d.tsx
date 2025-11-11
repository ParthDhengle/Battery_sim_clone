
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
function PackLayout3D({ cells, formFactor }: { cells: any[], formFactor: 'cylindrical' | 'prismatic' }) {
  if (!cells.length) {
    return <p className="text-center text-muted-foreground">No valid pack configuration yet. Adjust parameters to preview.</p>
  }

  return (
    <div className="w-full h-96 bg-gray-100 rounded-md overflow-hidden">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0.5, 0.5, 0.5]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[1, 1, 1]} />
        {cells.map((cell) => {
          const pos = cell.position
          const dims = cell.dims
          let geometry
          const rotation: [number, number, number] = formFactor === 'cylindrical' ? [0, 0, 0] : [Math.PI / 2, 0, 0]
          if (formFactor === 'cylindrical') {
            geometry = <cylinderGeometry args={[dims.radius, dims.radius, dims.height, 32]} />
          } else {
            geometry = <boxGeometry args={[dims.length, dims.width, dims.height]} />
          }
          return (
            <mesh
              key={cell.global_index}
              position={[pos[0], pos[2], pos[1]]}
              rotation={rotation}
            >
              {geometry}
              <meshStandardMaterial color="steelblue" />
            </mesh>
          )
        })}
        <OrbitControls />
      </Canvas>
    </div>
  )
}


export { PackLayout3D };