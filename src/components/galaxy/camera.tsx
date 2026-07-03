"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import gsap from "gsap";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { useUI } from "@/state/store";

const CASA_POS = new THREE.Vector3(34, 64, 108);
const CASA_TARGET = new THREE.Vector3(0, 0, 0);

export function ControlliCamera({
  g,
  ridotto,
}: {
  g: Galassia | null;
  ridotto: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const volaA = useUI((s) => s.volaA);
  const setGalassiaPronta = useUI((s) => s.setGalassiaPronta);
  const entrata = useRef(false);

  // ingresso cinematico: discesa verso il disco, una sola volta
  useEffect(() => {
    if (entrata.current) return;
    entrata.current = true;
    if (ridotto) {
      camera.position.copy(CASA_POS);
      setGalassiaPronta(true);
      return;
    }
    camera.position.set(4, 210, 290);
    const anim = gsap.to(camera.position, {
      x: CASA_POS.x,
      y: CASA_POS.y,
      z: CASA_POS.z,
      duration: 2.2,
      ease: "expo.out",
      onUpdate: () => controls.current?.update(),
      onComplete: () => setGalassiaPronta(true),
    });
    return () => {
      anim.kill();
    };
  }, [camera, ridotto, setGalassiaPronta]);

  // vola verso una stella (ricerca, click su etichetta) o torna a casa
  useEffect(() => {
    if (!controls.current || volaA.n === 0) return;
    const ctr = controls.current;
    let destTarget = CASA_TARGET.clone();
    let destPos = CASA_POS.clone();
    if (volaA.idx != null && g) {
      const i = volaA.idx;
      const p = new THREE.Vector3(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]);
      destTarget = p.clone();
      // posizione: leggermente sopra e indietro rispetto alla stella, verso l'esterno
      const fuori = p.clone().setY(0);
      if (fuori.lengthSq() < 1) fuori.set(1, 0, 0);
      fuori.normalize();
      const dist = 10 + g.size[i] * 3.5;
      destPos = p
        .clone()
        .add(fuori.multiplyScalar(dist * 0.8))
        .add(new THREE.Vector3(0, dist * 0.62, 0));
    }
    if (ridotto) {
      camera.position.copy(destPos);
      ctr.target.copy(destTarget);
      ctr.update();
      return;
    }
    const anims = [
      gsap.to(camera.position, {
        x: destPos.x,
        y: destPos.y,
        z: destPos.z,
        duration: 1.25,
        ease: "expo.inOut",
      }),
      gsap.to(ctr.target, {
        x: destTarget.x,
        y: destTarget.y,
        z: destTarget.z,
        duration: 1.25,
        ease: "expo.inOut",
        onUpdate: () => ctr.update(),
      }),
    ];
    return () => anims.forEach((a) => a.kill());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volaA.n]);

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.55}
      zoomSpeed={0.9}
      minDistance={4}
      maxDistance={420}
      maxPolarAngle={1.5}
      autoRotate={!ridotto}
      autoRotateSpeed={0.12}
      makeDefault
    />
  );
}
