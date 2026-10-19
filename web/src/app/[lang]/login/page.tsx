import { comingSoonMetadata, comingSoonPage } from "@/components/coming-soon";

// Placeholder until Stage 4.
export const generateMetadata = comingSoonMetadata((d) => d.nav.login);
export default comingSoonPage((d) => d.nav.login);
