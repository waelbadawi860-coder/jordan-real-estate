import { comingSoonMetadata, comingSoonPage } from "@/components/coming-soon";

// Placeholder until Stage 4.
export const generateMetadata = comingSoonMetadata((d) => d.nav.addProperty);
export default comingSoonPage((d) => d.nav.addProperty);
