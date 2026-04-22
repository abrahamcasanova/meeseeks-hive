export function OfficeFloor() {
  const roomW = 28;
  const roomD = 24;
  const wallH = 3.5;
  const wallT = 0.3;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#ddd8cc" />
      </mesh>

      {/* Floor tiles grid lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#c8c3b8" wireframe={false} opacity={0.3} transparent />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, wallH / 2, -roomD / 2]} receiveShadow>
        <boxGeometry args={[roomW, wallH, wallT]} />
        <meshStandardMaterial color="#b8b4ae" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[wallT, wallH, roomD]} />
        <meshStandardMaterial color="#c0bcb6" />
      </mesh>

      {/* Right wall */}
      <mesh position={[roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[wallT, wallH, roomD]} />
        <meshStandardMaterial color="#c0bcb6" />
      </mesh>

      {/* Baseboard back */}
      <mesh position={[0, 0.15, -roomD / 2 + 0.2]}>
        <boxGeometry args={[roomW, 0.3, 0.1]} />
        <meshStandardMaterial color="#9a9690" />
      </mesh>
    </group>
  );
}
