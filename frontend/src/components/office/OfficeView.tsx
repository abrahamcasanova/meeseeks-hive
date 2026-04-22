import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import { OfficeScene } from './OfficeScene';
import { useHiveStore } from '@/stores/hive.store';

export function OfficeView() {
  const setSelected = useHiveStore((s) => s.setSelected);

  return (
    <div className="w-full h-full bg-gray-950">
      <Canvas
        orthographic
        onPointerMissed={() => setSelected(null)}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#1a1a2e' }}
      >
        <OrthographicCamera
          makeDefault
          zoom={40}
          position={[10, 12, 10]}
          near={0.1}
          far={1000}
        />

        <OrbitControls
          makeDefault
          enableRotate={true}
          enablePan={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={100}
          maxPolarAngle={Math.PI / 3}
          minPolarAngle={Math.PI / 6}
          target={[0, 0, 0]}
        />

        <ambientLight intensity={2.0} color="#f5f0e8" />
        <directionalLight position={[10, 20, 10]} intensity={1.5} color="#ffffff" castShadow />
        <directionalLight position={[-8, 12, -5]} intensity={0.8} color="#e8f0ff" />
        <directionalLight position={[0, 8, 12]} intensity={0.6} color="#ffffff" />

        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 25, 50]} />

        <OfficeScene />
      </Canvas>
    </div>
  );
}
