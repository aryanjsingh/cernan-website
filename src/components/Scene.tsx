import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 40 }} dpr={[1, 1.5]} frameloop="demand" fallback={<p className="fallback">3D preview is unavailable on this device.</p>}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 5]} intensity={3} />
      <directionalLight position={[-3, -2, 2]} intensity={1} />
      <mesh rotation={[0.4, 0.2, 0]}>
        <torusKnotGeometry args={[0.85, 0.23, 128, 24]} />
        <meshStandardMaterial color="#a8b4bb" metalness={0.65} roughness={0.28} />
      </mesh>
      <OrbitControls enablePan={false} enableZoom={false} enableDamping={false} />
    </Canvas>
  )
}
