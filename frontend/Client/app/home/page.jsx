import HomeClient from "./HomeClient";

/* ============ /home — SSR-SEEDED FOR INSTANT PAINT ============
   Banners + plans SERVER-SIDE fetch hoke ISR HTML me bake ho jate
   hain (revalidate 15s). Refresh par pehla paint hi real admin
   banner + real plans dikhata hai — white banner / "Buy Now" flash
   (1-2s old data) khatam. Client phir bhi no-store fetch + socket
   live updates se hamesha fresh rehta hai. */

export const revalidate = 15;

const BACKEND = "http://127.0.0.1:3030";

async function getJSON(path) {
  try {
    const r = await fetch(BACKEND + path, { next: { revalidate: 15 } });
    const d = await r.json();
    return d && d.success ? d : null;
  } catch (e) {
    return null;
  }
}

export default async function HomePage() {
  const [b, p] = await Promise.all([getJSON("/api/banners"), getJSON("/api/plans")]);

  const initialBanners =
    b && Array.isArray(b.banners)
      ? b.banners.map((x) => x.image).filter(Boolean)
      : null;
  const initialPlans = p && Array.isArray(p.plans) ? p.plans : null;

  return <HomeClient initialBanners={initialBanners} initialPlans={initialPlans} />;
}
