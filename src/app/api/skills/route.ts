import { caricaSkills } from "@/lib/vault/skills";

export const dynamic = "force-dynamic";

/** GET: elenco skill del vault (senza corpo integrale) + note scartate. */
export async function GET() {
  const { skills, scartate } = await caricaSkills();
  return Response.json({
    skills: skills.map(({ corpo, ...resto }) => ({
      ...resto,
      estratto: corpo.slice(0, 200),
    })),
    scartate,
  });
}
