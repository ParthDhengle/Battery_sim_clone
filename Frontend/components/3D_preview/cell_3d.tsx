// components/cell/CellPreview3D.tsx
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"

type Props = {
  formFactor: "cylindrical" | "prismatic" | "pouch" | "coin"
  dims: { diameter?: number; length?: number; width?: number; height: number }
}

export default function CellPreview3D({ formFactor, dims }: Props) {
  const realHeight = (dims.height || 0) / 1000

  if (realHeight === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <p>Enter dimensions to preview</p>
      </div>
    )
  }

  let geometry

  if (formFactor === "cylindrical" || formFactor === "coin") {
    const realDiameter = (dims.diameter || 0) / 1000
    if (realDiameter === 0)
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p>Enter diameter</p>
        </div>
      )
    geometry = <cylinderGeometry args={[realDiameter / 2, realDiameter / 2, realHeight, 32]} />
  } else {
    const realLength = (dims.length || 0) / 1000
    const realWidth = (dims.width || 0) / 1000
    if (realLength === 0 || realWidth === 0)
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p>Enter dimensions</p>
        </div>
      )
    geometry = <boxGeometry args={[realLength, realWidth, realHeight]} />
  }

  return (
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
  )
}