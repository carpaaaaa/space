"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/**
 * Post-processing della scena: bloom caldo e morbido (mipmap, soglia alta:
 * accende solo nucleo e stelle brillanti, mai un neon) + la vignettatura
 * fotografica di DESIGN.md. La lib postprocessing fonde gli effetti in un
 * solo fullscreen pass, quindi il costo resta contenuto.
 *
 * Gating: su mobile il bloom scende di intensita; con reduced-motion si
 * spegne (resta la vignettatura, che e statica).
 */
export function EffettiScena({ ridotto, mobile }: { ridotto: boolean; mobile: boolean }) {
  const vignetta = <Vignette eskil={false} offset={0.26} darkness={0.58} />;

  if (ridotto) {
    return <EffectComposer multisampling={0}>{vignetta}</EffectComposer>;
  }

  return (
    <EffectComposer multisampling={mobile ? 0 : 4}>
      <Bloom
        mipmapBlur
        intensity={mobile ? 0.28 : 0.5}
        luminanceThreshold={0.24}
        luminanceSmoothing={0.42}
        radius={0.85}
      />
      {vignetta}
    </EffectComposer>
  );
}
